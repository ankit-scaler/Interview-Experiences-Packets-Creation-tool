import { z } from "zod";
import { apiError, guardAdmin, json } from "@/lib/api";
import { getSuggestions } from "@/lib/suggest";

export const runtime = "nodejs";
export const maxDuration = 30;

const Track = z.enum(["ACADEMY", "DEVOPS", "AIML", "DSML"]);

export async function GET(req: Request) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;

  const parsed = Track.safeParse(new URL(req.url).searchParams.get("track"));
  if (!parsed.success) return apiError("Invalid track");

  const data = await getSuggestions(parsed.data);
  return json(data, {
    headers: { "Cache-Control": "private, max-age=120" },
  });
}
