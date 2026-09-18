import type { GenerationJob, JobStep, Packet } from "@prisma/client";
import { db } from "@/lib/db";
import { env, hasLlm } from "@/lib/env";
import { getRepoRows } from "@/lib/sheets/repo";
import { companyMatches, roleRelevance, roundKey, roundKeyOrder } from "@/lib/match";
import { normalizeQuestion, questionSimilarity } from "@/lib/normalize";
import { YOE_BUCKET_LABELS } from "@/lib/match";
import { improveReadability, looksClean } from "@/lib/llm/improve";
import { scopeFilter } from "@/lib/llm/scope-filter";
import { webResearch } from "@/lib/llm/web-research";
import { nameRounds } from "@/lib/llm/name-rounds";
import { jdSpillover } from "@/lib/llm/jd-spillover";
import { findProblemLinks, looksLikeCodingProblem } from "@/lib/llm/problem-links";
import { practiceDomains } from "@/lib/web-sources";
import { sameQuestionBatch } from "@/lib/llm/merge";
import { jobSpendSoFar } from "@/lib/llm/usage";
import type { DraftQuestion, DraftRound, PacketContext, RepoRow } from "./types";

const STEP_ORDER: JobStep[] = [
  "LOAD_SHEET",
  "SCOPE_FILTER",
  "READABILITY",
  "WEB_RESEARCH",
  "MERGE",
  "NAME_ROUNDS",
  "JD_SPILLOVER",
  "PROBLEM_LINKS",
  "FINALIZE",
  "DONE",
];

/**
 * Steps at/after MERGE operate on `scratch.draftRounds` only once it has been
 * deduped against the packet's existing questions there — so it's the earliest
 * point where saving `scratch.draftRounds` to the DB on failure is safe.
 */
const PARTIAL_SAVE_STEPS = new Set<JobStep>([
  "NAME_ROUNDS",
  "JD_SPILLOVER",
  "PROBLEM_LINKS",
  "FINALIZE",
]);

const STEP_PROGRESS: Record<JobStep, number> = {
  LOAD_SHEET: 12,
  SCOPE_FILTER: 22,
  READABILITY: 38,
  WEB_RESEARCH: 58,
  MERGE: 72,
  NAME_ROUNDS: 80,
  JD_SPILLOVER: 88,
  PROBLEM_LINKS: 94,
  FINALIZE: 99,
  DONE: 100,
};

const STEP_LABEL: Record<JobStep, string> = {
  LOAD_SHEET: "Reading the question sheet",
  SCOPE_FILTER: "Checking company × role fit",
  READABILITY: "Improving question readability",
  WEB_RESEARCH: "Researching questions on the web",
  MERGE: "Merging & de-duplicating",
  NAME_ROUNDS: "Naming interview rounds",
  JD_SPILLOVER: "Adding spillover questions from the JD",
  PROBLEM_LINKS: "Finding practice links",
  FINALIZE: "Saving the packet",
  DONE: "Done",
};

interface SheetCandidate {
  id: number;
  role: string;
  round: string;
  rkey: string;
  question: string;
  relevance: "match" | "ambiguous" | "reject";
  ts: number | null;
  ref: Record<string, unknown>;
  relatedTopic: string;
  relatedModule: string;
  extractedLink: string | null;
}

interface Scratch {
  candidates?: SheetCandidate[];
  maxSheetTs?: number | null;
  keptIds?: number[];
  sheetRounds?: DraftRound[];
  webNote?: string;
  draftRounds?: DraftRound[];
  coveredTopics?: string[];
  jdSummary?: string;
}

function ctxFromPacket(p: Packet): PacketContext {
  return {
    company: p.company,
    role: p.role,
    stack: p.stack ?? "",
    track: p.track,
    yoeBucket: p.yoeBucket,
    location: p.location,
    level: YOE_BUCKET_LABELS[p.yoeBucket],
    jdText: p.jdText ?? "",
    webSources: p.webSources ?? [],
  };
}

function extractProblemLink(text: string): string | null {
  const m = text.match(/problem link\s*:?\s*(https?:\/\/\S+)/i);
  if (m) return m[1];
  const m2 = text.match(/(https?:\/\/(?:leetcode\.com|(?:www\.)?geeksforgeeks\.org)\/\S+)/i);
  return m2 ? m2[1] : null;
}

/** Hard cap on questions kept per round (build requirement). */
export const MAX_QUESTIONS_PER_ROUND = 50;
const MONTH_MS = 1000 * 60 * 60 * 24 * 30;

/** Ranking score: repetition dominates, recency (0..1 over 24 months) breaks ties. */
function questionScore(q: DraftQuestion, nowTs: number): number {
  const months = q.latestTs ? Math.max(0, (nowTs - q.latestTs) / MONTH_MS) : 24;
  return q.occurrences + Math.max(0, 1 - months / 24);
}

/** Collapse near-duplicate questions in a list, summing occurrences + keeping the latest date. */
function dedupeWithin(questions: DraftQuestion[]): DraftQuestion[] {
  const out: DraftQuestion[] = [];
  for (const q of questions) {
    const match = out.find(
      (o) => questionSimilarity(o.normalizedText, q.normalizedText) >= 0.85,
    );
    if (match) {
      match.occurrences += q.occurrences;
      if ((q.latestTs ?? 0) > (match.latestTs ?? 0)) match.latestTs = q.latestTs;
      if (!match.problemLink && q.problemLink) {
        match.problemLink = q.problemLink;
        match.problemLinkSource = q.problemLinkSource;
      }
    } else {
      out.push({ ...q });
    }
  }
  return out;
}

/** Keep only the top `limit` questions by score (most asked / most recent). */
function capRound(questions: DraftQuestion[], limit: number, nowTs: number): DraftQuestion[] {
  if (questions.length <= limit) return questions;
  return [...questions]
    .sort((a, b) => questionScore(b, nowTs) - questionScore(a, nowTs))
    .slice(0, Math.max(0, limit));
}

async function log(job: GenerationJob, line: string) {
  await db.generationJob.update({
    where: { id: job.id },
    data: { log: `${job.log}${job.log ? "\n" : ""}${new Date().toISOString().slice(11, 19)}  ${line}` },
  });
}

async function assertUnderBudget(job: GenerationJob, packet: Packet) {
  if (packet.allowHigherCost) return;
  const spent = await jobSpendSoFar(job.id);
  if (spent > env.maxPacketCostUsd) {
    throw new Error(
      `LLM cost for this run ($${spent.toFixed(3)}) exceeded the $${env.maxPacketCostUsd.toFixed(
        2,
      )} limit. Tick "allow higher cost" and retry, or use Sheet-only mode.`,
    );
  }
}

/** Run exactly one step of the job. Returns the job's new step. */
export async function runStep(jobId: string): Promise<JobStep> {
  const job = await db.generationJob.findUniqueOrThrow({
    where: { id: jobId },
    include: { packet: true },
  });
  const packet = job.packet;
  const ctx = ctxFromPacket(packet);
  const scratch = (job.scratch as Scratch | null) ?? {};
  const step = job.step;
  const meta = { jobId: job.id, packetId: packet.id };

  await db.generationJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", stepLabel: STEP_LABEL[step], progress: STEP_PROGRESS[step] - 8 },
  });

  const next = (s: JobStep) => STEP_ORDER[STEP_ORDER.indexOf(s) + 1];

  try {
    switch (step) {
      case "LOAD_SHEET": {
        // The sheet snapshot is a free-to-refresh cache of Google Sheets (no LLM).
        //  • INITIAL generation → reuse whatever snapshot exists (up to 24h old);
        //    the nightly cron keeps it fresh, so this is normally instant.
        //  • APPEND ("Pull new questions") → always re-fetch: the whole point is
        //    to pick up questions documented since last time.
        const maxAgeMinutes = job.kind === "APPEND" ? 0 : 60 * 24;
        const rows = await getRepoRows(packet.track, { maxAgeMinutes });
        const watermark = job.kind === "APPEND" ? packet.lastSheetRowDate?.getTime() ?? 0 : 0;
        const candidates: SheetCandidate[] = [];
        let maxTs = watermark;
        rows.forEach((r: RepoRow, i) => {
          if (!companyMatches(packet.company, r.company)) return;
          if (r.dateAddedTs && r.dateAddedTs > maxTs) maxTs = r.dateAddedTs;
          if (job.kind === "APPEND" && r.dateAddedTs && r.dateAddedTs <= watermark) return;
          const rel = roleRelevance(packet.role, r.role, packet.yoeBucket);
          if (rel === "reject") return;
          candidates.push({
            id: i,
            role: r.role,
            round: r.round,
            rkey: roundKey(r.round),
            question: r.question,
            relevance: rel,
            ts: r.dateAddedTs,
            ref: { jobId: r.jobId, userId: r.userId, email: r.email, date: r.dateAdded, tab: r.tab },
            relatedTopic: r.relatedTopic,
            relatedModule: r.relatedModule,
            extractedLink: extractProblemLink(r.question),
          });
        });
        await save(jobId, { ...scratch, candidates, maxSheetTs: maxTs || null }, next(step), {
          sheetFound: candidates.length,
        });
        await log(job, `Matched ${candidates.length} sheet rows for ${packet.company} / ${packet.role}.`);
        return next(step);
      }

      case "SCOPE_FILTER": {
        const candidates = scratch.candidates ?? [];
        const ambiguous = candidates.filter((c) => c.relevance === "ambiguous");
        const kept = new Set(candidates.filter((c) => c.relevance === "match").map((c) => c.id));
        if (ambiguous.length && hasLlm()) {
          const passed = await scopeFilter(
            ambiguous.map((c) => ({ id: c.id, role: c.role, round: c.round, text: c.question })),
            ctx,
            meta,
          );
          passed.forEach((id) => kept.add(id));
          await log(job, `Scope filter kept ${passed.size}/${ambiguous.length} ambiguous rows.`);
        } else {
          ambiguous.forEach((c) => kept.add(c.id));
        }
        await assertUnderBudget(job, packet);
        await save(jobId, { ...scratch, keptIds: [...kept] }, next(step));
        return next(step);
      }

      case "READABILITY": {
        const candidates = scratch.candidates ?? [];
        const keptIds = new Set(scratch.keptIds ?? candidates.map((c) => c.id));
        const kept = candidates.filter((c) => keptIds.has(c.id));
        const nowTs = Date.now();

        // Group by round, collapse near-duplicates (→ occurrence counts), and cap
        // to the top 50 per round BEFORE paying for the readability pass.
        const byRound = new Map<string, DraftRound>();
        for (const c of kept) {
          const cleanText = c.question
            .replace(/\s*problem link\s*:?\s*https?:\/\/\S+\s*/i, " ")
            .trim();
          const r =
            byRound.get(c.rkey) ?? { key: c.rkey, name: c.round, questions: [] };
          r.questions.push({
            text: cleanText,
            originalText: c.question,
            source: "SHEET",
            problemLink: c.extractedLink,
            problemLinkSource: c.extractedLink
              ? /leetcode/i.test(c.extractedLink)
                ? "LEETCODE"
                : "GFG"
              : null,
            normalizedText: normalizeQuestion(cleanText),
            sheetRef: c.ref,
            occurrences: 1,
            latestTs: c.ts,
          });
          byRound.set(c.rkey, r);
        }
        for (const r of byRound.values()) {
          r.questions = capRound(dedupeWithin(r.questions), MAX_QUESTIONS_PER_ROUND, nowTs);
        }

        // Readability pass over the surviving unique questions only.
        const rounds = [...byRound.values()];
        if (hasLlm()) {
          const flat: { id: number; text: string; ref: [number, number] }[] = [];
          rounds.forEach((r, ri) =>
            r.questions.forEach((q, qi) => flat.push({ id: flat.length, text: q.text, ref: [ri, qi] })),
          );
          const improved = await improveReadability(
            flat.map((f) => ({ id: f.id, text: f.text })),
            ctx,
            meta,
          );
          for (const f of flat) {
            const imp = improved.get(f.id);
            if (imp) {
              const q = rounds[f.ref[0]].questions[f.ref[1]];
              q.text = imp;
              q.normalizedText = normalizeQuestion(imp);
            }
          }
        }

        await assertUnderBudget(job, packet);
        await save(
          jobId,
          {
            ...scratch,
            sheetRounds: rounds,
            coveredTopics: dedupeStrings(
              kept.flatMap((c) => [c.relatedTopic, c.relatedModule]).filter(Boolean),
            ),
          },
          next(step),
        );
        return next(step);
      }

      case "WEB_RESEARCH": {
        const sheetRounds = scratch.sheetRounds ?? [];
        if (packet.sourceMode !== "SHEET_PLUS_WEB" || !hasLlm()) {
          await save(jobId, { ...scratch, draftRounds: sheetRounds, webNote: "skipped" }, "MERGE");
          return "MERGE";
        }
        const web = await webResearch(ctx, meta);
        const webRounds: DraftRound[] = web.grounded
          ? web.rounds.map((r) => ({
              key: roundKey(r.name),
              name: r.name,
              duration: r.duration || null,
              questions: r.questions.map((q) => ({
                text: q,
                originalText: q,
                source: "WEB" as const,
                problemLink: null,
                problemLinkSource: null,
                normalizedText: normalizeQuestion(q),
                sheetRef: null,
                occurrences: 1,
                latestTs: Date.now(),
              })),
            }))
          : [];
        await log(
          job,
          web.grounded
            ? `Web research added ${webRounds.reduce((n, r) => n + r.questions.length, 0)} questions.`
            : `Web research not grounded: ${web.note}`,
        );
        await assertUnderBudget(job, packet);
        await save(
          jobId,
          { ...scratch, sheetRounds, draftRounds: mergeRoundLists(sheetRounds, webRounds), webNote: web.note },
          next(step),
          { webFound: webRounds.reduce((n, r) => n + r.questions.length, 0) },
        );
        return next(step);
      }

      case "MERGE": {
        const incoming = scratch.draftRounds ?? scratch.sheetRounds ?? [];
        const nowTs = Date.now();

        const [existingRounds, existingQ, suppressedQ] = await Promise.all([
          job.kind === "APPEND"
            ? db.round.findMany({
                where: { packetId: packet.id },
                select: {
                  sheetKey: true,
                  name: true,
                  _count: { select: { questions: { where: { status: "ACTIVE" } } } },
                },
              })
            : Promise.resolve([] as { sheetKey: string | null; name: string; _count: { questions: number } }[]),
          job.kind === "APPEND"
            ? db.question.findMany({
                where: { packetId: packet.id, status: "ACTIVE" },
                select: { normalizedText: true },
              })
            : Promise.resolve([] as { normalizedText: string }[]),
          db.suppressedQuestion.findMany({
            where: { packetId: packet.id },
            select: { normalizedText: true },
          }),
        ]);

        const existingCountByKey = new Map<string, number>();
        for (const r of existingRounds) {
          existingCountByKey.set(r.sheetKey ?? roundKey(r.name), r._count.questions);
        }
        const blockList = [
          ...existingQ.map((e) => e.normalizedText),
          ...suppressedQ.map((s) => s.normalizedText),
        ];

        // Combine sheet + web rounds that share a key.
        const byKey = new Map<string, DraftRound>();
        for (const round of incoming) {
          const m = byKey.get(round.key);
          if (m) m.questions.push(...round.questions);
          else byKey.set(round.key, { ...round, questions: [...round.questions] });
        }

        const accepted: string[] = [];
        const borderline: { rkey: string; q: DraftQuestion; against: string }[] = [];
        const out: DraftRound[] = [];

        for (const round of [...byKey.values()].sort(
          (a, b) => roundKeyOrder(a.key) - roundKeyOrder(b.key),
        )) {
          // Collapse dups within the round (sheet+web), summing occurrences.
          let qs = dedupeWithin(round.questions);

          // Drop anything already in the packet / suppressed / used in an earlier round.
          qs = qs.filter((q) => {
            let verdict: "keep" | "drop" | "maybe" = "keep";
            for (const other of [...blockList, ...accepted]) {
              const sim = questionSimilarity(q.normalizedText, other);
              if (sim >= 0.85) {
                verdict = "drop";
                break;
              }
              if (sim >= 0.6) verdict = "maybe";
            }
            if (verdict === "drop") return false;
            if (verdict === "maybe" && borderline.length < 30) {
              const closest = [...blockList, ...accepted].sort(
                (a, b) =>
                  questionSimilarity(q.normalizedText, b) - questionSimilarity(q.normalizedText, a),
              )[0];
              borderline.push({ rkey: round.key, q, against: closest });
            }
            return true;
          });

          // Cap: top 50 per round (INITIAL) or fill remaining slots (APPEND).
          const limit =
            job.kind === "APPEND"
              ? MAX_QUESTIONS_PER_ROUND - (existingCountByKey.get(round.key) ?? 0)
              : MAX_QUESTIONS_PER_ROUND;
          qs = capRound(qs, limit, nowTs);
          qs.forEach((q) => accepted.push(q.normalizedText));
          if (qs.length) out.push({ ...round, questions: qs });
        }

        if (borderline.length && hasLlm()) {
          const verdicts = await sameQuestionBatch(
            borderline.map((b) => ({
              a: b.q.text,
              b: reverseLookup(incoming, b.against) ?? b.against,
            })),
            meta,
          );
          const remove = new Set<string>();
          borderline.forEach((b, i) => {
            if (verdicts[i]) remove.add(`${b.rkey}::${b.q.normalizedText}`);
          });
          for (const r of out) {
            r.questions = r.questions.filter((q) => !remove.has(`${r.key}::${q.normalizedText}`));
          }
        }

        const draftRounds = out.filter((r) => r.questions.length);
        const total = draftRounds.reduce((n, r) => n + r.questions.length, 0);
        await assertUnderBudget(job, packet);
        await save(jobId, { ...scratch, draftRounds }, next(step), { added: total });
        await log(
          job,
          `Merged into ${draftRounds.length} rounds, ${total} new questions (max ${MAX_QUESTIONS_PER_ROUND}/round, ranked by repeats + recency).`,
        );
        return next(step);
      }

      case "NAME_ROUNDS": {
        const draftRounds = scratch.draftRounds ?? [];
        if (hasLlm() && draftRounds.length) {
          const names = await nameRounds(draftRounds, ctx, meta);
          draftRounds.forEach((r, i) => {
            const inferred = names.get(r.key);
            if (inferred) {
              r.name = inferred.name;
              r.duration = inferred.duration;
            } else if (/^r\d+$/i.test(r.name.trim())) {
              r.name = `Round ${i + 1}`;
            }
          });
        } else {
          draftRounds.forEach((r, i) => {
            if (/^r\d+$/i.test(r.name.trim())) r.name = `Round ${i + 1}`;
          });
        }
        await assertUnderBudget(job, packet);
        await save(jobId, { ...scratch, draftRounds }, next(step));
        return next(step);
      }

      case "JD_SPILLOVER": {
        const draftRounds = scratch.draftRounds ?? [];
        let jdSummary = scratch.jdSummary ?? "";
        if (packet.jdText && hasLlm()) {
          const covered = dedupeStrings([
            ...(scratch.coveredTopics ?? []),
            ...draftRounds.flatMap((r) => r.questions.slice(0, 3).map((q) => q.text.slice(0, 80))),
          ]);
          const spill = await jdSpillover(ctx, covered, meta);
          jdSummary = spill.jdSummary;
          if (spill.missingTechs.length) {
            const questions = spill.missingTechs.flatMap((t) =>
              t.questions.map((q) => ({
                text: `[${t.tech}] ${q}`,
                originalText: q,
                source: "JD_SPILLOVER" as const,
                problemLink: null,
                problemLinkSource: null,
                normalizedText: normalizeQuestion(q),
                sheetRef: null,
                occurrences: 1,
                latestTs: Date.now(),
              })),
            );
            draftRounds.push({
              key: "jd-spillover",
              name: "Frequently Asked Question Based on JD",
              duration: null,
              isSpillover: true,
              questions: questions.slice(0, MAX_QUESTIONS_PER_ROUND),
            });
          }
          await log(job, `JD spillover: ${spill.missingTechs.map((t) => t.tech).join(", ") || "none"}.`);
        }
        await assertUnderBudget(job, packet);
        await save(jobId, { ...scratch, draftRounds, jdSummary }, next(step), {
          spillover: draftRounds.find((r) => r.isSpillover)?.questions.length ?? 0,
        });
        return next(step);
      }

      case "PROBLEM_LINKS": {
        const draftRounds = scratch.draftRounds ?? [];
        // Billed web searches — only for Sheet+Web packets, and only when the admin
        // left a practice source (LeetCode / GfG) enabled. Sheet-only packets can
        // still fetch a link per question with "Auto-find" in the editor.
        const linkDomains =
          packet.sourceMode === "SHEET_PLUS_WEB" ? practiceDomains(packet.webSources) : [];
        if (hasLlm() && linkDomains.length) {
          const targets: { id: number; text: string; ref: [number, number] }[] = [];
          draftRounds.forEach((r, ri) => {
            r.questions.forEach((q, qi) => {
              if (!q.problemLink && looksLikeCodingProblem(q.text)) {
                targets.push({ id: targets.length, text: q.text, ref: [ri, qi] });
              }
            });
          });
          if (targets.length) {
            const links = await findProblemLinks(
              targets.map((t) => ({ id: t.id, text: t.text })),
              { ...meta, domains: linkDomains },
            );
            for (const l of links) {
              if (!l.url) continue;
              const t = targets[l.id];
              if (!t) continue;
              const q = draftRounds[t.ref[0]].questions[t.ref[1]];
              q.problemLink = l.url;
              q.problemLinkSource = l.source ?? (/leetcode/i.test(l.url) ? "LEETCODE" : "GFG");
            }
          }
        }
        await assertUnderBudget(job, packet);
        await save(jobId, { ...scratch, draftRounds }, next(step));
        return next(step);
      }

      case "FINALIZE": {
        await finalize(job, packet, scratch);
        await db.generationJob.update({
          where: { id: jobId },
          data: {
            status: "SUCCEEDED",
            step: "DONE",
            progress: 100,
            stepLabel: "Done",
            finishedAt: new Date(),
          },
        });
        await log(job, "Packet saved.");
        return "DONE";
      }

      default:
        return "DONE";
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Best-effort: commit whatever rounds/questions the run had already
    // produced (and paid for) before it failed, so a budget/rate-limit error
    // doesn't throw away real progress. Only safe once `draftRounds` has been
    // through MERGE's de-dupe pass — see PARTIAL_SAVE_STEPS.
    let partialSaved = 0;
    if (PARTIAL_SAVE_STEPS.has(step)) {
      const draftRounds = (scratch.draftRounds ?? []).filter((r) => r.questions.length);
      partialSaved = draftRounds.reduce((n, r) => n + r.questions.length, 0);
      if (partialSaved) {
        try {
          await finalize(job, packet, scratch);
        } catch {
          partialSaved = 0;
        }
      }
    }

    await db.generationJob.update({
      where: { id: jobId },
      data: { status: "FAILED", error: message, stepLabel: `Failed: ${STEP_LABEL[step]}` },
    });
    await log(
      job,
      partialSaved
        ? `ERROR: ${message} — kept ${partialSaved} question${partialSaved === 1 ? "" : "s"} generated before the failure.`
        : `ERROR: ${message}`,
    );
    throw err;
  }
}

async function save(
  jobId: string,
  scratch: Scratch,
  step: JobStep,
  statsPatch?: Record<string, number>,
) {
  const job = await db.generationJob.findUniqueOrThrow({ where: { id: jobId }, select: { stats: true } });
  await db.generationJob.update({
    where: { id: jobId },
    data: {
      scratch: scratch as unknown as object,
      step,
      progress: STEP_PROGRESS[step] - 2,
      stats: { ...((job.stats as object) ?? {}), ...(statsPatch ?? {}) },
    },
  });
}

async function finalize(job: GenerationJob, packet: Packet, scratch: Scratch) {
  const draftRounds = (scratch.draftRounds ?? []).filter((r) => r.questions.length);

  await db.$transaction(
    async (tx) => {
    const existingRounds = await tx.round.findMany({
      where: { packetId: packet.id },
      include: { questions: { select: { id: true, normalizedText: true, problemLink: true } } },
    });
    const byKey = new Map(existingRounds.map((r) => [r.sheetKey ?? roundKey(r.name), r]));
    let orderBase = existingRounds.length;

    for (const dr of draftRounds) {
      let round = byKey.get(dr.key);
      if (!round) {
        round = await tx.round.create({
          data: {
            packetId: packet.id,
            order: dr.isSpillover ? 900 : orderBase++,
            name: dr.name,
            duration: dr.duration ?? null,
            isSpillover: Boolean(dr.isSpillover),
            sheetKey: dr.key,
            questions: undefined,
          },
          include: { questions: { select: { id: true, normalizedText: true, problemLink: true } } },
        });
        byKey.set(dr.key, round);
      } else if (job.kind === "INITIAL") {
        await tx.round.update({
          where: { id: round.id },
          data: { name: dr.name, duration: dr.duration ?? null },
        });
      }

      // finalize() can run twice for the same draft rounds — once as a
      // best-effort partial save on failure, once more on a later successful
      // retry — so skip questions already inserted (matched by normalized
      // text) instead of re-creating them. Still backfill a problem link a
      // prior partial save didn't have yet.
      const existingByText = new Map(round.questions.map((q) => [q.normalizedText, q]));
      const newQuestions: DraftQuestion[] = [];
      for (const q of dr.questions) {
        const existing = existingByText.get(q.normalizedText);
        if (existing) {
          if (!existing.problemLink && q.problemLink) {
            await tx.question.update({
              where: { id: existing.id },
              data: { problemLink: q.problemLink, problemLinkSource: q.problemLinkSource ?? null },
            });
          }
          continue;
        }
        newQuestions.push(q);
      }

      const startOrder = round.questions.length;
      if (newQuestions.length) {
        await tx.question.createMany({
          data: newQuestions.map((q, i) => ({
            packetId: packet.id,
            roundId: round!.id,
            order: startOrder + i,
            source: q.source,
            originalText: q.originalText,
            improvedText: q.text,
            displayText: q.text,
            problemLink: q.problemLink ?? null,
            problemLinkSource: q.problemLinkSource ?? null,
            normalizedText: q.normalizedText,
            sheetRef: (q.sheetRef ?? undefined) as object | undefined,
            occurrences: q.occurrences ?? 1,
            lastAskedAt: q.latestTs ? new Date(q.latestTs) : null,
          })),
        });
      }
    }

      await tx.packet.update({
        where: { id: packet.id },
        data: {
          lastGeneratedAt: new Date(),
          lastSheetRowDate: scratch.maxSheetTs
            ? new Date(scratch.maxSheetTs)
            : packet.lastSheetRowDate,
          jdSummary: scratch.jdSummary || packet.jdSummary,
        },
      });
    },
    { timeout: 20000 },
  );
}

// --- helpers ---------------------------------------------------------------

function dedupeStrings(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}

function mergeRoundLists(a: DraftRound[], b: DraftRound[]): DraftRound[] {
  const byKey = new Map<string, DraftRound>();
  for (const r of [...a, ...b]) {
    const cur = byKey.get(r.key);
    if (cur) {
      cur.questions.push(...r.questions);
      if (!cur.duration && r.duration) cur.duration = r.duration;
    } else {
      byKey.set(r.key, { ...r, questions: [...r.questions] });
    }
  }
  return [...byKey.values()];
}

function reverseLookup(rounds: DraftRound[], normalized: string): string | null {
  for (const r of rounds) {
    for (const q of r.questions) if (q.normalizedText === normalized) return q.text;
  }
  return null;
}

export { STEP_LABEL, looksClean };
