import { db } from "./db";
import type { Track, YoeBucket } from "@prisma/client";

const YOE_SLUG: Record<YoeBucket, string> = { LT2: "0-2y", B2_5: "2-5y", GT5: "5y-plus" };

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Deterministic-ish, human-readable, collision-checked packet slug. */
export async function makePacketSlug(input: {
  company: string;
  role: string;
  track: Track;
  yoeBucket: YoeBucket;
}): Promise<string> {
  const base = [
    slugify(input.company),
    slugify(input.role),
    YOE_SLUG[input.yoeBucket],
  ]
    .filter(Boolean)
    .join("-");

  let slug = base || "packet";
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await db.packet.findUnique({ where: { slug }, select: { id: true } })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}
