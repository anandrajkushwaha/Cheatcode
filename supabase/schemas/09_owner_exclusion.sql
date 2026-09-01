-- ============================================================
-- Keeps your own traffic out of your own numbers — including the
-- weeks of it already sitting in the tables.
--
-- The cookie and IP checks in the app stop *new* rows. This adds the
-- retroactive half: an exclusion list of visitor ids that every admin
-- query filters against, so history cleans itself up too.
--
-- Run AFTER 08_visitors_platform.sql. Safe to re-run.
-- ============================================================

create table if not exists public.analytics_excluded (
  visitor_id text primary key,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.analytics_excluded enable row level security;
-- No grants at all: only the secret key (admin panel) touches this.

comment on table public.analytics_excluded is
  'Visitor ids whose page views and events are hidden from the admin panel.';


-- ============================================================
-- analytics_summary — bots out, and now the owner out too.
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
-- events_summary — same exclusion applied.
-- ============================================================

