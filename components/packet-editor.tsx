"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trash2,
  ExternalLink,
  Wand2,
  Plus,
  RefreshCw,
  Eye,
  EyeOff,
  Loader2,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CopyLinkButton } from "@/components/copy-link-button";
import { GenerationProgress } from "@/components/generation-progress";
import { TRACK_LABEL, YOE_LABEL } from "@/lib/labels";
import { formatUsd, formatDateTime } from "@/lib/utils";

type QSource = "SHEET" | "WEB" | "JD_SPILLOVER" | "MANUAL";

interface QData {
  id: string;
  source: QSource;
  originalText: string;
  improvedText: string;
  displayText: string;
  editedByAdmin: boolean;
  problemLink: string | null;
  problemLinkSource: string | null;
  occurrences: number;
  lastAskedAt: string | null;
}
interface RData {
  id: string;
  name: string;
  duration: string | null;
  isSpillover: boolean;
  questions: QData[];
}
interface PData {
  id: string;
  slug: string;
  company: string;
  role: string;
  track: "ACADEMY" | "DEVOPS" | "AIML" | "DSML";
  yoeBucket: "LT2" | "B2_5" | "GT5";
  stack: string | null;
  location: string;
  status: "DRAFT" | "PUBLISHED";
  sourceMode: "SHEET_ONLY" | "SHEET_PLUS_WEB";
  allowHigherCost: boolean;
  jdSummary: string | null;
  lifetimeCostUsd: number;
  lastGeneratedAt: string | null;
  costByPurpose: Record<string, number>;
  rounds: RData[];
}

const SOURCE_BADGE: Record<QSource, { label: string; variant: "secondary" | "default" | "outline" }> = {
  SHEET: { label: "Sheet", variant: "secondary" },
  WEB: { label: "Web", variant: "default" },
  JD_SPILLOVER: { label: "JD", variant: "outline" },
  MANUAL: { label: "Manual", variant: "outline" },
};

// Only this admin sees the cost-limit override control — everyone else hits
// the normal per-packet budget ceiling (see lib/generation/runner.ts).
const COST_OVERRIDE_EMAIL = "ankit.mishra@scaler.com";

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || `${method} ${url} failed`);
  }
  return res.json().catch(() => ({}));
}

export function PacketEditor({
  packet,
  appUrl,
  llmReady,
  initialJobActive,
  viewerEmail,
}: {
  packet: PData;
  appUrl: string;
  llmReady: boolean;
  initialJobActive: boolean;
  viewerEmail?: string | null;
}) {
  const router = useRouter();
  const [rounds, setRounds] = useState(packet.rounds);
  const [status, setStatus] = useState(packet.status);
  const [allowHigherCost, setAllowHigherCost] = useState(packet.allowHigherCost);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canOverrideCost = viewerEmail?.toLowerCase() === COST_OVERRIDE_EMAIL;

  const learnerUrl = `${appUrl.replace(/\/$/, "")}/p/${packet.slug}`;
  const questionCount = useMemo(
    () => rounds.reduce((n, r) => n + r.questions.length, 0),
    [rounds],
  );

  function patchRound(id: string, patch: Partial<RData>) {
    setRounds((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function patchQuestion(rid: string, qid: string, patch: Partial<QData>) {
    setRounds((rs) =>
      rs.map((r) =>
        r.id === rid
          ? { ...r, questions: r.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) }
          : r,
      ),
    );
  }

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/packets" className="text-xs text-muted-foreground hover:underline">
            ← All packets
          </Link>
          <h1 className="mt-1 text-lg font-semibold">
            {packet.company} — {packet.role}
          </h1>
          <p className="text-xs text-muted-foreground">
            {TRACK_LABEL[packet.track]} · {YOE_LABEL[packet.yoeBucket]}
            {packet.stack ? ` · ${packet.stack}` : ""} · {packet.location} ·{" "}
            {packet.sourceMode === "SHEET_PLUS_WEB" ? "Sheet + web" : "Sheet only"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status === "PUBLISHED" ? (
            <Badge variant="success">Published</Badge>
          ) : (
            <Badge variant="warning">Draft</Badge>
          )}
          <CopyLinkButton url={learnerUrl} disabled={status !== "PUBLISHED"} />
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() =>
              run("regen", async () => {
                try {
                  await api(`/api/packets/${packet.id}/regenerate`, "POST");
                } finally {
                  // Refresh either way: on success to pick up the new job, on
                  // failure so a since-deleted packet resolves to a 404 page.
                  router.refresh();
                }
              })
            }
          >
            <RefreshCw className="h-4 w-4" />
            Pull new questions
          </Button>
          {canOverrideCost && (
            <Button
              variant={allowHigherCost ? "secondary" : "outline"}
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                run("costLimit", async () => {
                  const next = !allowHigherCost;
                  await api(`/api/packets/${packet.id}`, "PATCH", { allowHigherCost: next });
                  setAllowHigherCost(next);
                })
              }
            >
              <Gauge className="h-4 w-4" />
              {allowHigherCost ? "Cost limit: raised" : "Go past cost limit"}
            </Button>
          )}
          <Button
            size="sm"
            variant={status === "PUBLISHED" ? "secondary" : "default"}
            disabled={busy !== null}
            onClick={() =>
              run("publish", async () => {
                const next = status === "PUBLISHED" ? false : true;
                const d = await api(`/api/packets/${packet.id}/publish`, "POST", { publish: next });
                setStatus(d.status);
              })
            }
          >
            {status === "PUBLISHED" ? (
              <>
                <EyeOff className="h-4 w-4" />
                Unpublish
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                Publish
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy !== null}
            onClick={() =>
              run("delete", async () => {
                if (!confirm("Delete this packet permanently?")) return;
                await api(`/api/packets/${packet.id}`, "DELETE");
                router.push("/packets");
              })
            }
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <GenerationProgress packetId={packet.id} initialActive={initialJobActive} />

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Admin-only metadata */}
      <details className="rounded-lg border border-border bg-card p-4 text-sm" open>
        <summary className="cursor-pointer font-medium">Packet info (admin only)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Questions</p>
            <p>
              {questionCount} across {rounds.length} rounds
            </p>
            <ul className="mt-1 text-xs text-muted-foreground">
              {rounds.map((r) => (
                <li key={r.id}>
                  {r.name}: {r.questions.length}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">LLM cost (lifetime)</p>
            <p>{formatUsd(packet.lifetimeCostUsd)}</p>
            <ul className="mt-1 text-xs text-muted-foreground">
              {Object.entries(packet.costByPurpose).map(([k, v]) => (
                <li key={k}>
                  {k.toLowerCase().replace(/_/g, " ")}: {formatUsd(v)}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted-foreground">
              Last generated: {formatDateTime(packet.lastGeneratedAt)}
            </p>
          </div>
          {packet.jdSummary && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">JD summary</p>
              <p className="text-sm">{packet.jdSummary}</p>
            </div>
          )}
        </div>
      </details>

      {/* Rounds */}
      <div className="space-y-4">
        {rounds.map((round) => (
          <RoundBlock
            key={round.id}
            round={round}
            llmReady={llmReady}
            onRoundPatch={(patch) => patchRound(round.id, patch)}
            onQuestionPatch={(qid, patch) => patchQuestion(round.id, qid, patch)}
            onRoundDeleted={() => setRounds((rs) => rs.filter((r) => r.id !== round.id))}
            onQuestionRemoved={(qid) =>
              patchRound(round.id, {
                questions: round.questions.filter((q) => q.id !== qid),
              })
            }
            onQuestionAdded={(q) =>
              patchRound(round.id, { questions: [...round.questions, q] })
            }
          />
        ))}

        <AddRound
          packetId={packet.id}
          onAdded={(r) => setRounds((rs) => [...rs, { ...r, isSpillover: false, questions: [] }])}
        />
      </div>
    </div>
  );
}

function RoundBlock({
  round,
  llmReady,
  onRoundPatch,
  onQuestionPatch,
  onRoundDeleted,
  onQuestionRemoved,
  onQuestionAdded,
}: {
  round: RData;
  llmReady: boolean;
  onRoundPatch: (p: Partial<RData>) => void;
  onQuestionPatch: (qid: string, p: Partial<QData>) => void;
  onRoundDeleted: () => void;
  onQuestionRemoved: (qid: string) => void;
  onQuestionAdded: (q: QData) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <Input
          value={round.name}
          onChange={(e) => onRoundPatch({ name: e.target.value })}
          onBlur={() =>
            api(`/api/rounds/${round.id}`, "PATCH", { name: round.name, duration: round.duration })
          }
          className="h-8 max-w-xs font-medium"
        />
        <Input
          value={round.duration ?? ""}
          onChange={(e) => onRoundPatch({ duration: e.target.value })}
          onBlur={() =>
            api(`/api/rounds/${round.id}`, "PATCH", {
              name: round.name,
              duration: round.duration || null,
            })
          }
          placeholder="Duration"
          className="h-8 w-28"
        />
        {round.isSpillover && <Badge variant="outline">JD spillover</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">
          {round.questions.length} question{round.questions.length === 1 ? "" : "s"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={async () => {
            if (!confirm(`Delete the "${round.name}" round and all its questions?`)) return;
            await api(`/api/rounds/${round.id}`, "DELETE");
            onRoundDeleted();
          }}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </header>

      <ul className="divide-y divide-border">
        {round.questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            index={i + 1}
            q={q}
            llmReady={llmReady}
            onPatch={(p) => onQuestionPatch(q.id, p)}
            onRemoved={() => onQuestionRemoved(q.id)}
          />
        ))}
      </ul>

      <div className="p-3">
        {adding ? (
          <div className="space-y-2">
            <Textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              rows={2}
              placeholder="New question…"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  if (newText.trim().length < 3) return;
                  const d = await api(`/api/rounds/${round.id}/questions`, "POST", {
                    text: newText.trim(),
                  });
                  onQuestionAdded({
                    id: d.question.id,
                    source: "MANUAL",
                    originalText: newText.trim(),
                    improvedText: newText.trim(),
                    displayText: newText.trim(),
                    editedByAdmin: true,
                    problemLink: null,
                    problemLinkSource: null,
                    occurrences: 1,
                    lastAskedAt: null,
                  });
                  setNewText("");
                  setAdding(false);
                }}
              >
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            Add question
          </Button>
        )}
      </div>
    </section>
  );
}

function QuestionCard({
  q,
  index,
  llmReady,
  onPatch,
  onRemoved,
}: {
  q: QData;
  index: number;
  llmReady: boolean;
  onPatch: (p: Partial<QData>) => void;
  onRemoved: () => void;
}) {
  const [text, setText] = useState(q.displayText);
  const [link, setLink] = useState(q.problemLink ?? "");
  const [findingLink, setFindingLink] = useState(false);
  const badge = SOURCE_BADGE[q.source];
  const differs = q.originalText.trim() !== q.improvedText.trim();

  return (
    <li className="space-y-2 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{index}</span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
        {q.occurrences > 1 && (
          <Badge variant="secondary" title="Number of candidates who reported this question">
            asked ×{q.occurrences}
          </Badge>
        )}
        {q.editedByAdmin && <Badge variant="outline">edited</Badge>}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-7 w-7"
          onClick={async () => {
            await api(`/api/questions/${q.id}`, "DELETE");
            onRemoved();
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>

      {differs && (
        <div className="grid gap-2 rounded-md bg-muted/50 p-2 text-xs sm:grid-cols-2">
          <div>
            <p className="mb-1 font-medium text-muted-foreground">Original (sheet)</p>
            <p>{q.originalText}</p>
          </div>
          <div>
            <p className="mb-1 font-medium text-muted-foreground">Improved</p>
            <p>{q.improvedText}</p>
            {text !== q.improvedText && (
              <button
                className="mt-1 underline"
                onClick={() => {
                  setText(q.improvedText);
                  onPatch({ displayText: q.improvedText });
                  api(`/api/questions/${q.id}`, "PATCH", { displayText: q.improvedText });
                }}
              >
                use this
              </button>
            )}
            {text !== q.originalText && (
              <button
                className="ml-2 underline"
                onClick={() => {
                  setText(q.originalText);
                  onPatch({ displayText: q.originalText });
                  api(`/api/questions/${q.id}`, "PATCH", { displayText: q.originalText });
                }}
              >
                use original
              </button>
            )}
          </div>
        </div>
      )}

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text.trim() && text !== q.displayText) {
            onPatch({ displayText: text, editedByAdmin: true });
            api(`/api/questions/${q.id}`, "PATCH", { displayText: text.trim() });
          }
        }}
        rows={2}
        className="text-sm"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onBlur={() => {
            if (link !== (q.problemLink ?? "")) {
              onPatch({ problemLink: link || null });
              api(`/api/questions/${q.id}`, "PATCH", { problemLink: link || "" }).catch(() => {});
            }
          }}
          placeholder="Practice link (LeetCode / GfG / any URL)"
          className="h-8 flex-1 min-w-[180px] text-xs"
        />
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            open
          </a>
        )}
        {llmReady && (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={findingLink}
            onClick={async () => {
              setFindingLink(true);
              try {
                const d = await api(`/api/questions/${q.id}/find-link`, "POST");
                if (d.url) {
                  setLink(d.url);
                  onPatch({ problemLink: d.url });
                }
              } finally {
                setFindingLink(false);
              }
            }}
          >
            {findingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            Auto-find
          </Button>
        )}
      </div>
    </li>
  );
}

function AddRound({ packetId, onAdded }: { packetId: string; onAdded: (r: RData) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add round
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Round name"
        className="h-8 max-w-xs"
      />
      <Input
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        placeholder="Duration"
        className="h-8 w-28"
      />
      <Button
        size="sm"
        onClick={async () => {
          if (!name.trim()) return;
          const res = await fetch(`/api/packets/${packetId}/rounds`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim(), duration: duration || undefined }),
          });
          const d = await res.json();
          onAdded({ id: d.round.id, name: d.round.name, duration: d.round.duration, isSpillover: false, questions: [] });
          setOpen(false);
          setName("");
          setDuration("");
        }}
      >
        Add
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}
