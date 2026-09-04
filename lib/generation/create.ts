import type { SourceMode, Track, YoeBucket } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeCompany, normalizeRole } from "@/lib/normalize";
import { makePacketSlug } from "@/lib/slug";
import { runStep } from "./runner";

export interface CreatePacketInput {
  track: Track;
  company: string;
  role: string;
  yoeBucket: YoeBucket;
  stack?: string;
  location?: string;
  jdText?: string;
  jdFileName?: string;
  sourceMode: SourceMode;
  webSources?: string[];
  allowHigherCost?: boolean;
}

/**
 * Idempotent per (track, company, role, yoe): returns the existing packet if one
 * matches, otherwise creates a DRAFT. `created` tells the caller which happened.
 */
export async function findOrCreatePacket(input: CreatePacketInput, userId: string) {
  const companyNorm = normalizeCompany(input.company);
  const roleNorm = normalizeRole(input.role);

  const existing = await db.packet.findUnique({
    where: {
      track_companyNorm_roleNorm_yoeBucket: {
        track: input.track,
        companyNorm,
        roleNorm,
        yoeBucket: input.yoeBucket,
      },
    },
  });

  if (existing) {
    // Refresh request-level inputs that can legitimately change on a re-run.
    const updated = await db.packet.update({
      where: { id: existing.id },
      data: {
        stack: input.stack || existing.stack,
        sourceMode: input.sourceMode,
        webSources: input.webSources ?? existing.webSources,
        jdText: input.jdText ?? existing.jdText,
        jdFileName: input.jdFileName ?? existing.jdFileName,
        allowHigherCost: input.allowHigherCost ?? existing.allowHigherCost,
      },
    });
    return { packet: updated, created: false };
  }

  const slug = await makePacketSlug({
    company: input.company,
    role: input.role,
    track: input.track,
    yoeBucket: input.yoeBucket,
  });

  const packet = await db.packet.create({
    data: {
      slug,
      track: input.track,
      company: input.company.trim(),
      companyNorm,
      role: input.role.trim(),
      roleNorm,
      yoeBucket: input.yoeBucket,
      stack: input.stack?.trim() || null,
      location: input.location?.trim() || "India",
      jdText: input.jdText || null,
      jdFileName: input.jdFileName || null,
      sourceMode: input.sourceMode,
      webSources: input.webSources ?? [],
      allowHigherCost: input.allowHigherCost ?? false,
      createdById: userId,
    },
  });
  return { packet, created: true };
}

/** Create a fresh generation job for a packet (INITIAL if empty, else APPEND). */
export async function startGenerationJob(packetId: string, userId: string) {
  const count = await db.question.count({ where: { packetId } });
  const running = await db.generationJob.findFirst({
    where: { packetId, status: { in: ["PENDING", "RUNNING"] } },
  });
  if (running) return running;

  return db.generationJob.create({
    data: {
      packetId,
      kind: count > 0 ? "APPEND" : "INITIAL",
      status: "PENDING",
      step: "LOAD_SHEET",
      stepLabel: "Queued",
      triggeredById: userId,
    },
  });
}

/** Drive a job to completion in-process (dev / cron / tests). */
export async function runJobToCompletion(jobId: string, maxSteps = 12) {
  for (let i = 0; i < maxSteps; i++) {
    // eslint-disable-next-line no-await-in-loop
    const step = await runStep(jobId);
    if (step === "DONE") return;
  }
}
