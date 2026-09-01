-- ============================================================
-- Adds city / region to page view tracking.
-- Run AFTER 05_analytics.sql. Safe to re-run.
-- ============================================================

alter table public.page_views add column if not exists city   text;
alter table public.page_views add column if not exists region text;

create index if not exists pv_city_idx on public.page_views (city, created_at desc);

-- Replace the summary function so it also returns top cities.
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


