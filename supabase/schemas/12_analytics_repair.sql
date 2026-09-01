-- ============================================================
-- Repairs a database that already has the duplicate functions.
--
-- 05 through 09 each defined analytics_summary(p_days int) and, in two
-- cases, events_summary(p_days int). 10_dashboard.sql then defined both with
-- a date range added — a different argument list — and `create or replace`
-- does not replace a function whose signature differs. It adds a second one.
--
-- Every one of those files says "safe to re-run" at the top, so re-running
-- any of them left two versions in the database. The next call from the
-- dashboard then failed with
--
--     function public.analytics_summary(p_days => integer) is not unique
--
-- and every figure on every admin screen became a dash. This is almost
-- certainly why the panel looked broken.
--
-- The definitions have been removed from 05-09 so it cannot happen again.
-- This file cleans up a database where it already did. It is safe on a
-- database that was never affected — the drops simply find nothing.
--
-- Run this, then re-run 10_dashboard.sql. Safe to re-run.
-- ============================================================

-- The superseded one-argument versions. `if exists` so this is harmless on a
-- clean database, and the argument list is spelled out so it cannot possibly
-- drop the good three-argument function by accident.
drop function if exists public.analytics_summary(int);
drop function if exists public.events_summary(int);

-- Older shapes from before the range parameters were added, in case an
-- intermediate version is still sitting there.
drop function if exists public.analytics_summary(int, timestamptz);
drop function if exists public.events_summary(int, timestamptz);


-- ------------------------------------------------------- what is left now

-- Should return exactly one row per function, each with 1. Anything higher
-- means another overload exists that this file does not know about, and the
-- dashboard will still fail until it is dropped.
select p.proname,
       count(*) as versions,
       string_agg(pg_get_function_identity_arguments(p.oid), ' | ') as signatures
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('analytics_summary', 'events_summary',
                     'content_performance', 'banner_stats')
 group by p.proname
 order by p.proname;
