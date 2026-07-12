-- =========================================================================
-- PORTFOLIO ANALYTICS — Supabase schema
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New
-- query → paste → Run). Safe to re-run: everything is IF NOT EXISTS.
--
-- Design: one flat `events` table. Every row is one thing a visitor did.
-- The event_type column says what kind of row it is; columns that don't
-- apply to that type are simply NULL. At portfolio traffic volumes this is
-- simpler and more flexible than separate tables per event type.
-- =========================================================================

create table if not exists public.events (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),

  -- What happened: page_view | click | outbound_click | page_leave
  event_type    text not null,

  -- Who (anonymous): visitor_id persists across visits (localStorage),
  -- session_id groups one browsing session (30-min inactivity window),
  -- view_id ties a page_view to its page_leave (duration/scroll) row.
  visitor_id    text,
  session_id    text,
  view_id       text,
  is_new_visitor boolean,

  -- Where on the site
  page          text,
  page_title    text,

  -- Where they came from (page_view rows)
  referrer      text,
  source        text,          -- parsed: utm_source, referrer domain, or 'direct'
  utm_medium    text,
  utm_campaign  text,

  -- Their setup
  device        text,          -- mobile | tablet | desktop
  browser       text,
  os            text,
  viewport_w    integer,
  viewport_h    integer,
  language      text,

  -- Their location (from Vercel request headers — no IP is ever stored)
  country       text,
  region        text,
  city          text,

  -- Click rows: what was clicked and where (for the heatmap)
  el_tag        text,
  el_text       text,
  el_href       text,
  x_pct         real,          -- horizontal click position, % of viewport width
  y_doc         integer,       -- vertical click position, px from top of document
  doc_h         integer,       -- document height at click time (normalises y_doc)

  -- page_leave rows: engagement
  scroll_pct    integer,       -- deepest scroll reached, 0–100
  duration_s    real           -- seconds the page was actually visible
);

-- Indexes for the queries the admin dashboard runs (filter by date,
-- group by type/page/session).
create index if not exists events_created_at_idx on public.events (created_at desc);
create index if not exists events_event_type_idx on public.events (event_type);
create index if not exists events_page_idx       on public.events (page);
create index if not exists events_session_idx    on public.events (session_id);

-- Lock the table down completely for public/anon access. Row Level
-- Security with NO policies means the anon and authenticated API keys can
-- neither read nor write. Only the secret (service) key — which lives in
-- Vercel environment variables and never reaches the browser — can touch
-- this table, via /api/track and /api/stats.
alter table public.events enable row level security;
