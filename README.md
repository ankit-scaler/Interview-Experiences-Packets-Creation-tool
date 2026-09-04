# Interview Packet Creation & Distribution Tool

Internal tool for Scaler. Two audiences:

- **Admins** (`@scaler.com` Google accounts) generate round-wise interview-question
  "packets" for a company × role × experience band, edit them, and publish.
- **Learners** (any Google account) open a first-party link, sign in, and read the
  packet with a dark/light toggle. Reads and feedback are tracked.

## How a packet is built

Admin picks track + company + role + years of experience (+ optional stack and JD),
and whether to use the sheet only or sheet + web. A resumable job then:

1. **Reads the question sheet** for the track and fuzzy-matches company + role.
2. **Scope-filters** genuinely ambiguous roles with a cheap LLM pass (skipped when
   the deterministic match is already clear).
3. **Improves readability** of rough questions (original + improved both kept).
4. **Researches the web** (Sheet + web mode only) using the manual packet prompt,
   restricted to LeetCode / GfG / LinkedIn / Medium (each selectable per packet).
5. **Merges & de-duplicates** (trigram similarity, LLM tie-break for borderline).
6. **Names the rounds** (`R1` → "DSA Round · 1 hour", inferred from content).
7. **Adds JD spillover** — ~10 questions per JD tech that isn't otherwise covered.
8. **Finds practice links** for coding questions on LeetCode / GfG.
9. **Saves** the packet as a draft for review.

Re-running create for the same company × role × experience **appends** new questions
to the existing packet (admin edits/removals are preserved; removed questions never
come back).

## Stack

Next.js 14 (App Router) · Prisma + Postgres (Neon) · Auth.js v5 (Google) ·
OpenRouter via the `openai` SDK (Claude / GPT, web-search plugin) · Google Sheets API (service account) ·
Tailwind + a small shadcn-style UI kit · deploys to Vercel Hobby.

## Getting started

See **[SETUP.md](./SETUP.md)** for the full step-by-step (Neon, Google Cloud OAuth +
service account, OpenRouter key, Vercel). Short version:

```bash
npm install
# a pre-filled, git-ignored .env is already in the repo — replace the TODO values
npx prisma migrate deploy
npm run dev
npm test
```

The app runs without Google Sheets or OpenRouter configured — it uses a built-in
sample question set and skips the LLM steps, so you can click through the whole flow
immediately.

## Cost

All infrastructure is free tier. OpenRouter is the only paid piece; Sheet-only
packets make **zero** LLM calls. Every packet's token + dollar cost is shown in the
admin UI and the tracking tables, and a per-run ceiling (`MAX_PACKET_COST_USD`)
aborts runaway generations.
