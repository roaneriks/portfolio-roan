/* =========================================================================
   /api/track — receives analytics events from js/analytics.js and writes
   them to Supabase.

   Why a serverless function instead of writing to Supabase straight from
   the browser:
   1. The Supabase key stays server-side (Vercel env var) — nothing secret
      ever ships to visitors.
   2. Vercel adds the visitor's country/region/city as request headers on
      every request, so we get geography for free without storing IPs or
      calling a geo API.

   Env vars required (Vercel → Project → Settings → Environment Variables):
     SUPABASE_URL         e.g. https://abcdefgh.supabase.co
     SUPABASE_SECRET_KEY  the "secret" API key (sb_secret_...) or legacy
                          service_role key from Supabase → Settings → API keys
   ========================================================================= */

// Only these fields may be written by the client — anything else in the
// payload is dropped. Keeps the table clean even if someone POSTs junk.
const ALLOWED_FIELDS = [
  'event_type', 'visitor_id', 'session_id', 'view_id', 'is_new_visitor',
  'page', 'page_title', 'referrer', 'source', 'utm_medium', 'utm_campaign',
  'device', 'browser', 'os', 'viewport_w', 'viewport_h', 'language',
  'el_tag', 'el_text', 'el_href', 'x_pct', 'y_doc', 'doc_h',
  'scroll_pct', 'duration_s',
];

const EVENT_TYPES = ['page_view', 'click', 'outbound_click', 'page_leave'];
const MAX_BATCH = 25;        // one flush never carries more than a handful
const MAX_STR = 300;         // hard cap on any text field

function sanitise(raw, geo) {
  if (!raw || typeof raw !== 'object') return null;
  if (!EVENT_TYPES.includes(raw.event_type)) return null;

  const row = {};
  for (const key of ALLOWED_FIELDS) {
    const val = raw[key];
    if (val === undefined || val === null) continue;
    if (typeof val === 'string') row[key] = val.slice(0, MAX_STR);
    else if (typeof val === 'number' && Number.isFinite(val)) row[key] = val;
    else if (typeof val === 'boolean') row[key] = val;
  }
  // Geography comes from the request, not the client payload.
  if (geo.country) row.country = geo.country;
  if (geo.region) row.region = geo.region;
  if (geo.city) row.city = geo.city;
  return row;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    return res.status(500).json({ error: 'Analytics not configured' });
  }

  // sendBeacon posts as text/plain, normal fetch as application/json —
  // Vercel only auto-parses the latter, so handle both.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Bad JSON' }); }
  }

  // Vercel geolocation headers (city arrives URI-encoded, e.g. "S%C3%A3o%20Paulo").
  const geo = {
    country: req.headers['x-vercel-ip-country'] || null,
    region: req.headers['x-vercel-ip-country-region'] || null,
    city: req.headers['x-vercel-ip-city']
      ? decodeURIComponent(req.headers['x-vercel-ip-city'])
      : null,
  };

  const batch = (Array.isArray(body) ? body : [body])
    .slice(0, MAX_BATCH)
    .map((e) => sanitise(e, geo))
    .filter(Boolean);

  if (batch.length === 0) return res.status(400).json({ error: 'No valid events' });

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(batch),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    console.error('[track] Supabase insert failed:', resp.status, detail);
    return res.status(502).json({ error: 'Insert failed' });
  }

  return res.status(204).end();
}
