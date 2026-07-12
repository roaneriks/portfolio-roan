/* =========================================================================
   /api/stats — password-gated read endpoint for the admin dashboard.

   The dashboard (admin.html) sends the password in an `x-admin-key` header;
   this function checks it against the ADMIN_PASSWORD env var and, if it
   matches, returns raw events for the requested date range. All aggregation
   (top pages, charts, heatmap) happens client-side in js/admin.js — at
   portfolio traffic volumes that's plenty fast and keeps this function dumb.

   Env vars required:
     SUPABASE_URL, SUPABASE_SECRET_KEY  (same as /api/track)
     ADMIN_PASSWORD                     the password you type into admin.html
   ========================================================================= */

import { timingSafeEqual } from 'node:crypto';

// Compare password without leaking length/timing information.
function passwordMatches(given, expected) {
  if (typeof given !== 'string' || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const PAGE_SIZE = 1000;   // Supabase REST returns max 1000 rows per request
const MAX_ROWS = 20000;   // safety cap so one call can't fetch forever

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SUPABASE_URL, SUPABASE_SECRET_KEY, ADMIN_PASSWORD } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Analytics not configured' });
  }

  if (!passwordMatches(req.headers['x-admin-key'], ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Wrong password' });
  }

  // ?days=7 | 30 | 90 | 365 | all  (default 30)
  const daysParam = req.query.days === 'all' ? null : parseInt(req.query.days, 10) || 30;
  let filter = '';
  if (daysParam) {
    const since = new Date(Date.now() - daysParam * 24 * 60 * 60 * 1000).toISOString();
    filter = `&created_at=gte.${since}`;
  }

  // Page through results with Range headers until done or we hit the cap.
  const events = [];
  let truncated = false;
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/events?select=*&order=created_at.desc${filter}`,
      {
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
          Range: `${from}-${from + PAGE_SIZE - 1}`,
        },
      }
    );
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      console.error('[stats] Supabase read failed:', resp.status, detail);
      return res.status(502).json({ error: 'Read failed' });
    }
    const page = await resp.json();
    events.push(...page);
    if (page.length < PAGE_SIZE) break;          // last page reached
    if (from + PAGE_SIZE >= MAX_ROWS) truncated = true;
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ events, truncated });
}
