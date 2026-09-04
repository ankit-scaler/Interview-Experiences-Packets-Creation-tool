function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(cell).join(",")];
  for (const r of rows) lines.push(r.map(cell).join(","));
  return lines.join("\n");
}

/** Multi-section CSV bundle (one file, blank line between sections). */
export function toCsvBundle(sections: { title: string; headers: string[]; rows: unknown[][] }[]): string {
  return sections
    .map((s) => `# ${s.title}\n${toCsv(s.headers, s.rows)}`)
    .join("\n\n");
}
