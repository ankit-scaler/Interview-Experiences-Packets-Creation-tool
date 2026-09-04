# Setup — Interview Packet Tool

Everything here is on a **free tier**. The only paid dependency is OpenRouter,
and generation is built to keep token spend low (Sheet-only mode makes zero LLM calls).

Follow the steps in order. Each `➜` line is something you paste somewhere.

---

## 0. Prerequisites

- Node 20 (`node -v` → `v20.x`). Already installed on your machine.
- The cloned repo (this folder).
- A Google account that can access the two spreadsheets.

```bash
npm install
```

A pre-filled **`.env`** is already in the repo (git-ignored). Open it and replace the
`TODO` / placeholder values as you go. One file — both Next.js and the Prisma CLI
read it. (`.env.example` is the blank reference copy.)

---

## 1. Database — Neon (free)

1. Go to <https://neon.tech> → sign in with Google → **Create project**
   (name: `interview-packets`, region: closest to you).
2. On the project dashboard, **Connection string** panel:
   - Copy the **Pooled connection** string → paste as `DATABASE_URL` in `.env`.
   - Toggle **"Connection pooling" off**, copy that string → paste as `DIRECT_URL`.
   - Append `&pgbouncer=true&connect_timeout=15` to `DATABASE_URL` and
     `&connect_timeout=15` to `DIRECT_URL`.

Neon free-tier computes auto-suspend after ~5 min idle, so the app talks to Neon
through the **Prisma Neon driver adapter** (WebSocket transport — already wired in
`lib/db.ts`). The first request after an idle period is slow (~4s) while the compute
wakes, then fast; that's inherent to the free tier.

```bash
npx prisma migrate deploy   # creates all tables
```

(Use `npm run db:migrate` instead while developing — it creates migration files.)

---

## 2. Google Cloud project

1. <https://console.cloud.google.com> → project picker → **New Project**
   (name: `interview-packets`).
2. Make sure this project is selected for every step below.

### 2a. Enable the Sheets API

➜ APIs & Services → **Enable APIs and Services** → search **Google Sheets API** → **Enable**.

### 2b. OAuth consent screen

➜ APIs & Services → **OAuth consent screen**

- User type: **Internal** if your Google Workspace allows it (simplest — only
  `@scaler.com` users can sign in). Otherwise **External** and add yourself + a few
  teammates as **Test users**.
- App name: `Interview Packets`. Support email: yours.
- Scopes: add `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`.
- Save.

### 2c. OAuth client (for sign-in)

➜ APIs & Services → **Credentials** → **Create Credentials** → **OAuth client ID**

- Type: **Web application**
- Authorized redirect URIs — add **both**:
  - `http://localhost:3000/api/auth/callback/google`
  - `https://YOUR-VERCEL-URL/api/auth/callback/google` (add after step 5, or edit later)
- Create → copy **Client ID** → `AUTH_GOOGLE_ID`, **Client secret** → `AUTH_GOOGLE_SECRET`.

### 2d. Service account (for reading/writing Sheets)

➜ APIs & Services → **Credentials** → **Create Credentials** → **Service account**

- Name: `packets-sheets`. Create → Done (no roles needed).
- Open the service account → **Keys** → **Add key** → **Create new key** → **JSON**.
- Turn the JSON into env lines automatically (avoids copy/paste truncation):

  ```bash
  node scripts/encode-sa-key.mjs ~/Downloads/interview-packets-XXXX.json
  ```

  Paste the two lines it prints into `.env` (`GOOGLE_SA_EMAIL` and
  `GOOGLE_SA_PRIVATE_KEY_BASE64`).

### 2e. Share the spreadsheets with the service account

- Question repo sheet (`10jyG2WkaTRtBTwm0lLQWogLibqLU6qAGr5OhKh9xcoE`)
  → **Share** → add the `GOOGLE_SA_EMAIL` address as **Viewer**.
- Tracking sheet (`1OT9Xr2W87LAj-PT87P0Mj9J1uuRRWQB9dVaH57xFZ9Y`)
  → **Share** → add it as **Editor**. (The app creates the `Packet Reads`,
  `Read Details`, and `Feedback` tabs automatically on first sync.)

> The app works **without** Sheets configured — it falls back to a small built-in
> sample so you can try the flow immediately. Real question data needs 2d + 2e.

---

## 3. Auth secret

```bash
➜  openssl rand -base64 33      # paste output as AUTH_SECRET
```

Set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to `http://localhost:3000` for now.

---

## 4. OpenRouter API key (can be done later)

<https://openrouter.ai/keys> → **Create key** → paste as `OPENROUTER_API_KEY`.
All model calls (Claude, GPT) go through OpenRouter's OpenAI-compatible gateway.

- `LLM_MODEL` = the research/spillover model, `LLM_MODEL_CHEAP` = everything else.
  Whatever you pick must be enabled on your OpenRouter key. OpenRouter slugs use a
  dot (`anthropic/claude-sonnet-4.6`, `anthropic/claude-haiku-4.5`), not a dash.
- If your OpenRouter key has a daily spend limit, size it for your volume: a
  Sheet+web packet costs ~$0.30-0.45, so a $7/day limit is ~15-20 packets/day.
  Hitting the limit mid-run fails that step with a clear message and can be retried.
- `MAX_PACKET_COST_USD=0.50` aborts any single generation run that would cost more
  (the admin can tick "allow higher cost" on the create form to override).
- Without a key: **Sheet-only** packets still work fully (no readability pass, no
  round-name inference, no web research).

---

## 5. Run locally

```bash
npm run dev
```

Open <http://localhost:3000> → **Continue with Google**.

- Sign in with an `@scaler.com` account → you land on **Packets** (admin).
- Sign in with any other Google account → "You're signed in" learner screen.

### Smoke test

1. **Create** → Track `Academy`, Company `Flipkart`, Role `Application Engineer 2`,
   experience `Less than 2 years`, source `Sheet only` → **Create packet**.
2. Watch the progress bar walk through the steps. Rounds get named, questions appear
   with an Original / Improved comparison where they were edited.
3. Edit a question, paste a LeetCode URL, remove one, **Publish**.
4. Copy the learner link, open it in a private window, sign in with a personal Google
   account → the packet renders, "Solve this question" opens in a new tab, the
   theme toggle works.
5. Submit feedback → it shows under **Tracking → Feedback**.
6. **Tracking → Learner lookup** → paste that email → the packet is listed.
7. **Tracking → Sync to Sheets** → check the tracking spreadsheet.
8. Run **Create** again for the same Flipkart / Application Engineer 2 / <2y → you're
   taken to the *same* packet and only genuinely new questions are appended.

```bash
npm test      # unit tests for matching / normalisation / header mapping
```

---

## 6. Deploy — Vercel (free Hobby plan)

1. Push this repo to GitHub (already remoted at
   `github.com/ankit-scaler/Interview-Experiences-Packets-Creation-tool`).
2. <https://vercel.com> → **Add New → Project** → import the repo.
3. **Environment Variables** — add every key from `.env`, with these exceptions:
   - **Omit `AUTH_URL` and `NEXT_PUBLIC_APP_URL` entirely.** You don't know the URL
     yet, and you don't need to: Auth.js infers the host (`trustHost: true`), and
     packet links fall back to Vercel's injected `VERCEL_PROJECT_PRODUCTION_URL`.
     Add `NEXT_PUBLIC_APP_URL` later only if you put a custom domain in front.
   - `CRON_SECRET` → generate a fresh one (`openssl rand -hex 16`), don't reuse dev.
   - `OPENROUTER_API_KEY` → can stay blank; Sheet-only packets still work.
4. Deploy.
5. Back in Google Cloud → **Credentials** → your OAuth client → add
   `https://YOUR-PROJECT.vercel.app/api/auth/callback/google` to the redirect URIs.
6. `vercel.json` already registers a nightly cron (`/api/cron/sync`, 00:30 IST) that
   mirrors reads + feedback to Sheets and nudges any stuck generation job. Vercel
   sends it with `Authorization: Bearer $CRON_SECRET` automatically — just make sure
   `CRON_SECRET` is set in the project env (`openssl rand -hex 16`).

### Migrations on deploy

The build runs `prisma generate`. To apply schema changes to the Neon database, run
`npx prisma migrate deploy` locally against the production `DATABASE_URL`, or add it
as a Vercel build step.

---

## Notes / limits

- Generation runs as a **resumable step machine** — each HTTP call advances one step
  (< 60 s), the browser drives it, and a failed step can be retried without redoing
  earlier work. This is why it works on Vercel Hobby without long-running functions.
- **Cost visibility**: every packet shows its LLM token + $ cost (per run and
  lifetime, broken down by purpose) in the "Packet info (admin only)" panel and in
  the Tracking tables.
- **What's cached vs. re-computed**: a packet's generated questions/rounds are saved
  permanently — viewing, editing, publishing, and re-visiting cost nothing. The
  Google-Sheet rows are cached per track (a free, no-LLM cache): "Create packet"
  reuses the snapshot (refreshed nightly by cron), "Pull new questions" always
  re-fetches. LLM tokens are spent once per question at creation, and on "Pull new
  questions" only for rows documented since last time.
- **Reads** are counted once per learner per day (first-read and last-read dates are
  kept). **Feedback** is one editable submission per learner per packet.
- Admin = any `@scaler.com` Google account (`ADMIN_EMAIL_DOMAIN`). Everyone else is a
  learner who can open any packet link they're given.
