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
