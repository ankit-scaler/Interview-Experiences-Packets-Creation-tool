# Preparatory Kit — design

Date: 2026-11-17 · Status: awaiting user review

## Goal
Admins add a "Preparatory Kit" (pasted HackMD markdown) to a packet. Learners see it as the first
item above R1, can deep-link to it, and its reading is tracked separately from rounds. The learner
reading page also uses more of the screen width.

## Decisions (agreed in chat)
- **Paste, not fetch.** Admin pastes the HackMD markdown; no HackMD fetch or iframe. Why: no network
  dependency, accurate scroll tracking, reuses the Add-Ons pattern. Tradeoff: HackMD edits don't
  propagate; admin re-pastes.
- **Separate column, not a Round.** A Round would pollute round progress, reorder and question counts.
- **Renderer unchanged** (`react-markdown`, no `remark-gfm`): GFM tables / task lists won't render.
  Adding `remark-gfm` is a separate decision for the user.
- **Landing:** packet with a kit and no URL hash opens on the kit.
- **Sheet sync unchanged:** kit tracking is admin dashboard + CSV only.
- **"Scroll length with time"** = furthest scroll % and the time that depth was first reached.

## Data model (one migration)
- `Packet.prepMaterial String? @db.Text` — null/whitespace = hidden. Max length reuses `ADDONS_MAX`-style cap.
- `PrepRead`: `id, packetId (cascade), userEmail, userId?, firstReadAt, lastReadAt, maxScrollPct Int,
  maxScrollAt DateTime?, secondsTotal Int`; `@@unique([packetId, userEmail])`, indexes on packetId, userEmail.
- `AdminAction` gains `PREP_EDITED` (activity log).

## Admin
- `components/prep-editor.tsx`: copy of `addons-editor.tsx` (Edit/Preview, explicit Save, visibility badge),
  rendered in `packet-editor.tsx` directly above the rounds list.
- Saves through existing `PATCH /api/packets/[id]` (`prepMaterial` accepted + normalized in `lib/sections.ts`),
  logs `PREP_EDITED`.
- Reset keeps the kit (like Add-Ons' default).

## Learner (`/p/[slug]`)
- `page.tsx` passes `prepMaterial` to `PacketReader`; a packet with a kit but zero rounds still renders.
- `PacketReader`: rail gets a first item "Preparatory Kit" (no R-number; rounds stay R1…). Hash `#prep`;
  `#rN` unchanged. Rail stays visible (sticky sidebar / phone tab row) while the kit is open.
  Rendered by `Markdown`. No "Next round" ordering change besides kit → R1.
- Round progress (`ReadTracker`, `totalRounds`) excludes the kit.

## Reading-width change
- Page container `max-w-[1040px]` → `max-w-[1440px]` (header block, add-ons, vault, reader, footer aligned
  to the same cap); side padding stays fluid. Rail stays 210px; the content column takes the rest.
- Kit prose gets a readable line-length cap (~`max-w-[88ch]`) inside the wider column so text isn't
  stretched across ultra-wide screens; question cards fill the column. (Assumption — adjust on review.)

## Tracking
- `components/prep-tracker.tsx` (mounted only while the kit is active): while visible, accumulates seconds
  (20s tick, paused when hidden, flush on pagehide via beacon) and max scroll % of the kit content
  (scroll listener, throttled; % = furthest content-bottom seen ÷ content height, only climbs).
- `POST /api/p/[slug]/prep` `{seconds, scrollPct}`: auth required, internal emails skipped, published
  packets only; upsert `PrepRead` (first/last read), raise `maxScrollPct` + set `maxScrollAt` only on increase,
  add clamped seconds (reuse heartbeat clamps). Idempotent, no per-day rows.
- Admin tracking page: new "Preparatory Kit" table (packet, learner email, first read, last read,
  max scroll %, scroll reached at, time spent) + CSV export; internal-email filter reused.

## Testing / verification
- Vitest for pure helpers: `normalizePrep`, scroll-% calc, hash parsing (`#prep`/`#rN`).
- Run `npm test`, `npm run lint`, `prisma validate`. Not verified automatically: real-browser scroll
  behaviour, migration against production DB (user applies), visual width on real devices.

## Out of scope
HackMD fetch/iframe, `remark-gfm`, Sheet sync of kit reads, multiple kits per packet, per-day kit history.
