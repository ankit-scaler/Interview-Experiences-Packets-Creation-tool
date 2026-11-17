# Design tokens — learner reader (Option C · Studio)

Picked 2026-11-17 from `design/option-c.html`. Scope: learner packet page `/p/[slug]` only (the `.learner` scope in `app/globals.css`). Admin stays navy + tangerine.

## Colour

| Token | Light | Dark |
|---|---|---|
| bg | #F6F8F7 | #0A1210 |
| surface | #FFFFFF | #101C18 |
| fg | #10201A | #E5F2EC |
| muted | #58695F | #8CA399 |
| line | #DDE6E1 | #1F322B |
| accent | #0B7A55 | #34D399 |
| accent-ink (text on accent) | #FFFFFF | #052018 |
| accent-soft | #DDF3E8 | #12372B |
| warn (eyebrow, stars) | #A85A00 | #F2A64B |

## Type

- Display/body: Manrope 400/500/600/700/800 (already loaded app-wide in `app/layout.tsx`).
- Mono (numbers, topic tags, code): DM Mono 400/500 (already loaded; chosen over JetBrains Mono to avoid a new font file).
- Scale: h1 clamp(24px, 3.4vw, 34px)/1.15 800 · h2 26px/1.25 800 · kit prose 17px/1.75 · question text 16.5px/1.6 500 · meta 13px · eyebrow/labels 11px uppercase +0.14em.
- Kit prose width ≤ 760px; question column ≤ 760px.

## Layout

- Container 1280px. Grid: rail 240px | content (min 0) | context panel 220px, gap 32px.
- ≤1060px: context panel hidden. ≤760px: single column, rail becomes a horizontal scroll tab row.
- Radius: 6px controls, 8–10px panels. Rows separated by 1px `line`, not boxed cards.
- Fixed 3px reading-progress bar at top (accent).

## Components

- Buttons: primary (accent fill), secondary (surface + line border), ghost; disabled 50% + spinner while busy.
- Progress ring (22px conic) per section, mono count on the right.
- Topic tag: mono 11px, accent-soft fill, 4px radius.
- Loaders: 20px spinner, skeleton shimmer; both stop under `prefers-reduced-motion`.
- Theme: follows system, manual toggle, persisted, no flash (existing `theme-provider`).
