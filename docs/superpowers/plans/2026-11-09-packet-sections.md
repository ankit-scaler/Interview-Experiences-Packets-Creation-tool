# Packet Sections, Add-Ons & Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins get collapsible, reorderable rounds, a refreshed page design, an admin-written markdown "Interview Companion Add-Ons" section (shown to learners only when present, as an expandable preview), and a double-confirmed Reset button.

**Architecture:** One nullable `Packet.addOns` text column plus a `PACKET_RESET` activity enum value (one migration). Pure, unit-tested helpers in `lib/sections.ts` hold all decision logic; three thin API routes (PATCH addOns, reorder, reset) use them; React components consume the routes. Learner page gets one new client component.

**Tech Stack:** Next.js 14 (app router), React 18, Prisma 6 / Postgres, zod 4, Tailwind 3, vitest 2 (node env, `lib/**/*.test.ts` only), new dep `react-markdown`.

**Spec:** `docs/superpowers/specs/2026-11-09-packet-sections-design.md`

## Global Constraints

- Never push, deploy, tag, open PRs, or run `prisma migrate`/`db:deploy`/`db:migrate` against any database. Write the migration file only; the user applies it.
- Commit steps are LOCAL commits and only after the user OKs committing. End commit messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Never read or print `.env`.
- Use only existing UI tokens/colours (no hardcoded colours); light + dark must work.
- Every async click shows a loader (`Button loading`) and disables while busy.
- Add-Ons: markdown, max 20 000 chars, empty/whitespace → `null`, raw HTML NOT rendered.
- Reorder: Up/Down buttons only; JD (spillover) round is pinned last and not movable.
- Reset: keeps packet, slug, JD, reads, feedback, vault clicks, LLM call history. Deletes rounds, questions, suppressed questions. Resets `jdSummary`, `lastSheetRowDate`, `lastGeneratedAt` to null, `status` to `DRAFT`. Add-Ons cleared only if `clearAddOns` is true (default false). Refused (409) while a non-stale job is PENDING/RUNNING. Company-name confirmation is exact (trimmed, case-sensitive).
- Before adding `react-markdown`, check its current docs via context7 (user rule).
- State at the end what was NOT verified (visuals / dialog flow / markdown rendering need a running app).

## Review Focus

1. Whitespace-only Add-Ons → saved as null; learner sees nothing (Task 1 test, Task 4 route).
2. Reorder request with a missing, extra, duplicate or foreign round id → 400, nothing changes (Task 1 test).
3. Reset with wrong / differently-cased / blank company name, or while a job is running → nothing deleted (Task 1 test, Task 3 route order of checks).
4. Reset with `clearAddOns=false` must never touch `addOns` (Task 1 test on `packetResetData`).
5. Add-Ons containing `<script>`, raw HTML or `javascript:` links must render inert (Task 5 manual check).
6. `localStorage` unavailable → rounds default to expanded, page still works (Task 6 code uses try/catch).

---

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma`, `prisma/migrations/20261109120000_packet_addons_reset/migration.sql` | `addOns` column, `PACKET_RESET` enum value |
| `lib/labels.ts` | label for `PACKET_RESET` |
| `lib/sections.ts` (new) | pure helpers: `ADDONS_MAX`, `normalizeAddOns`, `addOnsNeedsToggle`, `moveId`, `isSameIdSet`, `companyConfirmed`, `packetResetData` |
| `lib/__tests__/sections.test.ts` (new) | tests for the above |
| `app/api/packets/[id]/route.ts` | PATCH accepts `addOns` |
| `app/api/packets/[id]/rounds/reorder/route.ts` (new) | reorder endpoint |
| `app/api/packets/[id]/reset/route.ts` (new) | reset endpoint |
| `components/markdown.tsx` (new) | safe markdown renderer (shared admin preview + learner) |
| `components/addons-card.tsx` (new) | learner Add-Ons card (preview / expand) |
| `components/addons-editor.tsx` (new) | admin Add-Ons editor |
| `components/reset-packet-dialog.tsx` (new) | two-step reset dialog |
| `components/packet-editor.tsx` | collapsible/reorderable rounds, header redesign, wires editor + dialog |
| `app/(admin)/packets/[id]/page.tsx`, `app/p/[slug]/page.tsx` | pass `addOns` through |

---

### Task 1: Pure helpers + tests

**Files:**
- Create: `lib/sections.ts`
- Test: `lib/__tests__/sections.test.ts`

**Interfaces:**
- Produces:
  - `ADDONS_MAX: number` (20000)
  - `normalizeAddOns(input: string | null | undefined): string | null`
  - `addOnsNeedsToggle(md: string): boolean`
  - `moveId(ids: string[], id: string, dir: -1 | 1): string[]`
  - `isSameIdSet(a: string[], b: string[]): boolean`
  - `companyConfirmed(typed: string, company: string): boolean`
  - `packetResetData(clearAddOns: boolean): { jdSummary: null; lastSheetRowDate: null; lastGeneratedAt: null; status: "DRAFT"; addOns?: null }`

- [ ] **Step 1: Write the failing test** — create `lib/__tests__/sections.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ADDONS_MAX,
  addOnsNeedsToggle,
  companyConfirmed,
  isSameIdSet,
  moveId,
  normalizeAddOns,
  packetResetData,
} from "@/lib/sections";

describe("normalizeAddOns", () => {
  it("treats empty / whitespace / null as not added", () => {
    expect(normalizeAddOns("")).toBeNull();
    expect(normalizeAddOns("  \n\t ")).toBeNull();
    expect(normalizeAddOns(null)).toBeNull();
    expect(normalizeAddOns(undefined)).toBeNull();
  });
  it("trims real content", () => {
    expect(normalizeAddOns("  - bring ID  \n")).toBe("- bring ID");
  });
  it("exposes the max length", () => {
    expect(ADDONS_MAX).toBe(20000);
  });
});

describe("addOnsNeedsToggle", () => {
  it("short 1-3 line text needs no Read more", () => {
    expect(addOnsNeedsToggle("Bring your laptop.")).toBe(false);
    expect(addOnsNeedsToggle("a\nb\nc")).toBe(false);
  });
  it("long or >3 non-empty lines needs the toggle", () => {
    expect(addOnsNeedsToggle("x".repeat(200))).toBe(true);
    expect(addOnsNeedsToggle("a\nb\nc\nd")).toBe(true);
  });
  it("blank lines do not count as lines", () => {
    expect(addOnsNeedsToggle("a\n\n\nb\n\nc")).toBe(false);
  });
});

describe("moveId", () => {
  it("moves up and down", () => {
    expect(moveId(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
  });
  it("is a no-op at the ends or for unknown ids", () => {
    expect(moveId(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveId(["a", "b"], "b", 1)).toEqual(["a", "b"]);
    expect(moveId(["a", "b"], "zzz", 1)).toEqual(["a", "b"]);
  });
  it("does not mutate its input", () => {
    const ids = ["a", "b"];
    moveId(ids, "a", 1);
    expect(ids).toEqual(["a", "b"]);
  });
});

describe("isSameIdSet", () => {
  it("accepts a permutation", () => {
    expect(isSameIdSet(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
  });
  it("rejects missing, extra, foreign and duplicate ids", () => {
    expect(isSameIdSet(["a", "b"], ["a"])).toBe(false);
    expect(isSameIdSet(["a", "b"], ["a", "b", "c"])).toBe(false);
    expect(isSameIdSet(["a", "b"], ["a", "x"])).toBe(false);
    expect(isSameIdSet(["a", "b"], ["a", "a"])).toBe(false);
  });
});

describe("companyConfirmed", () => {
  it("matches exactly, ignoring surrounding spaces", () => {
    expect(companyConfirmed(" Flipkart ", "Flipkart")).toBe(true);
  });
  it("is case-sensitive and rejects blank / partial", () => {
    expect(companyConfirmed("flipkart", "Flipkart")).toBe(false);
    expect(companyConfirmed("", "Flipkart")).toBe(false);
    expect(companyConfirmed("Flip", "Flipkart")).toBe(false);
  });
});

describe("packetResetData", () => {
  it("never touches addOns unless asked", () => {
    expect("addOns" in packetResetData(false)).toBe(false);
  });
  it("clears addOns when asked", () => {
    expect(packetResetData(true).addOns).toBeNull();
  });
  it("resets generation state and unpublishes", () => {
    expect(packetResetData(false)).toEqual({
      jdSummary: null,
      lastSheetRowDate: null,
      lastGeneratedAt: null,
      status: "DRAFT",
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/__tests__/sections.test.ts`
Expected: FAIL — cannot resolve `@/lib/sections`.

- [ ] **Step 3: Implement** — create `lib/sections.ts`:

```ts
/** Pure helpers for packet sections (Add-Ons, round order, reset). No I/O. */

export const ADDONS_MAX = 20_000;

/** Empty / whitespace-only Add-Ons mean "not added" (stored as null). */
export function normalizeAddOns(input: string | null | undefined): string | null {
  const t = (input ?? "").trim();
  return t ? t : null;
}

/** Show "Read more" only when the text would overflow a ~3-line preview. */
export function addOnsNeedsToggle(md: string): boolean {
  const lines = md.split("\n").filter((l) => l.trim()).length;
  return md.length > 180 || lines > 3;
}

/** Swap `id` with its neighbour. No-op at the ends or if the id is unknown. */
export function moveId(ids: string[], id: string, dir: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const out = [...ids];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** True when `b` is exactly a permutation of `a` (no dups, missing or extra). */
export function isSameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  if (set.size !== a.length) return false;
  const seen = new Set<string>();
  for (const id of b) {
    if (!set.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

/** Reset confirmation: exact company name, trimmed, case-sensitive. */
export function companyConfirmed(typed: string, company: string): boolean {
  const t = typed.trim();
  return t.length > 0 && t === company.trim();
}

/** Packet columns written by Reset. `addOns` is only included when clearing it. */
export function packetResetData(clearAddOns: boolean) {
  return {
    jdSummary: null,
    lastSheetRowDate: null,
    lastGeneratedAt: null,
    status: "DRAFT" as const,
    ...(clearAddOns ? { addOns: null } : {}),
  } as {
    jdSummary: null;
    lastSheetRowDate: null;
    lastGeneratedAt: null;
    status: "DRAFT";
    addOns?: null;
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/__tests__/sections.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit (after user OK)**

```bash
git add lib/sections.ts lib/__tests__/sections.test.ts
git commit -m "feat: pure helpers for add-ons, reorder and reset"
```

---

### Task 2: Schema, migration, label

**Files:**
- Modify: `prisma/schema.prisma` (Packet model ~line 112; `AdminAction` enum ~line 372)
- Create: `prisma/migrations/20261109120000_packet_addons_reset/migration.sql`
- Modify: `lib/labels.ts` (`ACTION_LABEL`)

**Interfaces:**
- Produces: Prisma `Packet.addOns: string | null`; `AdminAction` includes `"PACKET_RESET"`.

- [ ] **Step 1: Edit schema.** In `model Packet`, after the `jdSummary` line add:

```prisma
  addOns          String?      @db.Text // admin-written markdown, shown to learners when non-empty
```

In `enum AdminAction`, after `QUESTION_DELETED` add `PACKET_RESET`.

- [ ] **Step 2: Create migration** `prisma/migrations/20261109120000_packet_addons_reset/migration.sql`:

```sql
-- AlterEnum
ALTER TYPE "AdminAction" ADD VALUE 'PACKET_RESET';

-- AlterTable
ALTER TABLE "Packet" ADD COLUMN "addOns" TEXT;
```

- [ ] **Step 3: Add the label** in `lib/labels.ts` inside `ACTION_LABEL`, after `QUESTION_DELETED`:

```ts
  PACKET_RESET: "Reset packet",
```

- [ ] **Step 4: Regenerate client + validate (NO migrate)**

Run: `npx prisma validate && npx prisma generate && npx tsc --noEmit`
Expected: schema valid, client generated, tsc clean.

- [ ] **Step 5: Tell the user** the migration file is ready and they must apply it themselves (`npm run db:deploy`). Do not run it.

- [ ] **Step 6: Commit (after user OK)**

```bash
git add prisma lib/labels.ts
git commit -m "feat: Packet.addOns column and PACKET_RESET activity"
```

---

### Task 3: API routes (addOns, reorder, reset)

**Files:**
- Modify: `app/api/packets/[id]/route.ts`
- Create: `app/api/packets/[id]/rounds/reorder/route.ts`
- Create: `app/api/packets/[id]/reset/route.ts`

**Interfaces:**
- Consumes: Task 1 helpers; Task 2 schema; existing `guardAdmin`, `apiError`, `json`, `logActivity`, `activityPacket`, `startGenerationJob`.
- Produces:
  - `PATCH /api/packets/:id` accepts `{ addOns?: string | null }`.
  - `POST /api/packets/:id/rounds/reorder` body `{ orderedIds: string[] }` → `{ ok: true }` | 400.
  - `POST /api/packets/:id/reset` body `{ confirmCompany: string, clearAddOns?: boolean }` → `{ jobId }` | 400 | 404 | 409.

- [ ] **Step 1: PATCH addOns.** In `app/api/packets/[id]/route.ts` add imports and schema field, normalise before update:

```ts
import { ADDONS_MAX, normalizeAddOns } from "@/lib/sections";
```

In `Patch` add (next to `stack`):

```ts
  addOns: z.string().max(ADDONS_MAX).nullable().optional(),
```

Right after `const { rounds, ...packetFields } = parsed.data;` add:

```ts
  if (packetFields.addOns !== undefined) packetFields.addOns = normalizeAddOns(packetFields.addOns);
```

(`changed` already lists `addOns` in the activity detail via `Object.keys(packetFields)`.)

- [ ] **Step 2: Reorder route** — create `app/api/packets/[id]/rounds/reorder/route.ts`:

```ts
import { z } from "zod";
import { apiError, guardAdmin, json } from "@/lib/api";
import { db } from "@/lib/db";
import { activityPacket, logActivity } from "@/lib/activity";
import { isSameIdSet } from "@/lib/sections";

export const runtime = "nodejs";

const Body = z.object({ orderedIds: z.array(z.string()).min(1).max(200) });

/** Renumber the packet's non-JD rounds to match `orderedIds`. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("orderedIds required");

  const current = await db.round.findMany({
    where: { packetId: params.id, isSpillover: false },
    select: { id: true },
  });
  if (!isSameIdSet(current.map((r) => r.id), parsed.data.orderedIds)) {
    return apiError("Round list is out of date — refresh and try again.", 400);
  }

  await db.$transaction(
    parsed.data.orderedIds.map((id, i) => db.round.update({ where: { id }, data: { order: i } })),
  );
  await logActivity({
    actorEmail: guard.user.email,
    action: "ROUND_EDITED",
    packet: await activityPacket(params.id),
    detail: "Reordered rounds",
  });
  return json({ ok: true });
}
```

- [ ] **Step 3: Reset route** — create `app/api/packets/[id]/reset/route.ts`:

```ts
import { z } from "zod";
import { apiError, guardAdmin, json } from "@/lib/api";
import { db } from "@/lib/db";
import { activityPacket, logActivity } from "@/lib/activity";
import { startGenerationJob } from "@/lib/generation/create";
import { companyConfirmed, packetResetData } from "@/lib/sections";

export const runtime = "nodejs";

const Body = z.object({ confirmCompany: z.string(), clearAddOns: z.boolean().optional() });

/**
 * Wipe a packet's generated content (rounds, questions, suppressed list) and
 * regenerate from scratch. Keeps the packet, link, JD, reads and feedback.
 * Add-Ons survive unless `clearAddOns` is true.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("confirmCompany required");

  const packet = await db.packet.findUnique({
    where: { id: params.id },
    select: { id: true, company: true },
  });
  if (!packet) return apiError("Packet not found.", 404);

  // Confirmation first, so nothing below runs on a mistyped name.
  if (!companyConfirmed(parsed.data.confirmCompany, packet.company)) {
    return apiError("Company name doesn't match.", 400);
  }

  const stale = new Date(Date.now() - 10 * 60_000);
  const running = await db.generationJob.findFirst({
    where: { packetId: packet.id, status: { in: ["PENDING", "RUNNING"] }, startedAt: { gte: stale } },
    select: { id: true },
  });
  if (running) return apiError("A generation is running — wait for it to finish first.", 409);

  const clearAddOns = parsed.data.clearAddOns === true;
  const activity = await activityPacket(packet.id);

  await db.$transaction([
    db.question.deleteMany({ where: { packetId: packet.id } }),
    db.round.deleteMany({ where: { packetId: packet.id } }),
    db.suppressedQuestion.deleteMany({ where: { packetId: packet.id } }),
    db.packet.update({ where: { id: packet.id }, data: packetResetData(clearAddOns) }),
  ]);

  await logActivity({
    actorEmail: guard.user.email,
    action: "PACKET_RESET",
    packet: activity,
    detail: clearAddOns ? "Add-Ons cleared too" : "Add-Ons kept",
  });

  try {
    // Zero questions now, so this starts an INITIAL job.
    const job = await startGenerationJob(packet.id, guard.user.id);
    return json({ jobId: job.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(`Packet was reset, but generation could not start: ${message}`, 500);
  }
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 5: Commit (after user OK)**

```bash
git add app/api
git commit -m "feat: add-ons patch, round reorder and packet reset endpoints"
```

---

### Task 4: Markdown renderer + learner Add-Ons card

**Files:**
- Modify: `package.json`, lockfile (via npm)
- Create: `components/markdown.tsx`, `components/addons-card.tsx`
- Modify: `app/p/[slug]/page.tsx`

**Interfaces:**
- Consumes: `addOnsNeedsToggle` (Task 1); `packet.addOns` (Task 2).
- Produces: `<Markdown source={string} />`; `<AddOnsCard markdown={string} />`.

- [ ] **Step 1: Check current docs.** Use context7 (`resolve-library-id` "react-markdown", then query docs for v9 usage, `components` prop, default URL sanitisation, React 18 support). Confirm the version below is compatible; if not, tell the user before proceeding.

- [ ] **Step 2: Install (user approved the dependency)**

Run: `npm install react-markdown@9.0.1`
Expected: added to `dependencies`; `npm run build`-level typecheck unaffected.

- [ ] **Step 3: Create `components/markdown.tsx`** (no `rehype-raw`, so raw HTML is escaped; default URL transform drops `javascript:` links):

```tsx
import ReactMarkdown from "react-markdown";

/** Safe markdown: raw HTML is not rendered; links open in a new tab. */
export function Markdown({ source }: { source: string }) {
  return (
    <div className="space-y-2 text-[15px] leading-6 [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc">
      <ReactMarkdown
        components={{
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-accent underline underline-offset-2"
            >
              {children}
            </a>
          ),
          h1: ({ children }) => <h3 className="text-base font-bold">{children}</h3>,
          h2: ({ children }) => <h3 className="text-base font-bold">{children}</h3>,
          h3: ({ children }) => <h4 className="text-sm font-bold">{children}</h4>,
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 text-[13px]">{children}</code>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 4: Create `components/addons-card.tsx`:**

```tsx
"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { addOnsNeedsToggle } from "@/lib/sections";
import { cn } from "@/lib/utils";

/** Learner view of the admin-written Add-Ons: short preview, expands on click. */
export function AddOnsCard({ markdown }: { markdown: string }) {
  const [open, setOpen] = useState(false);
  const toggle = addOnsNeedsToggle(markdown);
  const expanded = open || !toggle;

  return (
    <section className="rounded-xl border border-border bg-card px-4 py-3.5 sm:px-5">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Sparkles className="h-4 w-4 text-accent" />
        Interview Companion Add-Ons
      </h2>
      <div
        className={cn(
          "relative mt-2 overflow-hidden",
          !expanded && "max-h-[4.5rem]",
        )}
      >
        <Markdown source={markdown} />
        {!expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
        )}
      </div>
      {toggle && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {open ? "Show less" : "Read more"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Wire into learner page.** In `app/p/[slug]/page.tsx` add `import { AddOnsCard } from "@/components/addons-card";` and, just before the `<div className="mt-5 sm:mt-6"><VaultCard …/></div>` block, add:

```tsx
        {packet.addOns?.trim() && (
          <div className="mt-5 sm:mt-6">
            <AddOnsCard markdown={packet.addOns} />
          </div>
        )}
```

(`getPublishedPacket` uses `include`, so `addOns` is already returned.)

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean, all tests pass.

- [ ] **Step 7: Commit (after user OK)**

```bash
git add package.json package-lock.json components/markdown.tsx components/addons-card.tsx "app/p/[slug]/page.tsx"
git commit -m "feat: learner Interview Companion Add-Ons card"
```

---

### Task 5: Admin Add-Ons editor

**Files:**
- Create: `components/addons-editor.tsx`
- Modify: `components/packet-editor.tsx` (PData, render), `app/(admin)/packets/[id]/page.tsx`

**Interfaces:**
- Consumes: `Markdown` (Task 4), `ADDONS_MAX`, `normalizeAddOns`, PATCH route (Task 3).
- Produces: `<AddOnsEditor packetId: string initial: string | null />`.

- [ ] **Step 1: Create `components/addons-editor.tsx`:**

```tsx
"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { ADDONS_MAX, normalizeAddOns } from "@/lib/sections";
import { cn } from "@/lib/utils";

/** Admin editor for the learner-visible "Interview Companion Add-Ons" (markdown). */
export function AddOnsEditor({ packetId, initial }: { packetId: string; initial: string | null }) {
  const [open, setOpen] = useState(Boolean(initial));
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [text, setText] = useState(initial ?? "");
  const [saved, setSaved] = useState(normalizeAddOns(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = normalizeAddOns(text);
  const dirty = current !== saved;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/packets/${packetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addOns: current }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not save Add-Ons");
      }
      setSaved(current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save Add-Ons");
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
        <Sparkles className="h-4 w-4 text-accent" />
        <span className="text-sm font-semibold">Interview Companion Add-Ons</span>
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
            Extra, company/role-specific guidance shown to learners above the rounds. Markdown supported.
            Leave empty to hide the section.
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
              rows={8}
              maxLength={ADDONS_MAX}
              placeholder={"- Round 2 is a live coding round on HackerRank\n- Revise [Kafka basics](https://example.com)"}
              className="text-sm"
            />
          ) : current ? (
            <div className="rounded-md border border-border p-3">
              <Markdown source={current} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview.</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <Button size="sm" loading={saving} disabled={!dirty || saving} onClick={save}>
              Save Add-Ons
            </Button>
            {dirty && !saving && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          </div>
        </div>
      )}
    </section>
  );
}
```

(Explicit Save button, not save-on-blur, so a half-typed note is never published to learners by accident. This refines the spec's "save on blur".)

- [ ] **Step 2: Pass data through.** In `app/(admin)/packets/[id]/page.tsx` add `addOns: packet.addOns,` to the `packet={{ … }}` object (next to `jdSummary`). In `components/packet-editor.tsx` add `addOns: string | null;` to `PData`, import `{ AddOnsEditor } from "@/components/addons-editor"`, and render it directly above the `{/* Rounds */}` block:

```tsx
      <AddOnsEditor packetId={packet.id} initial={packet.addOns} />
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Manual checks (state as unverified if not run):** with the dev server and the migration applied locally by the user — save text → learner page shows card; clear + save → card disappears; paste `<script>alert(1)</script>` and `[x](javascript:alert(1))` → renders as inert text / dead link.

- [ ] **Step 5: Commit (after user OK)**

```bash
git add components/addons-editor.tsx components/packet-editor.tsx "app/(admin)/packets/[id]/page.tsx"
git commit -m "feat: admin editor for Interview Companion Add-Ons"
```

---

### Task 6: Collapsible, reorderable rounds

**Files:**
- Modify: `components/packet-editor.tsx` (`PacketEditor` render + `RoundBlock`)

**Interfaces:**
- Consumes: `moveId` (Task 1), reorder route (Task 3).
- Produces: `RoundBlock` new props `open: boolean`, `onToggle: () => void`, `canMoveUp: boolean`, `canMoveDown: boolean`, `moving: boolean`, `onMove: (dir: -1 | 1) => void`.

- [ ] **Step 1: State + helpers in `PacketEditor`.** Add imports `ChevronDown, ArrowUp, ArrowDown` from `lucide-react`, and `import { moveId } from "@/lib/sections";`. After the `canOverrideCost` line add:

```tsx
  // Collapsed round ids, remembered per packet. Storage can be blocked — then
  // everything just starts expanded.
  const storageKey = `packet-collapsed:${packet.id}`;
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });
  function persistCollapsed(next: Set<string>) {
    setCollapsed(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      /* storage blocked — state still works for this visit */
    }
  }
  function toggleRound(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    persistCollapsed(next);
  }

  const movableIds = rounds.filter((r) => !r.isSpillover).map((r) => r.id);
  const [movingId, setMovingId] = useState<string | null>(null);
  async function moveRound(id: string, dir: -1 | 1) {
    const orderedIds = moveId(movableIds, id, dir);
    if (orderedIds === movableIds) return;
    setMovingId(id);
    setError(null);
    try {
      await api(`/api/packets/${packet.id}/rounds/reorder`, "POST", { orderedIds });
      setRounds((rs) => {
        const byId = new Map(rs.map((r) => [r.id, r]));
        return [
          ...orderedIds.map((rid) => byId.get(rid)!),
          ...rs.filter((r) => r.isSpillover),
        ];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reorder rounds");
    } finally {
      setMovingId(null);
    }
  }
```

- [ ] **Step 2: Render controls and pass props.** Replace the opening of the `{/* Rounds */}` block (`<div className="space-y-4">` through the `<RoundBlock … />` props start) with:

```tsx
      {/* Rounds */}
      <div className="space-y-3">
        {rounds.length > 1 && (
          <div className="flex items-center justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => persistCollapsed(new Set())}>
              Expand all
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => persistCollapsed(new Set(rounds.map((r) => r.id)))}
            >
              Collapse all
            </Button>
          </div>
        )}
        {rounds.map((round) => (
          <RoundBlock
            key={round.id}
            round={round}
            open={!collapsed.has(round.id)}
            onToggle={() => toggleRound(round.id)}
            canMoveUp={!round.isSpillover && movableIds.indexOf(round.id) > 0}
            canMoveDown={!round.isSpillover && movableIds.indexOf(round.id) < movableIds.length - 1}
            moving={movingId === round.id}
            onMove={(dir) => moveRound(round.id, dir)}
```

(keep the existing props after it: `llmReady`, `onRoundPatch`, …).

- [ ] **Step 3: Update `RoundBlock`.** Add the new props to its destructuring and type, then:

1. In `<header …>` change `className` to `"flex flex-wrap items-center gap-2 p-3" + (open ? " border-b border-border" : "")` (use `cn` imported from `@/lib/utils`; add to the existing `formatUsd, formatDateTime` import line).
2. Insert as the FIRST child of the header:

```tsx
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={open ? `Collapse ${round.name}` : `Expand ${round.name}`}
          aria-expanded={open}
          onClick={onToggle}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", !open && "-rotate-90")} />
        </Button>
```

3. Insert before the Delete button:

```tsx
        {!round.isSpillover && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Move ${round.name} up`}
              disabled={!canMoveUp || moving}
              onClick={() => onMove(-1)}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Move ${round.name} down`}
              disabled={!canMoveDown || moving}
              loading={moving}
              onClick={() => onMove(1)}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </>
        )}
```

4. Wrap everything after `</header>` (the `<ul>` and the add-question `<div className="p-3">`) in `{open && ( <> … </> )}`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean, tests pass.

- [ ] **Step 5: Manual checks (report as unverified if not run):** collapse persists across reload; with `localStorage` blocked all rounds show expanded; Up/Down swap and survive reload; JD round has no arrows and stays last; reordering changes the learner round order.

- [ ] **Step 6: Commit (after user OK)**

```bash
git add components/packet-editor.tsx
git commit -m "feat: collapsible and reorderable rounds"
```

---

### Task 7: Reset dialog + header design pass

**Files:**
- Create: `components/reset-packet-dialog.tsx`
- Modify: `components/packet-editor.tsx` (header, render dialog)

**Interfaces:**
- Consumes: `companyConfirmed` (Task 1), reset route (Task 3).
- Produces: `<ResetPacketDialog packetId company open onClose onDone />` where `onDone: () => void` is called after the API succeeds.

- [ ] **Step 1: Create `components/reset-packet-dialog.tsx`:**

```tsx
"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { companyConfirmed } from "@/lib/sections";

/** Two-step confirmation: (1) read what is deleted, (2) type the company name. */
export function ResetPacketDialog({
  packetId,
  company,
  open,
  onClose,
  onDone,
}: {
  packetId: string;
  company: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [clearAddOns, setClearAddOns] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setClearAddOns(false);
      setTyped("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/packets/${packetId}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmCompany: typed, clearAddOns }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Reset failed");
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-5 shadow-lg"
      >
        <h2 id="reset-title" className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Reset packet {step === 1 ? "(1 of 2)" : "(2 of 2)"}
        </h2>

        {step === 1 ? (
          <>
            <div className="space-y-2 text-sm">
              <p>This will permanently delete:</p>
              <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                <li>all rounds and questions, including your edits and the JD round</li>
                <li>the list of questions you deleted before</li>
              </ul>
              <p>It then regenerates the packet from scratch and sets it back to Draft.</p>
              <p className="text-muted-foreground">
                Kept: the packet, its link, the JD, learner read stats and feedback.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={clearAddOns}
                onChange={(e) => setClearAddOns(e.target.checked)}
              />
              Also clear Interview Companion Add-Ons
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => setStep(2)}>
                Continue
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm">
              Type <strong>{company}</strong> to confirm.
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={company}
              autoFocus
              aria-label="Type the company name to confirm"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" disabled={busy} onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                variant="destructive"
                loading={busy}
                disabled={busy || !companyConfirmed(typed, company)}
                onClick={submit}
              >
                Reset packet
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the dialog + header redesign in `components/packet-editor.tsx`.**

Add `RotateCcw` to the `lucide-react` import and `import { ResetPacketDialog } from "@/components/reset-packet-dialog";`. Add state next to `busy`:

```tsx
  const [resetOpen, setResetOpen] = useState(false);
```

Replace the whole header block (`<div className="flex flex-wrap items-start justify-between gap-3">` … its closing `</div>` before `<GenerationProgress …/>`) with a card-style header: title/meta left; right side split into a status+link group and an actions group, with Reset set apart:

```tsx
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <Link href="/packets" className="text-xs text-muted-foreground hover:underline">
          ← All packets
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                {packet.company} — {packet.role}
              </h1>
              {status === "PUBLISHED" ? (
                <Badge variant="success">Published</Badge>
              ) : (
                <Badge variant="warning">Draft</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {TRACK_LABEL[packet.track]} · {YOE_LABEL[packet.yoeBucket]}
              {packet.stack ? ` · ${packet.stack}` : ""} · {packet.location} ·{" "}
              {packet.sourceMode === "SHEET_PLUS_WEB" ? "Sheet + web" : "Sheet only"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {questionCount} questions · {rounds.length} rounds
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CopyLinkButton url={learnerUrl} disabled={status !== "PUBLISHED"} />
            {/* …keep the existing "Pull new questions", cost-limit and Publish/Unpublish buttons unchanged… */}
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw className="h-4 w-4 text-destructive" />
              Reset
            </Button>
            {/* …keep the existing delete-packet icon button unchanged… */}
          </div>
        </div>
      </div>
```

Move the existing Pull-new-questions, cost-limit, Publish and Delete `Button` elements verbatim into the marked spots (do not change their handlers). Remove the now-duplicated status `Badge` conditional from the old right-hand group.

Render the dialog once, right after `<GenerationProgress … />`:

```tsx
      <ResetPacketDialog
        packetId={packet.id}
        company={packet.company}
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onDone={() => {
          setResetOpen(false);
          router.refresh(); // picks up the new generation job, same as "Pull new questions"
        }}
      />
```

(The editor's `key` includes `rounds.length`, so it remounts with fresh data when the reset empties the rounds.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean, all tests pass.

- [ ] **Step 4: Manual checks (report as unverified if not run), on a throwaway packet in a local DB the user has migrated:** first dialog shows what is deleted; "Continue" → second dialog; Reset button stays disabled until the exact company name is typed; wrong case keeps it disabled; reset while a job runs shows the 409 message and deletes nothing; after reset, rounds are gone, status is Draft, Add-Ons intact (unticked) or cleared (ticked), a new generation job starts and the progress bar appears.

- [ ] **Step 5: Commit (after user OK)**

```bash
git add components/reset-packet-dialog.tsx components/packet-editor.tsx
git commit -m "feat: guarded packet reset and header redesign"
```

---

### Task 8: Final verification & docs

**Files:**
- Modify: `docs/decisions.md` (append: Add-Ons saves via explicit Save button, not on blur, so half-typed notes never reach learners)

- [ ] **Step 1: Full check**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all clean/pass.

- [ ] **Step 2: Append the decision** to `docs/decisions.md`:

```md
- **Add-Ons use an explicit Save button, not save-on-blur** (2026-11-09). Why: a half-typed note would otherwise go live to learners. Rejected: autosave.
```

- [ ] **Step 3: Report to the user** what is NOT verified (anything in the manual checklists not actually run in a browser), that the migration must be applied by them, and that nothing was pushed or deployed.

- [ ] **Step 4: Commit (after user OK)**

```bash
git add docs/decisions.md
git commit -m "docs: record add-ons save decision"
```

---

## Self-review

- **Spec coverage:** data (Task 2); PATCH addOns / reorder / reset incl. 409, confirmation, activity log, enum+label (Tasks 2–3); admin Add-Ons editor with edit/preview + visibility badge (5); collapsible rounds, expand/collapse all, localStorage, Up/Down, JD pinned (6); design pass + reset dialogs + checkbox (7); learner card hidden when empty, 3-line preview, expand in place, no raw HTML (4); markdown dependency with docs check (4); tests (1). Spec's "save on blur" intentionally changed to explicit Save (documented in Tasks 5/8).
- **Placeholders:** the only non-code instructions are the "keep existing buttons verbatim" markers in Task 7 Step 2 and the "wrap in `{open && …}`" instruction in Task 6 Step 3, both with explicit anchors.
- **Type consistency:** `moveId`, `isSameIdSet`, `companyConfirmed`, `packetResetData`, `normalizeAddOns`, `addOnsNeedsToggle`, `ADDONS_MAX` names/signatures match across Tasks 1, 3–7. `RoundBlock` props defined in Task 6 are all passed in Step 2.
- **Review Focus coverage:** items 1–4 pinned by Task 1 tests (and enforced in Task 3 routes); 5 and 6 are manual checks in Tasks 5 and 6 because vitest here only runs node-side `lib/**` tests.
