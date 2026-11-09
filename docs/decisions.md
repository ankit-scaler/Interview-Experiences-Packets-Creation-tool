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
