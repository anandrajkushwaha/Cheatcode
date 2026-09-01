-- ============================================================
-- Event tracking + bot filtering.
-- Run AFTER 05_analytics.sql and 06_analytics_city.sql. Safe to re-run.
-- ============================================================

-- ---------- bot flags on page views ----------
alter table public.page_views add column if not exists is_bot     boolean not null default false;
alter table public.page_views add column if not exists bot_reason text;

create index if not exists pv_human_idx on public.page_views (created_at desc) where is_bot = false;

-- ---------- events ----------
create table if not exists public.page_events (
  id          bigint generated always as identity primary key,
  event       text not null,
  path        text,
  label       text,
  location    text,
  value       numeric,
  params      jsonb not null default '{}'::jsonb,
  session_id  text,
  source      text,
  country     text,
  city        text,
  device      text,
  is_bot      boolean not null default false,
  bot_reason  text,
  created_at  timestamptz not null default now()
);

create index if not exists ev_created_idx on public.page_events (created_at desc);
create index if not exists ev_event_idx   on public.page_events (event, created_at desc);
create index if not exists ev_human_idx   on public.page_events (event, created_at desc) where is_bot = false;

alter table public.page_events enable row level security;
grant insert on public.page_events to anon, authenticated;

drop policy if exists "anyone can record an event" on public.page_events;
create policy "anyone can record an event"
  on public.page_events for insert to anon, authenticated
  with check (true);

-- No select grant: the admin panel reads this with the secret key only.


-- ============================================================
-- analytics_summary — now excludes bots.
-- ============================================================
-- ------------------------------------------------------------------------
-- analytics_summary / events_summary used to be defined here.
--
-- They are not any more, and that is the fix for a live bug rather than
-- tidying. 10_dashboard.sql defines these functions with a different argument
-- list (it added a date range), and `create or replace` does not replace a
-- function whose signature differs — it adds a second overload. So re-running
-- this file, which says "safe to re-run" at the top, left two versions of
-- analytics_summary in the database, and the next call from the dashboard
-- failed with "function is not unique" and every number on every screen
-- became a dash.
--
-- The definitions now live in 10_dashboard.sql only. Run that after this.
-- ------------------------------------------------------------------------




-- ============================================================
-- events_summary — counts by event, plus the funnel and top CTAs.
-- ============================================================

