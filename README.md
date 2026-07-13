# Computers2Kids (C2K) Contribution Tracker

A full-stack web app for [Computers2Kids](https://www.c2sdk.org/), a nonprofit
that refurbishes and distributes donated computers. It has two sides:

- **Volunteer tracker** (mobile-first) — volunteers log the parts they refurbish
  and track their personal all-time totals for service records, resumes, and
  college applications.
- **Admin dashboard** (desktop-first) — real-time aggregate totals, a live
  activity feed, and parts-catalog management.

Built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and
**Supabase** (Postgres + Auth + Realtime). Designed to run **indefinitely on the
Supabase and Vercel free tiers**.

---

## Free-tier design notes

Every decision targets the free tier (500 MB DB, 2 GB bandwidth/mo, 200 realtime
connections):

- **One** real-time subscription in the whole app — the admin live feed (also
  drives the aggregate tiles). Volunteers open **zero** subscriptions, so only a
  handful of admins hold persistent connections.
- **No polling anywhere.** Volunteer data changes only on page load and taps.
- **Aggregates use indexed `GROUP BY` RPCs** (`get_part_totals`,
  `get_my_part_totals`, `get_all_part_totals`) — never fetch-all-and-sum in JS.
- **Parts list is cached client-side** after the first server render.
- Indexes on `contributions.volunteer_id`, `part_id`, `created_at`, and a
  composite `(volunteer_id, part_id)`.

---

## 1. Prerequisites

- Node.js 18.17+ and npm
- A free [Supabase](https://supabase.com) project
- (For deploy) a free [Vercel](https://vercel.com) account

---

## 2. Set up the Supabase database

1. Create a new project in the Supabase dashboard.
2. Open **SQL Editor** and run the migration files, in order:
   - `supabase/migrations/0001_init.sql` — tables, indexes, RLS policies, the
     new-user trigger, and the aggregate RPCs.
   - `supabase/migrations/0002_seed_parts.sql` — the 12 default parts.
   - `supabase/migrations/0003_volunteer_stats.sql` — the admin per-volunteer
     stats RPC (powers the "Volunteer Stats" search on the dashboard).

   > Prefer the CLI? With the [Supabase CLI](https://supabase.com/docs/guides/cli)
   > linked to your project, run `supabase db push`.

3. **Enable Realtime on the `contributions` table.** `0001_init.sql` already adds
   it to the `supabase_realtime` publication. Confirm under
   **Database → Replication** that `contributions` is included. (No other table
   needs realtime.)

4. Email confirmation is **not** required by this app. Under
   **Authentication → Providers → Email**, make sure "Confirm email" is turned
   **off** so signups can log in immediately. (This is essential: volunteers sign
   up with a **username**, not a real email — see below — so confirmation emails
   could never be delivered anyway.)

   > **Username-based accounts (no personal info).** The UI collects only a
   > username + password. Supabase Auth is email-based, so the app derives a
   > synthetic internal email from the username (`jordan` → `jordan@c2k.local`).
   > No real email is ever collected or sent. The username is stored as the
   > volunteer's `display_name` and shown throughout the app. Usernames are
   > unique automatically (the synthetic email is unique). Accounts created
   > earlier with a real email still work — enter the full email in the Username
   > field to log in.

5. **Data API / Security settings** (Project Settings → API, or shown during
   project creation):
   - **Enable Data API** → **ON** (required — `supabase-js` uses the REST API).
   - **Automatically expose new tables** → **OFF** (recommended). The migration
     grants access explicitly to only the `authenticated` role for the four
     tables, so nothing else is exposed. RLS still governs row access.
   - **Enable automatic RLS** → **ON** (safety net; the migration already enables
     RLS on every table).

---

## 3. Configure environment variables

Copy the example file and fill in your project's values (from Supabase
**Project Settings → API**):

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

Both are the **public** anon values — safe to expose to the browser. Row Level
Security protects the data.

---

## 4. Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Sign up (username + password — no email), and you
land on the tracker. Tap a part to log your first contribution — start to first
log takes well under a minute.

---

## 5. Designate the first admin

Admin access is controlled by the `admins` table. There's no UI to create the
first admin (by design — it prevents privilege escalation), so add it manually:

1. Have the person **sign up** in the app first. This creates their row in
   `public.volunteers` (via the signup trigger).
2. In Supabase **SQL Editor**, grant admin by their username in one statement:

   ```sql
   insert into public.admins (volunteer_id)
   select id from public.volunteers where display_name = 'their-username';
   ```

   (Look up who exists with `select id, display_name from public.volunteers;`.)

3. Have them reload the app — an **Admin** link now appears in the nav. Existing
   admins can add further admins directly in the `admins` table (or you can build
   a small UI later; the RLS already permits admins to write that table).

---

## 6. Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **New Project → import the repo**. Vercel auto-detects Next.js.
3. Add the two environment variables (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`) under **Settings → Environment Variables**.
4. Deploy. That's it — no server config, no background jobs, no edge functions.

---

## Project structure

```
app/
  layout.tsx              Root layout
  page.tsx                Redirect → /tracker or /login
  login/page.tsx          Login + signup
  (app)/layout.tsx        Auth guard + nav (resolves admin status)
  (app)/tracker/page.tsx  Volunteer tracker (server-loaded, client-interactive)
  (app)/history/page.tsx  Personal history (last 20)
  (app)/admin/page.tsx    Admin dashboard (admin-guarded)
components/
  AuthForm.tsx, Nav.tsx
  tracker/                Tracker, PartButtonGrid, PersonalTotals, UndoToast,
                          AbuseModal, HistoryLog
  admin/                  AdminDashboard, AggregateTotals, PartsManagement,
                          LiveActivityFeed
  ui/                     ErrorBanner, Spinner
lib/
  supabase/               client.ts, server.ts, middleware.ts
  time.ts, types.ts
middleware.ts             Session refresh + auth redirects
supabase/migrations/      0001_init.sql, 0002_seed_parts.sql,
                          0003_volunteer_stats.sql
```

## Security (Row Level Security)

All four tables have RLS enabled:

- **parts** — any authenticated user reads active parts; admins read/write all.
- **volunteers** — a user reads/updates only their own row; admins read all.
- **contributions** — a user reads/inserts/deletes only their own rows
  (delete powers the 5-second undo); admins read all.
- **admins** — only admins read/write.
