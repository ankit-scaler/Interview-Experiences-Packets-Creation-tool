import type { Track } from "@prisma/client";
import { db } from "./db";
import { getRepoRows } from "./sheets/repo";
import { normalizeCompany, normalizeRole } from "./normalize";

export interface CompanySuggestion {
  company: string;
  companyNorm: string;
  roles: string[];
}

export interface SuggestPayload {
  companies: CompanySuggestion[];
  existing: {
    company: string;
    role: string;
    companyNorm: string;
    roleNorm: string;
    yoeBucket: string;
    slug: string;
  }[];
}

/**
 * Company + role suggestions for the create form, drawn from the question sheet
 * (cached snapshot) and existing packets — so admins reuse the same names and
 * land on the same packet instead of making near-duplicates.
 */
export async function getSuggestions(track: Track): Promise<SuggestPayload> {
  const [rows, packets] = await Promise.all([
    getRepoRows(track).catch(() => []),
    db.packet.findMany({
      where: { track },
      select: {
        company: true,
        role: true,
        companyNorm: true,
        roleNorm: true,
        yoeBucket: true,
        slug: true,
      },
    }),
  ]);

  const map = new Map<string, { company: string; roles: Map<string, string> }>();
  const add = (company: string, role: string) => {
    const ck = normalizeCompany(company || "");
    if (!ck) return;
    const entry = map.get(ck) ?? { company: (company || "").trim(), roles: new Map() };
    const rk = normalizeRole(role || "");
    if (rk && !entry.roles.has(rk)) entry.roles.set(rk, (role || "").trim());
    map.set(ck, entry);
  };

  for (const r of rows) add(r.company, r.role);
  for (const p of packets) add(p.company, p.role);

  return {
    companies: [...map.entries()]
      .map(([companyNorm, e]) => ({
        company: e.company,
        companyNorm,
        roles: [...e.roles.values()].filter(Boolean).sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.company.localeCompare(b.company)),
    existing: packets.map((p) => ({
      company: p.company,
      role: p.role,
      companyNorm: p.companyNorm,
      roleNorm: p.roleNorm,
      yoeBucket: p.yoeBucket,
      slug: p.slug,
    })),
  };
}
