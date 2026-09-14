-- ============================================================
-- Reading account_events by kind.
--
-- The table has existed since 20_app_accounts.sql and, until now, nothing
-- wrote to it. The download recorder in lib/app/resume-store.ts is its first
-- writer, and the admin résumé tab is its first reader — which changes what
-- it has to be indexed for.
--
-- Its one index is (user_id, created_at desc): the right shape for "what did
-- this person do", which is what the table was built for. Every query the
-- admin screen runs is the other shape — "every download, newest first,
-- across all users" — and that has no index at all, so it is a sequential
-- scan of the whole table that gets slower every day the product is used.
--
-- One index fixes it, and it is deliberately on (kind, created_at desc)
-- rather than on kind alone: the screen always wants the newest rows, and an
-- index that orders them saves the sort as well as the scan.
--
-- Run after 20_app_accounts.sql. Safe to re-run.
-- ============================================================

create index if not exists account_events_kind_idx
  on public.account_events (kind, created_at desc);

comment on index public.account_events_kind_idx is
  'For the admin screens: every event of one kind, newest first, across users.';


-- ---------------------------------------------------------------- downloads

-- Résumé downloads, flattened.
--
-- A view rather than a column on resume_drafts, because a download is an
-- event and a draft is a thing — a draft downloaded six times is one row and
-- six events, and collapsing them loses the six dates that make a trend.
--
-- `detail->>'template'` is pulled out here rather than in every query that
-- wants it, so the admin code never has to know how the JSON is shaped. If
-- the recorder ever changes that key, this is the single place it breaks
-- rather than the four places it would otherwise.
create or replace view public.resume_download_events as
  select
    e.id,
    e.user_id,
    e.created_at,
    e.detail ->> 'draft_id' as draft_id,
    e.detail ->> 'template' as template,
    e.detail ->> 'title'    as title
  from public.account_events e
  where e.kind = 'resume_download';

comment on view public.resume_download_events is
  'One row per résumé PDF download. Written by countDownload() in lib/app/resume-store.ts. '
  'Starts at the moment that recorder shipped — resume_drafts.download_count holds the '
  'all-time total per draft, including downloads taken before there were any events.';

-- The view is read by the admin screens with the service key, which bypasses
-- RLS. No grant to anon or authenticated: a signed-in person has no business
-- reading every other person's download history, and the safest way to
-- guarantee that is to never hand out the privilege.
revoke all on public.resume_download_events from anon, authenticated;
