-- ============================================================
-- Hand-posted notices.
--
-- The monitor is off (104). From here the notices are posted by a person
-- from /admin/govt, which changes two things about these tables and nothing
-- else — the columns the public pages read, the slugs, the evidence gate all
-- stay exactly as they were, because the pages must not be able to tell
-- whether a row was typed or extracted. Only the row can tell, and only in
-- the admin screen.
--
-- 1. `posted_by` — who typed it. Not a foreign key to admin_users: that row
--    can be switched off or deleted, and the answer to "who posted this"
--    should not disappear when somebody leaves. A name, frozen at the time
--    of posting, the same reasoning as insights.author_name.
--
-- 2. The two status checks are widened to allow 'retired' here as well as in
--    104, so these two files can be run in either order. A re-run of either
--    is harmless.
--
-- A hand-posted row is identifiable without a column for it: source_id is
-- null. That is worth keeping as the test rather than adding a boolean that
-- can disagree with it.
--
-- Run after 100_govt_notices.sql. Safe to re-run.
-- ============================================================

alter table public.govt_notices add column if not exists posted_by text;
alter table public.govt_exams   add column if not exists posted_by text;

comment on column public.govt_notices.posted_by is
  'Display name of the admin who posted this by hand. Null for rows the '
  'monitor extracted. Frozen at posting time so it survives the account.';

-- ------------------------------------------------------- status vocabulary
--
-- 'retired' is the quarantine state from 104: off the public pages, still
-- here to read. Declared in both files so neither depends on the other
-- having been run first.

alter table public.govt_exams drop constraint if exists govt_exams_status_check;
alter table public.govt_exams add constraint govt_exams_status_check
  check (status in ('draft', 'published', 'closed', 'withdrawn', 'retired'));

alter table public.govt_notices drop constraint if exists govt_notices_status_check;
alter table public.govt_notices add constraint govt_notices_status_check
  check (status in ('draft', 'published', 'stale', 'withdrawn', 'retired'));

-- --------------------------------------------------------------- the panel
--
-- The admin list is "everything, newest posted first", across kinds and
-- statuses — which none of the public indexes serve: every one of those is
-- partial on status = 'published' precisely so a draft cannot be cheap to
-- find on a public page. Two small indexes rather than making the public
-- ones less specific.

create index if not exists govt_notices_recent_idx
  on public.govt_notices (created_at desc);

create index if not exists govt_exams_recent_idx
  on public.govt_exams (created_at desc);
