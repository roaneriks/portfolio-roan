# Analytics setup — one-time steps

The site now has anonymous visitor tracking (Supabase) and a private
dashboard at **roaneriks.com/admin**. The code is done; it just needs a
Supabase project and three environment variables on Vercel. Roughly 10
minutes, everything on free tiers.

Want to see the dashboard before doing any of this? Open
`/admin?demo=1` — it runs on generated sample data.

---

## 1 · Create the Supabase project (~3 min)

1. Go to [supabase.com](https://supabase.com) → sign in → **New project**
2. Name: `portfolio-analytics` · Region: **Europe West (Frankfurt or Paris)**
3. Set any strong database password (you'll never need it again — Supabase
   just requires one)
4. Wait ~1 minute while the project provisions

## 2 · Create the events table (~1 min)

1. In the Supabase dashboard: **SQL Editor** → **New query**
2. Paste the entire contents of [`supabase/setup.sql`](supabase/setup.sql) → **Run**
3. You should see "Success. No rows returned"

## 3 · Copy the two credentials (~1 min)

In the Supabase dashboard under **Project Settings**:

| What | Where to find it | Looks like |
|---|---|---|
| Project URL | Settings → Data API (or General) | `https://abcdefgh.supabase.co` |
| Secret key | Settings → API Keys → **secret** key (click Reveal) | `sb_secret_…` |

⚠️ The **secret** key, not the "publishable"/"anon" one. It never ships to
browsers — it only lives on Vercel's servers.

## 4 · Add the env vars on Vercel (~2 min)

Vercel dashboard → your portfolio project → **Settings → Environment
Variables**. Add these three (environment: **Production** — add Preview too
if you use preview deploys):

| Name | Value |
|---|---|
| `SUPABASE_URL` | the Project URL from step 3 |
| `SUPABASE_SECRET_KEY` | the secret key from step 3 |
| `ADMIN_PASSWORD` | any password you choose — this is what you'll type into /admin |

## 5 · Deploy

Push to git as usual (`git add -A && git commit && git push`). Vercel picks
up the new `/api` functions automatically — no config changes needed.

## 6 · Check it works

1. Visit **roaneriks.com** in a normal browser tab → click around a little
2. Open **roaneriks.com/admin** → enter your `ADMIN_PASSWORD` → your visit
   should appear within seconds (Refresh button reloads the data)

---

## Good to know

- **Your own visits are excluded** in any browser where you've opened
  `/admin` (it sets a flag in that browser's localStorage). Open `/admin`
  once on your phone too if you check the site from there a lot.
- **What's collected:** page views, referrer/UTM source, clicks with position
  (feeds the click map), outbound clicks, time-on-page, scroll depth, device/
  browser/OS/language, and country/region/city from Vercel's request
  headers. **No IPs, no names, no cookies** — visitors get a random ID.
- **Where things live:**
  - `js/analytics.js` — the tracker, loaded on every page
  - `api/track.js` / `api/stats.js` — Vercel functions (write / password-gated read)
  - `admin.html`, `css/admin.css`, `js/admin.js` — the dashboard
  - `supabase/setup.sql` — the database schema
- **Free-tier headroom:** Supabase free tier stores 500 MB (millions of
  events); Vercel Hobby includes ~100k function calls/month. Portfolio
  traffic won't get anywhere near either.
