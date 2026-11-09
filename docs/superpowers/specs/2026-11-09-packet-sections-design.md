# Packet page: sections, Add-Ons, reset — Design (phase 1)

Date: 2026-11-09 · Status: draft for review

## Intent (agreed)
Admins get collapsible, reorderable rounds, a refreshed page design, an
"Interview Companion Add-Ons" section (admin-written markdown) and a guarded
"Reset" button. Learners see Add-Ons only when it has content, as a 3-line
preview that expands on click. Phase 2 (custom free-form sections) is out of scope here.

## Decisions
- "Sections" in phase 1 = the existing rounds. Add-Ons is one special section per packet.
- Reorder with Up/Down buttons (no drag-and-drop library).
- Add-Ons content is markdown, rendered with `react-markdown` (raw HTML disabled). New dependency — check current docs via context7 before adding.
- Reset keeps the packet (slug, company, role, JD, reads); Add-Ons kept unless the "also clear Add-Ons" box is ticked (default off).
- Nothing is deployed or migrated by Claude; the user applies the migration.

## 1. Data
- Migration: `ALTER TABLE "Packet" ADD COLUMN "addOns" TEXT;` (Prisma: `addOns String? @db.Text`).
- No new tables. Empty/whitespace-only `addOns` is treated as "not added".

## 2. API
- `PATCH /api/packets/[id]` (existing route): accept `addOns` (string | null, max 20 000 chars; trimmed; empty → null). Admin only.
- `POST /api/packets/[id]/rounds/reorder` body `{ orderedIds: string[] }`: must be exactly the packet's non-spillover round ids; renumbers `order` 0..n-1 in one transaction. Spillover round keeps its pinned position (learner query already sorts `isSpillover` last).
- `POST /api/packets/[id]/reset` body `{ confirmCompany: string, clearAddOns: boolean }`:
  1. Admin only. 409 if a generation job is PENDING/RUNNING (not stale).
  2. `confirmCompany` must equal `packet.company` (case-sensitive, trimmed) else 400.
  3. One transaction: delete all Questions, Rounds, SuppressedQuestions; set `jdSummary = null`, `lastSheetRowDate = null`, `lastGeneratedAt = null`, `status = DRAFT`; if `clearAddOns`, set `addOns = null`.
  4. Start a generation job via `startGenerationJob` (question count is 0, so it runs as INITIAL).
  5. Log activity (`PACKET_RESET`, includes clearAddOns flag). Add `PACKET_RESET` to the `AdminAction` enum in the same migration (and its label in `lib/labels.ts`).
- PacketRead, feedback, vault clicks, LlmCall history are kept.

## 3. Admin UI (`components/packet-editor.tsx`, `app/(admin)/packets/[id]/page.tsx`)
- Add-Ons card above rounds: collapsible, markdown textarea + Edit/Preview toggle, save on blur (loading state), badge "Visible to learners" / "Hidden — empty".
- RoundBlock: chevron collapse (header stays visible with name, duration, question count), Up/Down buttons (disabled at ends, spillover pinned last), expand-all / collapse-all control. Collapse state in `localStorage` per packet (try/catch; page works without it).
- Design pass within existing tokens/components: header with status chip + grouped actions, card-style round headers, spacing. Light/dark via tokens only. Every action shows a loader and disables its button.
- Reset button in the page header: dialog 1 (what will be deleted / kept, optional "also clear Add-Ons" checkbox) → dialog 2 (type company name; button disabled until it matches) → POST → generation progress UI as today.

## 4. Learner UI (`app/p/[slug]/page.tsx`)
- New client component `AddOnsCard`, rendered above `VaultCard` only when `addOns` is non-empty.
- Collapsed: heading "Interview Companion Add-Ons" + 3-line clamped preview + "Read more". Click toggles in place (button, `aria-expanded`). No server round trip.
- Markdown rendered by `react-markdown`, no raw HTML, links open in a new tab with `rel="noreferrer"`.

## 5. Testing / verification
- Unit: reorder validation + renumbering, reset confirmation/guard logic (pure helpers), addOns normalisation.
- `tsc`, `next lint`, `vitest`.
- Not verifiable by Claude without running the app: visuals, dialog flow, markdown rendering. Will be reported as unverified.

## Out of scope
Custom free-form sections (phase 2), drag-and-drop, changing learner round navigation, deploy.
