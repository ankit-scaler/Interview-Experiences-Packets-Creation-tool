# Preparatory Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins paste a "Preparatory Kit" (HackMD markdown) per packet, show it to learners as the first, deep-linkable item above R1, track kit reads separately, and widen the learner reading page.

**Architecture:** A nullable `Packet.prepMaterial` markdown column (like `addOns`) plus a new `PrepRead` table. Pure helpers live in `lib/prep.ts` (unit tested). Learner `PacketReader` gets a kit view (`#prep`) rendered with the existing `Markdown`; a `PrepTracker` client component posts time + furthest-scroll to a new `/api/p/[slug]/prep` route. Admin tracking gets a `prep-kit` report, dashboard panel and CSV (not mirrored to Sheets).

**Tech Stack:** Next.js 14 (app router), Prisma 6 + Postgres (Neon), react-markdown, Tailwind, vitest, zod.

**Spec:** `docs/superpowers/specs/2026-11-17-preparatory-kit-design.md`

## Global Constraints

- **Never push, tag, open PRs, deploy, or apply migrations to any real DB.** Local commits only, and only after the user approves each commit (every "Commit" step below = ask first).
- Never read/print `.env`. For `prisma validate` pass dummy URLs on the command line.
- No new dependencies (no `remark-gfm`). Markdown tables/task lists stay unsupported.
- All colours via existing Tailwind tokens (`bg-card`, `text-muted-foreground`, …); no hardcoded colours.
- Every async click shows a loading state; buttons disable while busy (use `Button loading`).
- Internal `@scaler.com` emails must never create kit-read rows (reuse `isInternalEmail` / `NOT_INTERNAL`).
- `ReadTracker`, `PacketRead` and round-progress maths must remain untouched by the kit.
- Learner width: container `max-w-[1440px]`; rail stays `210px`; kit prose capped at `max-w-[88ch]`.
- Spec: Sheet sync (`lib/sync.ts` `TAB_FOR`) is NOT changed.

## Review Focus

1. Published packet with a kit but **zero rounds** → learner page shows the kit (not "No questions in this packet yet"). Pinned in Task 4 step list (manual) and by `parseReaderHash` tests with `roundCount = 0`.
2. URL hash `#prep` on a packet **without** a kit, `#r9` out of range, or junk hash → falls back to default view, no crash. Pinned by `parseReaderHash` tests (Task 1).
3. Kit shorter than the viewport, or zero-height element → scroll % is 100 / 0 (never NaN, never >100). Pinned by `scrollSeenPct` tests (Task 1).
4. Kit API: unauthenticated → 401, `@scaler.com` → no row, unpublished or kit-less packet → `ok:false`, garbage / negative / NaN `seconds` & `scrollPct` clamped. Pinned by `clampPrepSeconds` / `clampPct` tests (Task 1) + route code (Task 3).
5. Admin saves whitespace-only kit → stored `null` → hidden from learners; scroll % only ever climbs and `maxScrollAt` only changes when it climbs. Pinned by `normalizePrep` tests (Task 1) and conditional `updateMany` (Task 3).

---

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | `Packet.prepMaterial`, `PrepRead` model, `AdminAction.PREP_EDITED` |
| `prisma/migrations/20261117120000_prep_material/migration.sql` | Hand-written migration (same style as prior ones) |
| `lib/prep.ts` (new) | Pure helpers: normalize, hash parse, scroll %, clamps |
| `lib/__tests__/prep.test.ts` (new) | Unit tests for the above |
| `app/api/packets/[id]/route.ts` | PATCH accepts `prepMaterial`, logs `PREP_EDITED` |
| `lib/labels.ts`, `components/activity-log.tsx` | Label + colour for `PREP_EDITED` |
| `components/prep-editor.tsx` (new) | Admin editor (Edit/Preview/Save) |
| `components/packet-editor.tsx`, `app/(admin)/packets/[id]/page.tsx` | Wire editor + data |
| `app/api/p/[slug]/prep/route.ts` (new) | Learner kit heartbeat/upsert |
| `components/prep-tracker.tsx` (new) | Client: time + scroll → API |
| `components/packet-reader.tsx` | Kit as first rail item, `#prep`, kit pane |
| `components/markdown.tsx` | `img` / `pre` styling (HackMD notes use images + code blocks) |
| `app/p/[slug]/page.tsx` | Pass kit, widen container |
| `lib/reports.ts`, `lib/tracking.ts`, `components/tracking-dashboard.tsx` | `prep-kit` report, summary rows, dashboard panel |
| `docs/decisions.md` | Decision log entry |

---

### Task 1: Schema, migration and pure helpers

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261117120000_prep_material/migration.sql`
- Create: `lib/prep.ts`
- Test: `lib/__tests__/prep.test.ts`

**Interfaces:**
- Produces (`lib/prep.ts`): `PREP_MAX: number`, `PREP_MAX_DELTA: number`, `PREP_MAX_SECONDS: number`, `type ReaderView = "prep" | number`, `normalizePrep(input: string | null | undefined): string | null`, `parseReaderHash(hash: string, roundCount: number, hasPrep: boolean): ReaderView`, `hashFor(view: ReaderView): string`, `scrollSeenPct(top: number, height: number, viewportHeight: number): number`, `clampPct(raw: unknown): number`, `clampPrepSeconds(raw: unknown): number`.
- Produces (Prisma): `db.prepRead` model, `Packet.prepMaterial`, `AdminAction` value `PREP_EDITED`.

- [ ] **Step 1: Write the failing tests** — create `lib/__tests__/prep.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  PREP_MAX,
  PREP_MAX_DELTA,
  clampPct,
  clampPrepSeconds,
  hashFor,
  normalizePrep,
  parseReaderHash,
  scrollSeenPct,
} from "@/lib/prep";

describe("normalizePrep", () => {
  it("treats empty / whitespace / null as not added", () => {
    expect(normalizePrep("")).toBeNull();
    expect(normalizePrep(" \n\t ")).toBeNull();
    expect(normalizePrep(null)).toBeNull();
    expect(normalizePrep(undefined)).toBeNull();
  });
  it("trims real content", () => {
    expect(normalizePrep("  # Kit\n")).toBe("# Kit");
  });
  it("exposes a max length above the Add-Ons cap", () => {
    expect(PREP_MAX).toBe(60000);
  });
});

describe("parseReaderHash", () => {
  it("opens the kit for #prep when a kit exists", () => {
    expect(parseReaderHash("#prep", 3, true)).toBe("prep");
  });
  it("defaults to the kit with no hash when a kit exists", () => {
    expect(parseReaderHash("", 3, true)).toBe("prep");
  });
  it("defaults to R1 with no hash and no kit", () => {
    expect(parseReaderHash("", 3, false)).toBe(0);
  });
  it("#prep without a kit falls back to R1", () => {
    expect(parseReaderHash("#prep", 3, false)).toBe(0);
  });
  it("parses #rN to a 0-based index", () => {
    expect(parseReaderHash("#r2", 3, true)).toBe(1);
    expect(parseReaderHash("#r1", 3, false)).toBe(0);
  });
  it("out-of-range or junk hashes fall back to the default", () => {
    expect(parseReaderHash("#r9", 3, true)).toBe("prep");
    expect(parseReaderHash("#r0", 3, false)).toBe(0);
    expect(parseReaderHash("#nope", 3, true)).toBe("prep");
    expect(parseReaderHash("#r2x", 3, false)).toBe(0);
  });
  it("works with zero rounds", () => {
    expect(parseReaderHash("#prep", 0, true)).toBe("prep");
    expect(parseReaderHash("", 0, true)).toBe("prep");
  });
});

describe("hashFor", () => {
  it("round-trips with parseReaderHash", () => {
    expect(hashFor("prep")).toBe("#prep");
    expect(hashFor(0)).toBe("#r1");
    expect(hashFor(2)).toBe("#r3");
  });
});

describe("scrollSeenPct", () => {
  it("is 0 when the content is still below the fold", () => {
    expect(scrollSeenPct(900, 2000, 800)).toBe(0);
  });
  it("is proportional to how much has been scrolled into view", () => {
    // viewport bottom is 500px into a 2000px element → 25%
    expect(scrollSeenPct(300, 2000, 800)).toBe(25);
  });
  it("is 100 once the bottom has passed the viewport bottom", () => {
    expect(scrollSeenPct(-1500, 2000, 800)).toBe(100);
  });
  it("is 100 for content shorter than the viewport", () => {
    expect(scrollSeenPct(200, 300, 900)).toBe(100);
  });
  it("is 0 for zero-height / invalid input, never NaN", () => {
    expect(scrollSeenPct(0, 0, 800)).toBe(0);
    expect(scrollSeenPct(0, 100, 0)).toBe(0);
    expect(scrollSeenPct(NaN, 100, 800)).toBe(0);
  });
});

describe("clamps", () => {
  it("clampPct bounds to 0..100 and rejects garbage", () => {
    expect(clampPct(150)).toBe(100);
    expect(clampPct(-5)).toBe(0);
    expect(clampPct(33.6)).toBe(34);
    expect(clampPct("x")).toBe(0);
    expect(clampPct(undefined)).toBe(0);
    expect(clampPct(NaN)).toBe(0);
  });
  it("clampPrepSeconds bounds to 0..PREP_MAX_DELTA and rejects garbage", () => {
    expect(clampPrepSeconds(20)).toBe(20);
    expect(clampPrepSeconds(99999)).toBe(PREP_MAX_DELTA);
    expect(clampPrepSeconds(-4)).toBe(0);
    expect(clampPrepSeconds("12")).toBe(0);
    expect(clampPrepSeconds(NaN)).toBe(0);
    expect(clampPrepSeconds(Infinity)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- lib/__tests__/prep.test.ts`
Expected: FAIL — cannot resolve `@/lib/prep`.

- [ ] **Step 3: Implement** — create `lib/prep.ts`:

```ts
/** Pure helpers for the Preparatory Kit. No I/O. */

/** HackMD notes run longer than Add-Ons (20k), so allow more. */
export const PREP_MAX = 60_000;
/** Per-request cap on reported active seconds (same idea as the heartbeat route). */
export const PREP_MAX_DELTA = 180;
/** Stop accumulating time past this total per learner × packet. */
export const PREP_MAX_SECONDS = 36_000;

/** What the reader is showing: the kit, or the round at this 0-based index. */
export type ReaderView = "prep" | number;

/** Empty / whitespace-only kit means "not added" (stored as null). */
export function normalizePrep(input: string | null | undefined): string | null {
  const t = (input ?? "").trim();
  return t ? t : null;
}

/**
 * `#prep` → kit, `#rN` → round N-1. Anything invalid (or `#prep` with no kit,
 * or an out-of-range round) falls back to the default: the kit when there is
 * one, otherwise round 1.
 */
export function parseReaderHash(hash: string, roundCount: number, hasPrep: boolean): ReaderView {
  const fallback: ReaderView = hasPrep ? "prep" : 0;
  if (hash === "#prep") return fallback;
  const m = hash.match(/^#r(\d+)$/);
  if (!m) return fallback;
  const n = Number(m[1]) - 1;
  return n >= 0 && n < roundCount ? n : fallback;
}

export function hashFor(view: ReaderView): string {
  return view === "prep" ? "#prep" : `#r${view + 1}`;
}

/**
 * How much of an element has been scrolled into view, 0–100: the part of it
 * above the viewport bottom ÷ its height. `top` is `getBoundingClientRect().top`.
 */
export function scrollSeenPct(top: number, height: number, viewportHeight: number): number {
  if (![top, height, viewportHeight].every(Number.isFinite)) return 0;
  if (height <= 0 || viewportHeight <= 0) return 0;
  const seen = Math.min(height, Math.max(0, viewportHeight - top));
  return Math.min(100, Math.max(0, Math.round((seen / height) * 100)));
}

export function clampPct(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

export function clampPrepSeconds(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.min(PREP_MAX_DELTA, Math.max(0, Math.round(raw)));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- lib/__tests__/prep.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Schema + migration.** In `prisma/schema.prisma`:
  - In `model Packet`, after the `addOns` line add:
    `  prepMaterial    String?      @db.Text // admin-pasted markdown (HackMD), shown to learners above the rounds when non-empty`
  - In `model Packet` relations block (after `vaultClicks VaultClick[]`) add: `  prepReads   PrepRead[]`
  - In `enum AdminAction`, after `PACKET_RESET` add: `  PREP_EDITED`
  - After `model PacketReadDay { ... }` add:

```prisma
/**
 * Preparatory Kit reading, one row per learner × packet. Kept apart from
 * PacketRead so round-progress numbers are unaffected.
 */
model PrepRead {
  id           String    @id @default(cuid())
  packetId     String
  packet       Packet    @relation(fields: [packetId], references: [id], onDelete: Cascade)
  userEmail    String
  userId       String?
  firstReadAt  DateTime  @default(now())
  lastReadAt   DateTime  @default(now())
  maxScrollPct Int       @default(0) // furthest point of the kit seen, 0-100, only climbs
  maxScrollAt  DateTime? // when that furthest point was first reached
  secondsTotal Int       @default(0) // active time on the kit, all days

  @@unique([packetId, userEmail])
  @@index([packetId])
  @@index([userEmail])
}
```

  Create `prisma/migrations/20261117120000_prep_material/migration.sql`:

```sql
-- AlterEnum
ALTER TYPE "AdminAction" ADD VALUE 'PREP_EDITED';

-- AlterTable
ALTER TABLE "Packet" ADD COLUMN "prepMaterial" TEXT;

-- CreateTable
CREATE TABLE "PrepRead" (
    "id" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userId" TEXT,
    "firstReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maxScrollPct" INTEGER NOT NULL DEFAULT 0,
    "maxScrollAt" TIMESTAMP(3),
    "secondsTotal" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PrepRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrepRead_packetId_idx" ON "PrepRead"("packetId");

-- CreateIndex
CREATE INDEX "PrepRead_userEmail_idx" ON "PrepRead"("userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "PrepRead_packetId_userEmail_key" ON "PrepRead"("packetId", "userEmail");

-- AddForeignKey
ALTER TABLE "PrepRead" ADD CONSTRAINT "PrepRead_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "Packet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 6: Validate + generate client (no DB touched)**

Run: `DATABASE_URL=postgresql://u:p@localhost:5432/x DIRECT_URL=postgresql://u:p@localhost:5432/x npx prisma validate && npx prisma generate`
Expected: "The schema ... is valid" and "Generated Prisma Client". (Applying the migration to a real DB is the user's job: `npm run db:deploy`.)

- [ ] **Step 7: Commit (ask user first; never push)**

```bash
git add prisma lib/prep.ts lib/__tests__/prep.test.ts
git commit -m "feat(prep): schema, migration and pure helpers for Preparatory Kit"
```

---

### Task 2: Admin editor + save

**Files:**
- Modify: `app/api/packets/[id]/route.ts`
- Modify: `lib/labels.ts`, `components/activity-log.tsx`
- Create: `components/prep-editor.tsx`
- Modify: `components/packet-editor.tsx`, `app/(admin)/packets/[id]/page.tsx`

**Interfaces:**
- Consumes: `PREP_MAX`, `normalizePrep` from `lib/prep.ts`; `AdminAction.PREP_EDITED` (Task 1).
- Produces: `PATCH /api/packets/[id]` body field `prepMaterial: string | null`; component `PrepEditor({ packetId, initial })`.

- [ ] **Step 1: PATCH route.** In `app/api/packets/[id]/route.ts`:
  - Import: `import { PREP_MAX, normalizePrep } from "@/lib/prep";`
  - In `Patch` after `addOns` add: `  prepMaterial: z.string().max(PREP_MAX).nullable().optional(),`
  - After the `addOns` normalize line add:
    `  if (packetFields.prepMaterial !== undefined) packetFields.prepMaterial = normalizePrep(packetFields.prepMaterial);`
  - Replace the `changed` block + log with:

```ts
  const { prepMaterial, ...otherFields } = packetFields;
  const changed = [
    ...Object.keys(otherFields),
    ...(rounds?.length ? [`${rounds.length} round${rounds.length === 1 ? "" : "s"}`] : []),
  ];
  const packetForLog = changed.length || prepMaterial !== undefined ? await activityPacket(params.id) : null;
  if (changed.length) {
    await logActivity({
      actorEmail: guard.user.email,
      action: "PACKET_EDITED",
      packet: packetForLog,
      detail: changed.join(", "),
    });
  }
  if (prepMaterial !== undefined) {
    await logActivity({
      actorEmail: guard.user.email,
      action: "PREP_EDITED",
      packet: packetForLog,
      detail: prepMaterial ? "Preparatory Kit updated" : "Preparatory Kit cleared",
    });
  }
  return json({ ok: true });
```

  (Remove the old `const changed = ...` and `if (changed.length) {...}` and the old `return json({ ok: true });` of PATCH only; leave DELETE alone.)

- [ ] **Step 2: Labels.** `lib/labels.ts` add `  PREP_EDITED: "Edited Preparatory Kit",` after `PACKET_RESET`. `components/activity-log.tsx` add `  PREP_EDITED: "bg-warning/10 text-warning",` after the `QUESTION_EDITED` colour line.

- [ ] **Step 3: Editor component** — create `components/prep-editor.tsx`:

```tsx
"use client";

import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { PREP_MAX, normalizePrep } from "@/lib/prep";
import { cn } from "@/lib/utils";

/** Admin editor for the learner-visible "Preparatory Kit" (pasted HackMD markdown). */
export function PrepEditor({ packetId, initial }: { packetId: string; initial: string | null }) {
  const [open, setOpen] = useState(Boolean(initial));
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [text, setText] = useState(initial ?? "");
  const [saved, setSaved] = useState(normalizePrep(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = normalizePrep(text);
  const dirty = current !== saved;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/packets/${packetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prepMaterial: current }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not save the Preparatory Kit");
      }
      setSaved(current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the Preparatory Kit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <BookOpen className="h-4 w-4 text-accent" />
        <span className="text-sm font-semibold">Preparatory Kit</span>
        {saved ? (
          <Badge variant="success">Visible to learners</Badge>
        ) : (
          <Badge variant="outline">Hidden — empty</Badge>
        )}
        <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-border p-4">
          <p className="text-xs text-muted-foreground">
            Paste the markdown from HackMD (Edit mode → select all → copy). Shown to learners as the
            first item, above R1. Headings, lists, links, images and code blocks render; tables and
            checkboxes don&apos;t yet. Leave empty to hide it.
          </p>
          <div className="flex gap-1.5">
            {(["edit", "preview"] as const).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={tab === t ? "secondary" : "ghost"}
                onClick={() => setTab(t)}
              >
                {t === "edit" ? "Edit" : "Preview"}
              </Button>
            ))}
          </div>
          {tab === "edit" ? (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              maxLength={PREP_MAX}
              placeholder={"# How to prepare\n\n- Revise [system design basics](https://example.com)\n- Practice 10 SQL joins"}
              className="font-mono text-sm"
            />
          ) : current ? (
            <div className="max-h-[32rem] overflow-auto rounded-md border border-border p-3">
              <Markdown source={current} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview.</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <Button size="sm" loading={saving} disabled={!dirty || saving} onClick={save}>
              Save Preparatory Kit
            </Button>
            {dirty && !saving && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Wire.**
  - `components/packet-editor.tsx`: add `import { PrepEditor } from "@/components/prep-editor";` under the AddOnsEditor import; in `interface PData` add `  prepMaterial: string | null;` after `addOns`; after `<AddOnsEditor ... />` (just above the `{/* Rounds */}` comment) add `      <PrepEditor packetId={packet.id} initial={packet.prepMaterial} />`.
  - `app/(admin)/packets/[id]/page.tsx`: after `addOns: packet.addOns,` add `        prepMaterial: packet.prepMaterial,`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit (ask user first; never push)**

```bash
git add app/api/packets lib/labels.ts components/activity-log.tsx components/prep-editor.tsx components/packet-editor.tsx "app/(admin)/packets"
git commit -m "feat(prep): admin Preparatory Kit editor and save"
```

---

### Task 3: Kit read API

**Files:**
- Create: `app/api/p/[slug]/prep/route.ts`

**Interfaces:**
- Consumes: `clampPct`, `clampPrepSeconds`, `PREP_MAX_SECONDS` (Task 1); `db.prepRead` (Task 1).
- Produces: `POST /api/p/[slug]/prep` body `{ seconds?: number; scrollPct?: number }` → `{ ok: boolean; counted?: false }`. First call (seconds 0) registers the first read.

- [ ] **Step 1: Create the route:**

```ts
import { guardAuthed, json } from "@/lib/api";
import { db } from "@/lib/db";
import { isInternalEmail } from "@/lib/internal";
import { PREP_MAX_SECONDS, clampPct, clampPrepSeconds } from "@/lib/prep";

export const runtime = "nodejs";

/**
 * Record the signed-in learner reading the Preparatory Kit. The first call
 * creates the row (first read); every call bumps last read, raises the furthest
 * scroll depth (stamping when it was reached) and adds active seconds.
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const guard = await guardAuthed();
  if (guard.error) return guard.error;
  const email = guard.user.email;
  if (!email) return json({ ok: false });
  // Scaler staff reviewing a packet must not show up as a learner read.
  if (isInternalEmail(email)) return json({ ok: true, counted: false });

  const body = (await req.json().catch(() => ({}))) as { seconds?: unknown; scrollPct?: unknown };
  const seconds = clampPrepSeconds(body.seconds);
  const pct = clampPct(body.scrollPct);

  const packet = await db.packet.findUnique({
    where: { slug: params.slug },
    select: { id: true, status: true, prepMaterial: true },
  });
  if (!packet || packet.status !== "PUBLISHED" || !packet.prepMaterial?.trim()) {
    return json({ ok: false });
  }

  const now = new Date();
  const row = await db.prepRead.upsert({
    where: { packetId_userEmail: { packetId: packet.id, userEmail: email } },
    create: { packetId: packet.id, userEmail: email, userId: guard.user.id },
    update: { lastReadAt: now },
    select: { id: true },
  });

  // Depth only ever climbs, and its timestamp moves only when it does.
  if (pct > 0) {
    await db.prepRead.updateMany({
      where: { id: row.id, maxScrollPct: { lt: pct } },
      data: { maxScrollPct: pct, maxScrollAt: now },
    });
  }
  if (seconds > 0) {
    await db.prepRead.updateMany({
      where: { id: row.id, secondsTotal: { lt: PREP_MAX_SECONDS } },
      data: { secondsTotal: { increment: seconds } },
    });
  }
  return json({ ok: true });
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (Route needs a DB, so it is not exercised here — see Task 6.)

- [ ] **Step 3: Commit (ask user first; never push)**

```bash
git add "app/api/p"
git commit -m "feat(prep): learner kit-read API"
```

---

### Task 4: Learner UI, tracker and wider layout

**Files:**
- Create: `components/prep-tracker.tsx`
- Modify (replace whole file): `components/packet-reader.tsx`
- Modify: `components/markdown.tsx`, `app/p/[slug]/page.tsx`

**Interfaces:**
- Consumes: `parseReaderHash`, `hashFor`, `scrollSeenPct`, `type ReaderView` (Task 1); `POST /api/p/[slug]/prep` (Task 3).
- Produces: `<PacketReader rounds={ReaderRound[]} prep={string | null} slug={string} />`; `<PrepTracker slug targetRef />`.

- [ ] **Step 1: Tracker** — create `components/prep-tracker.tsx`:

```tsx
"use client";

import { useEffect, type RefObject } from "react";
import { scrollSeenPct } from "@/lib/prep";

const TICK_MS = 20_000;
const SCROLL_DEBOUNCE_MS = 1_500;

/**
 * Mounted only while the Preparatory Kit is on screen. Registers the first read
 * (once the tab is visible), accumulates active time (paused when hidden) and the
 * furthest scroll depth of `targetRef`, and posts both to the kit API: on a 20s
 * tick, shortly after the depth climbs, and when the learner leaves.
 */
export function PrepTracker({ slug, targetRef }: { slug: string; targetRef: RefObject<HTMLElement> }) {
  useEffect(() => {
    const url = `/api/p/${slug}/prep`;
    let pending = 0; // unsent active seconds
    let maxPct = 0; // furthest depth seen
    let sentPct = -1; // depth last sent
    let registered = false;
    let lastTick = Date.now();
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;

    const accrue = () => {
      if (document.visibilityState === "visible") pending += (Date.now() - lastTick) / 1000;
      lastTick = Date.now();
    };

    const send = (useBeacon: boolean) => {
      accrue();
      const seconds = Math.round(pending);
      pending = Math.max(0, pending - seconds);
      sentPct = maxPct;
      registered = true;
      const body = JSON.stringify({ seconds, scrollPct: maxPct });
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      } else {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    };

    const measure = () => {
      const el = targetRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pct = scrollSeenPct(r.top, r.height, window.innerHeight);
      if (pct > maxPct) {
        maxPct = pct;
        if (registered) {
          clearTimeout(debounce);
          debounce = setTimeout(() => send(false), SCROLL_DEBOUNCE_MS);
        }
      }
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };

    // Don't count a kit opened in a background tab until it is actually seen.
    const register = () => {
      if (registered || document.visibilityState !== "visible") return;
      measure();
      send(false);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (registered) send(true);
      } else {
        lastTick = Date.now();
        register();
      }
    };
    const onHide = () => {
      if (registered) send(true);
    };

    register();
    const interval = setInterval(() => {
      if (!registered) return register();
      accrue();
      if (pending >= 1 || maxPct !== sentPct) send(false);
    }, TICK_MS);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);

    return () => {
      clearInterval(interval);
      clearTimeout(debounce);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      onHide();
    };
  }, [slug, targetRef]);

  return null;
}
```

- [ ] **Step 2: Reader** — replace `components/packet-reader.tsx` entirely with:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, ExternalLink, Flag, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { splitTopic } from "@/lib/topic";
import { hashFor, parseReaderHash, type ReaderView } from "@/lib/prep";
import { ROUND_DONE_EVENT } from "@/components/read-tracker";
import { Markdown } from "@/components/markdown";
import { PrepTracker } from "@/components/prep-tracker";
import { Skeleton } from "@/components/ui/skeleton";

export interface ReaderRound {
  id: string;
  name: string;
  duration: string | null;
  isSpillover: boolean;
  questions: { id: string; displayText: string; problemLink: string | null }[];
}

/** "R1 · Online Assessment"; the spillover round keeps its own name. */
function roundLabel(r: ReaderRound, i: number) {
  return r.isSpillover ? r.name : `R${i + 1} · ${r.name}`;
}

const RAIL_BTN =
  "flex h-10 min-w-[168px] shrink-0 items-center justify-between gap-2 rounded-lg border px-2.5 text-left text-sm transition-colors md:min-w-0";
const RAIL_ON = "border-border bg-card font-semibold text-foreground elev";
const RAIL_OFF = "border-transparent text-muted-foreground hover:bg-subtle hover:text-foreground";

/**
 * One view at a time: an optional Preparatory Kit pinned above the rounds, then
 * the rounds. A rail (sidebar on desktop, tab row on phone) switches between
 * them; the active view lives in the URL hash (`#prep`, `#r2`) so refresh, back
 * and shared links keep it.
 */
export function PacketReader({
  rounds,
  prep,
  slug,
}: {
  rounds: ReaderRound[];
  prep: string | null;
  slug: string;
}) {
  const hasPrep = Boolean(prep);
  // With a kit the first view depends on the hash, so stay unresolved until the
  // effect below has read it — otherwise `#r2` links would briefly mount the kit
  // and log a false kit read.
  const [view, setView] = useState<ReaderView | null>(hasPrep ? null : 0);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const prepRef = useRef<HTMLDivElement>(null);

  // Sync from the hash on load and on back / forward.
  useEffect(() => {
    const sync = () => setView(parseReaderHash(window.location.hash, rounds.length, hasPrep));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [rounds.length, hasPrep]);

  const goTo = useCallback((v: ReaderView) => {
    setView(v);
    setQuery("");
    window.history.pushState(null, "", hashFor(v));
    // Jump (not smooth-scroll) to the start if the learner has scrolled past it —
    // a smooth scroll would sweep the new round's end marker through the viewport
    // and count it as read.
    const top = topRef.current;
    if (top && top.getBoundingClientRect().top < 0) {
      top.scrollIntoView({ block: "start" });
    }
  }, []);

  const activeIdx = typeof view === "number" ? view : -1;
  const round = activeIdx >= 0 ? rounds[activeIdx] : undefined;
  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => (round && q ? round.questions.filter((x) => x.displayText.toLowerCase().includes(q)) : round?.questions ?? []),
    [round, q],
  );

  // A round counts as read once its end comes into view with nothing filtered out.
  useEffect(() => {
    const el = endRef.current;
    if (!el || !round || q) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        window.dispatchEvent(new CustomEvent(ROUND_DONE_EVENT, { detail: round.id }));
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [round, q]);

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      /* clipboard blocked — nothing useful to show */
    }
  };

  // From the kit (-1) "next" is the first round.
  const next = rounds[activeIdx + 1];
  const nextCard = next && (
    <div className="mt-5 flex justify-end">
      <button
        type="button"
        onClick={() => goTo(activeIdx + 1)}
        className="group w-full rounded-xl border border-border bg-card px-4 py-2.5 text-left transition-colors hover:bg-subtle sm:w-auto sm:min-w-[200px]"
      >
        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Next round
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[15px] font-semibold">
          {roundLabel(next, activeIdx + 1)}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-[3px]" />
        </span>
      </button>
    </div>
  );

  if (!hasPrep && !round) return null;

  return (
    <div ref={topRef} className="scroll-mt-20 md:grid md:grid-cols-[210px_minmax(0,1fr)] md:gap-7">
      {/* Rail — horizontal tabs on phone, sticky sidebar on desktop. Stays visible in every view. */}
      <nav aria-label="Packet sections" className="md:sticky md:top-20 md:self-start">
        <p className="mb-1.5 hidden px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:block">
          Contents
        </p>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:gap-1 md:overflow-visible md:px-0 md:pb-0">
          {hasPrep && (
            <button
              type="button"
              onClick={() => goTo("prep")}
              aria-current={view === "prep" ? "true" : undefined}
              className={cn(RAIL_BTN, view === "prep" ? RAIL_ON : RAIL_OFF)}
            >
              <span className="truncate">Preparatory Kit</span>
              <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
            </button>
          )}
          {rounds.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === view ? "true" : undefined}
              className={cn(RAIL_BTN, i === view ? RAIL_ON : RAIL_OFF)}
            >
              <span className="truncate">{roundLabel(r, i)}</span>
              <span className="rounded-md bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-primary">
                {r.questions.length}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {view === null ? (
        <section className="mt-5 min-w-0 space-y-3 md:mt-0" aria-busy>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-64 w-full" />
        </section>
      ) : view === "prep" && prep ? (
        <section className="mt-5 min-w-0 md:mt-0">
          <h2 className="text-xl font-bold leading-tight tracking-tight">Preparatory Kit</h2>
          <div ref={prepRef} className="mt-4 max-w-[88ch]">
            <Markdown source={prep} />
          </div>
          <PrepTracker slug={slug} targetRef={prepRef} />
          {nextCard}
        </section>
      ) : round ? (
        <section className="mt-5 min-w-0 md:mt-0">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-bold leading-tight tracking-tight">{roundLabel(round, activeIdx)}</h2>
              {round.duration && <p className="mt-0.5 text-sm text-muted-foreground">{round.duration}</p>}
            </div>
            <label className="relative block sm:w-[200px]">
              <span className="sr-only">Search questions in this round</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search questions"
                className="h-[31px] w-full rounded-md border border-border bg-card pl-8 pr-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>

          <ol className="mt-4 space-y-2">
            {visible.map((x) => {
              const n = round.questions.indexOf(x) + 1;
              const { topic, body } = splitTopic(x.displayText);
              return (
                <li key={x.id} className="flex gap-3 rounded-xl border border-border bg-card px-3.5 py-3.5 sm:gap-3 sm:px-4">
                  <span className="w-7 shrink-0 select-none pt-[3px] font-mono text-[13px] tabular-nums text-muted-foreground">
                    {String(n).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    {topic && (
                      <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                        <Flag className="h-3 w-3" />
                        {topic}
                      </span>
                    )}
                    <p className="text-pretty text-[15px] font-medium leading-6 sm:text-base">{body}</p>
                    {x.problemLink && (
                      <a
                        href={x.problemLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-accent/25 bg-accent/5 px-2 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Solve this question
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(x.id, body)}
                    aria-live="polite"
                    className="h-fit shrink-0 rounded px-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {copied === x.id ? "Copied" : "Copy"}
                  </button>
                </li>
              );
            })}
            {!visible.length && (
              <li className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No questions in this round match “{query.trim()}”.
              </li>
            )}
          </ol>

          {/* End-of-round marker for reading progress. */}
          <div ref={endRef} aria-hidden className="h-px" />

          {nextCard}
        </section>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Markdown polish** — in `components/markdown.tsx`, inside `components={{ ... }}` after the `code:` entry add:

```tsx
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-[13px] leading-5">{children}</pre>
          ),
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={typeof src === "string" ? src : undefined}
              alt={alt ?? ""}
              loading="lazy"
              className="h-auto max-w-full rounded-md"
            />
          ),
```

- [ ] **Step 4: Learner page** — `app/p/[slug]/page.tsx`:
  - Add `import { normalizePrep } from "@/lib/prep";`
  - After the `questionCount` line add: `  const prep = normalizePrep(packet.prepMaterial);`
  - Replace the reader block:
    `{rounds.length ? ( <PacketReader rounds={rounds} /> ) : (` → `{rounds.length || prep ? ( <PacketReader rounds={rounds} prep={prep} slug={params.slug} /> ) : (` (keep the existing empty-state `<p>` as the else branch).
  - Replace both `max-w-[1040px]` with `max-w-[1440px]` (main container div and footer `<p>`).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all pass. If `Skeleton` or `BookOpen` import fails, check `components/ui/skeleton.tsx` / lucide version and adjust the import only.

- [ ] **Step 6: Commit (ask user first; never push)**

```bash
git add components app/p
git commit -m "feat(prep): learner kit view, deep link, tracker and wider reading layout"
```

---

### Task 5: Admin tracking report, summary and dashboard

**Files:**
- Modify: `lib/reports.ts`, `lib/tracking.ts`, `components/tracking-dashboard.tsx`

**Interfaces:**
- Consumes: `db.prepRead` (Task 1); `NOT_INTERNAL`, `formatDateTime`, `formatDuration`, `packetUrl` (already in `reports.ts`).
- Produces: report key `"prep-kit"` (headers below) usable via `/api/tracking/export?report=prep-kit`; `TrackingSummary.prepLog: PrepLogRow[]`, `TrackingSummary.prepReadCount: number`.

- [ ] **Step 1: Report** — in `lib/reports.ts` add above `export interface RosterFilters`:

```ts
/**
 * Preparatory Kit reads: one row per learner × packet whose last read falls in
 * range. Depth is the furthest point of the kit seen, with when it was reached.
 */
async function prepKitReads({ from, to }: DateRange): Promise<Report> {
  const reads = await db.prepRead.findMany({
    where: { lastReadAt: { gte: from, lte: to }, NOT: NOT_INTERNAL },
    include: { packet: { select: { company: true, role: true, slug: true } } },
    orderBy: { lastReadAt: "desc" },
  });
  return {
    key: "prep-kit",
    title: "Preparatory Kit reads",
    headers: [
      "Company",
      "Role",
      "Learner email",
      "First read",
      "Last read",
      "Max scroll %",
      "Scroll reached at",
      "Time spent",
      "Packet link",
    ],
    rows: reads.map((r) => [
      r.packet.company,
      r.packet.role,
      r.userEmail,
      formatDateTime(r.firstReadAt),
      formatDateTime(r.lastReadAt),
      `${r.maxScrollPct}%`,
      formatDateTime(r.maxScrollAt),
      formatDuration(r.secondsTotal),
      packetUrl(r.packet.slug),
    ]),
  };
}
```

  and in `REPORTS` after `"vault-clicks": vaultClicks,` add `  "prep-kit": prepKitReads,` (comment above that group already says these are dashboard/CSV only; `TAB_FOR` in `lib/sync.ts` is deliberately NOT updated so it is not mirrored).

- [ ] **Step 2: Summary** — `lib/tracking.ts`:
  - After `ReadLogRow` interface add:

```ts
export interface PrepLogRow {
  company: string;
  role: string;
  email: string;
  firstRead: string;
  lastRead: string;
  scrollPct: number;
  scrollAt: string;
  timeSpent: string;
  link: string;
}
```

  - In `TrackingSummary` after `readLog: ReadLogRow[];` add `  prepLog: PrepLogRow[];` and `  prepReadCount: number;`.
  - In the returned object after the `readLog: ...` property (before `daily,`) add:

```ts
    prepReadCount: byKey["prep-kit"]?.rows.length ?? 0,
    prepLog: (byKey["prep-kit"]?.rows ?? []).slice(0, 200).map((r) => {
      const rep = byKey["prep-kit"];
      const c = (h: string) => String(col(rep, r, h) ?? "");
      return {
        company: c("Company"),
        role: c("Role"),
        email: c("Learner email"),
        firstRead: c("First read"),
        lastRead: c("Last read"),
        scrollPct: num(col(rep, r, "Max scroll %")),
        scrollAt: c("Scroll reached at"),
        timeSpent: c("Time spent"),
        link: c("Packet link"),
      };
    }),
```

- [ ] **Step 3: Dashboard panel** — `components/tracking-dashboard.tsx`: insert immediately after the closing `</Panel>` of "Learner × Packet Consumption" (the lines `      </Panel>` / `        </div>` / `      </section>` / blank / `      <PacketDirectory pairs={packetPairs} />` — insert between `</Panel>` and `        </div>`):

```tsx

      <Panel title="Preparatory Kit reads" href={dl("prep-kit")}>
        <div className="max-h-[28rem] overflow-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Packet</th>
                <th className="px-3 py-2 font-medium">Learner</th>
                <th className="px-3 py-2 font-medium">First read</th>
                <th className="px-3 py-2 font-medium">Last read</th>
                <th className="px-3 py-2 font-medium">Scroll</th>
                <th className="px-3 py-2 font-medium">Reached at</th>
                <th className="px-3 py-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.prepLog.map((r, i) => (
                <tr key={i} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <a href={r.link} target="_blank" rel="noreferrer" className="hover:underline">
                      {r.company} — {r.role}
                    </a>
                  </td>
                  <td className="px-3 py-2">{r.email}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{r.firstRead}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{r.lastRead}</td>
                  <td className="px-3 py-2">
                    <ScrollBar pct={r.scrollPct} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{r.scrollAt}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{r.timeSpent}</td>
                </tr>
              ))}
              {!data.prepLog.length && (
                <tr>
                  <td className="px-3 py-4 text-sm text-muted-foreground" colSpan={7}>
                    No Preparatory Kit reads in this date range
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 5: Commit (ask user first; never push)**

```bash
git add lib components/tracking-dashboard.tsx
git commit -m "feat(prep): Preparatory Kit tracking report, summary and dashboard panel"
```

---

### Task 6: Decision log and final verification

**Files:**
- Modify: `docs/decisions.md`

- [ ] **Step 1: Append to `docs/decisions.md`:**

```md
## 2026-11-17 — Preparatory Kit
- **Admin pastes HackMD markdown; no fetch or iframe.** Why: no network dependency or framing block, and scroll depth stays measurable. Rejected: fetching `hackmd.io/<id>/download`, iframe embed (cross-origin → no scroll tracking). Tradeoff: HackMD edits don't propagate; admin re-pastes.
- **Kit is `Packet.prepMaterial` (nullable text), not a Round.** Why: a Round would leak into round progress, reordering and question counts. Rejected: round with a `kind` flag.
- **Kit tracking is its own `PrepRead` table** (first/last read, furthest scroll % + when reached, total seconds), dashboard + CSV only, not mirrored to Sheets. Rejected: extending `PacketRead` (would change round-progress meaning).
- **Link format `/p/<slug>#prep`**, same hash scheme as `#rN`. With a kit and no hash, the reader opens on the kit.
- **No `remark-gfm`.** Tables/task lists from HackMD don't render yet. Added only `img`/`pre` styling to `Markdown`.
- **Learner container widened 1040px → 1440px**; kit prose capped at 88ch for line length.
```

- [ ] **Step 2: Full verification**

Run: `npx tsc --noEmit && npm run lint && npm test && DATABASE_URL=postgresql://u:p@localhost:5432/x DIRECT_URL=postgresql://u:p@localhost:5432/x npx prisma validate`
Expected: all green.

- [ ] **Step 3: Report what was NOT verified** (needs a real DB + browser; the user applies the migration with `npm run db:deploy` themselves):
  - Migration applied to a real database.
  - Admin: paste → Preview → Save → "Visible to learners" badge; clearing hides it.
  - Learner: kit first in rail; `/p/<slug>#prep` opens it from a fresh tab; `#r2` on a kit packet does NOT create a kit read; kit-only (zero rounds) packet renders; rail visible on desktop and phone while reading; 1440px layout on a wide screen.
  - Tracking: `PrepRead` row appears with first/last read, max scroll and time; `@scaler.com` account creates none; dashboard panel and `prep-kit` CSV export.

- [ ] **Step 4: Commit (ask user first; never push)**

```bash
git add docs/decisions.md
git commit -m "docs: log Preparatory Kit decisions"
```
