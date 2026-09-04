import { db } from "@/lib/db";
import type { LlmPurpose } from "@prisma/client";
import { costUsd, type TokenUsage } from "./pricing";

/**
 * Record one LLM call's token usage + cost and roll it up into the parent
 * GenerationJob and Packet. Returns the computed cost.
 */
export async function recordLlmCall(opts: {
  purpose: LlmPurpose;
  model: string;
  usage: TokenUsage;
  jobId?: string | null;
  packetId?: string | null;
}): Promise<number> {
  const cost = costUsd(opts.model, opts.usage);
  const { inputTokens, outputTokens, cachedInputTokens } = opts.usage;
  const webSearchRequests = opts.usage.webSearchRequests ?? 0;

  await db.llmCall.create({
    data: {
      purpose: opts.purpose,
      model: opts.model,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      webSearchRequests,
      costUsd: cost,
      jobId: opts.jobId ?? undefined,
      packetId: opts.packetId ?? undefined,
    },
  });

  if (opts.jobId) {
    await db.generationJob.update({
      where: { id: opts.jobId },
      data: {
        inputTokens: { increment: inputTokens },
        outputTokens: { increment: outputTokens },
        cachedInputTokens: { increment: cachedInputTokens },
        costUsd: { increment: cost },
      },
    });
  }
  if (opts.packetId) {
    await db.packet.update({
      where: { id: opts.packetId },
      data: { lifetimeCostUsd: { increment: cost } },
    });
  }
  return cost;
}

/** Sum of LlmCall costs already booked to a job — used for the cost ceiling. */
export async function jobSpendSoFar(jobId: string): Promise<number> {
  const agg = await db.llmCall.aggregate({
    where: { jobId },
    _sum: { costUsd: true },
  });
  return agg._sum.costUsd ?? 0;
}
