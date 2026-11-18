# Decisions

## 2026-10-05 — Learner packet page redesign (Figma "Interview Packet Reader")

**Teal palette scoped to learner pages only.** A `.learner` class on the `/p/[slug]` shell overrides the shared colour variables (`app/globals.css`).
- Dark values are the Figma variables. Light values were sampled from the light frame, because the Figma MCP rate limit blocked the light variables. Swap in exact hex codes when they're available.
- Why: admin pages (dashboard, editor, charts) stay navy + tangerine, with no need to re-check them visually.
- Rejected: app-wide palette swap.

**UI-only scope; topic tags and question details deferred.** Topic tags, the topic mix bar, filter chips, "Has schema", "Problem · N columns", Scenario and Columns required are all left out. Expand all and chevrons are dropped because there is nothing to expand.
- Why: questions store only `displayText` and `problemLink`. Tags and details need a DB change, a new LLM classification/extraction step with a golden set and evals, and a backfill of existing packets.
- Rejected: shipping these with heuristics or unevaluated prompts.

**Kept although not in Figma:** the "Solve this question" link, the feedback button, the account menu and round duration.

**One round at a time; reading progress redefined.** `PacketRead.scrollPct` now means rounds scrolled to the end ÷ total rounds (2 of 4 = 50%).
- A round counts once its end marker comes into view with no search filter applied.
- Completed rounds are kept in `localStorage` (`rounds-done:<slug>`) so return visits add up on the same browser. Visits on other devices don't merge, though the server keeps the highest value it has seen.
- Values before this date were page-scroll depth of the single-page layout and are not comparable.
- Rejected: all rounds stacked (keeps the old metric but diverges from Figma), and one-round view with page scroll (the metric becomes meaningless).

## 2026-11-09 — Packet sections, Add-Ons, reset (phase 1)
- **Sections = rounds for phase 1; custom sections later.** Why: covers add/move/collapse with no model rewrite. Rejected: making header, rounds, JD and Add-Ons one generic ordered list.
- **Add-Ons is a nullable `Packet.addOns` markdown column**, not a table. Why: one special section per packet. Rejected: list-of-items model, plain text.
- **Up/Down buttons, not drag-and-drop.** Why: no new library, touch/keyboard friendly.
- **Reset keeps the packet and learner link; Add-Ons kept unless a box is ticked.** Why: "refresh", not delete. Rejected: deleting the packet; always wiping Add-Ons.
- **JD round is capped at 50 in total** (earlier today): a pull only fills remaining slots. Rejected: 50 new per pull.
- **JD topic shown as a flag by parsing the stored `[Topic] ` prefix on render.** Why: no migration, fixes existing data. Rejected: a `topic` column.
- **Add-Ons use an explicit Save button, not save-on-blur** (2026-11-09). Why: a half-typed note would otherwise go live to learners. Rejected: autosave.

## 2026-11-17 — Preparatory Kit
- **Admin pastes HackMD markdown; no fetch or iframe.** Why: no network dependency or framing block, and scroll depth stays measurable. Rejected: fetching `hackmd.io/<id>/download`, iframe embed (cross-origin → no scroll tracking). Tradeoff: HackMD edits don't propagate; admin re-pastes.
- **Kit is `Packet.prepMaterial` (nullable text), not a Round.** Why: a Round would leak into round progress, reordering and question counts. Rejected: round with a `kind` flag.
- **Kit tracking is its own `PrepRead` table** (first/last read, furthest scroll % + when reached, total seconds), dashboard + CSV only, not mirrored to Sheets. Rejected: extending `PacketRead` (would change round-progress meaning).
- **Link format `/p/<slug>#prep`**, same hash scheme as `#rN`. With a kit and no hash, the reader opens on the kit.
- **Added `remark-gfm`** (user approved) so HackMD tables, task lists and strikethrough render; table/`img`/`pre` styling added to `Markdown` (also applies to Add-Ons). Rejected: leaving core Markdown only.
- **Learner container widened 1040px → 1440px**; kit prose capped at 88ch for line length.

## 2026-11-17 — Learner reader redesign (Option C · Studio)
- **Picked option C** (`design/option-c.html`); tokens in `docs/design-tokens.md`. Three panes: sections rail | content | context panel; rows with hairlines instead of boxed cards; 3px reading-progress bar. Container 1440px → 1280px, content column ≤ 760px (the 1440 widening would have stretched lines).
- **Fonts: kept Manrope + DM Mono** (already loaded). Rejected: adding JetBrains Mono (extra font file for a near-identical look). Earlier claim that the app used Geist was wrong.
- **Add-Ons became a rail item** (`#addons`, after the Kit) instead of a card above the content. `components/addons-card.tsx` is now unused (left in place, not deleted).
- **Vault banner became a compact card** in the rail (desktop) / under the content (phone); click logging unchanged.
- **Progress rings are honest, not fancy:** rounds are 0 or 100% (the app only records "reached the end"); the kit shows furthest scroll %, both remembered in `localStorage`. No overall "% read" in the header (server only tracks rounds).
- **Topic filters only where `[Topic]` prefixes exist** (JD round). Kit outline is read from rendered headings (ids from `makeSlugger`), no new library. Outline links scroll via JS, not `#anchors`, because the hash is the view router.

## 2026-11-18 — Sections rail: stepper (option 2 of `design/rail-options.html`)
- **Why:** inactive items were dim grey and the current one a faint tint, so the rail blended into the content. Chose the grouped stepper (Prepare / Rounds, connected nodes: check = finished, pie = started, hollow = not started, glowing = current, full-strength labels). Rejected: panel with solid fill (doesn't show progress as clearly), tiles (needs a summary line per section and more room).
- Phone keeps the swipe row; current item gets an accent border + tint. Add-Ons node stays hollow (nothing tracks it). "Start here" tag shows on the Kit until it has been scrolled at all.
