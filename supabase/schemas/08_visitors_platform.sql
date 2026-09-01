-- ============================================================
-- Adds unique-visitor tracking and OS / browser breakdown.
-- Run AFTER 07_events.sql. Safe to re-run.
-- ============================================================

alter table public.page_views  add column if not exists visitor_id text;
alter table public.page_views  add column if not exists os         text;
alter table public.page_views  add column if not exists browser    text;

alter table public.page_events add column if not exists visitor_id text;
alter table public.page_events add column if not exists os         text;
alter table public.page_events add column if not exists browser    text;

create index if not exists pv_visitor_idx on public.page_views  (visitor_id, created_at desc);
create index if not exists ev_visitor_idx on public.page_events (visitor_id, created_at desc);

-- ============================================================
-- analytics_summary — now also returns unique users, OS and browser.
-- "visitors" stays as-is (distinct sessions) so nothing that already
-- reads it changes meaning; unique_users is the new, separate number.
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


