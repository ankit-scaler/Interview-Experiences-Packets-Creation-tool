import { guardAdmin, json } from "@/lib/api";
import { syncAll } from "@/lib/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;
  const results = await syncAll();
  return json({ results });
}
