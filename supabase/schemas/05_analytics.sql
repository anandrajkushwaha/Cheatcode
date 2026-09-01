-- ============================================================
-- Cheatcode — page view tracking (self-hosted, no third party)
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists public.page_views (
  id            bigint generated always as identity primary key,
  path          text not null,
  referrer      text,
  referrer_host text,
  source        text,                 -- 'google' | 'direct' | 'linkedin' | ...
  country       text,
  device        text,                 -- 'mobile' | 'desktop'
  session_id    text,
  created_at    timestamptz not null default now()
);

create index if not exists pv_created_idx  on public.page_views (created_at desc);
create index if not exists pv_path_idx     on public.page_views (path, created_at desc);
create index if not exists pv_source_idx   on public.page_views (source, created_at desc);
create index if not exists pv_session_idx  on public.page_views (session_id, created_at desc);

alter table public.page_views enable row level security;

-- Anyone may record a view. Nobody public may read them back.
grant insert on public.page_views to anon, authenticated;

drop policy if exists "anyone can record a page view" on public.page_views;
create policy "anyone can record a page view"
  on public.page_views for insert to anon, authenticated
  with check (true);

-- No select grant and no select policy on purpose: the admin panel reads
-- this with the secret key, server-side only.


-- ============================================================
-- One RPC returning everything the admin Traffic page needs.
-- Aggregating in Postgres keeps the payload tiny no matter how much
-- traffic accumulates.
--
-- Note: every bucket aggregates in an inner query first and builds the
-- JSON in an outer one. Building JSON and grouping in the same SELECT
-- puts the aggregate inside the GROUP BY target, which Postgres rejects.
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


