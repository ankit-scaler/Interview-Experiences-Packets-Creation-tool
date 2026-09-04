/** Extract plain text from an uploaded JD file (pdf / docx / txt). */
export async function parseJdFile(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return buffer.toString("utf8");
  }
  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const res = await mammoth.extractRawText({ buffer });
    return res.value;
  }
  if (lower.endsWith(".pdf")) {
    // Import the inner module directly — pdf-parse's index.js has a debug block
    // that tries to read a bundled test PDF at import time.
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as (
      b: Buffer,
    ) => Promise<{ text: string }>;
    const res = await pdfParse(buffer);
    return res.text;
  }
  throw new Error("Unsupported JD file type. Upload a .pdf, .docx, or .txt file.");
}

export function cleanJdText(s: string): string {
  return s.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 12000);
}
