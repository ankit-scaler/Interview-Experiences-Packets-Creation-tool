import { z } from "zod";
import { apiError, guardAdmin, json } from "@/lib/api";
import { findOrCreatePacket, startGenerationJob } from "@/lib/generation/create";
import { ALL_SOURCE_IDS } from "@/lib/web-sources";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

const Body = z.object({
  track: z.enum(["ACADEMY", "DEVOPS", "AIML", "DSML"]),
  company: z.string().min(2).max(120),
  role: z.string().min(2).max(120),
  yoeBucket: z.enum(["LT2", "B2_5", "GT5"]),
  stack: z.string().max(120).optional(),
  location: z.string().max(80).optional(),
  jdText: z.string().max(20000).optional(),
  jdFileName: z.string().max(200).optional(),
  sourceMode: z.enum(["SHEET_ONLY", "SHEET_PLUS_WEB"]),
  webSources: z.array(z.enum(ALL_SOURCE_IDS as [string, ...string[]])).optional(),
  allowHigherCost: z.boolean().optional(),
});

export async function POST(req: Request) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const { packet, created } = await findOrCreatePacket(parsed.data, guard.user.id);
  const jobStarted = await startGenerationJob(packet.id, guard.user.id);
  await logActivity({
    actorEmail: guard.user.email,
    // An existing packet reached through Create is an append, not a creation.
    action: created ? "PACKET_CREATED" : "GENERATION_STARTED",
    packet,
    detail: `${parsed.data.track} · ${parsed.data.yoeBucket} · ${parsed.data.sourceMode}`,
  });

  return json({
    packetId: packet.id,
    slug: packet.slug,
    jobId: jobStarted.id,
    created,
  });
}
