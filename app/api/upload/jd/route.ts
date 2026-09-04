import { apiError, guardAdmin, json } from "@/lib/api";
import { cleanJdText, parseJdFile } from "@/lib/jd-parse";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return apiError("No file uploaded");
  if (file.size > 5 * 1024 * 1024) return apiError("File too large (max 5 MB)");

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const raw = await parseJdFile(buffer, file.name);
    const text = cleanJdText(raw);
    if (!text) return apiError("Could not extract any text from that file.");
    return json({ text, fileName: file.name });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Failed to parse file");
  }
}
