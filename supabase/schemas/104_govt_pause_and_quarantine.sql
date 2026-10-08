-- ============================================================
-- Stop the monitor, and take its output off the public pages.
--
-- The run worked. What it produced did not: directory labels published as
-- vacancies ("Current Openings", "Vacancies", "RECRUITMENT EXAMS"), the same
-- "View All" twice as results, an exam page called "View All" grouping two
-- generic IBPS links, and an "SBI Recruitment" page whose apply button points
-- at a careers directory rather than a notice. None of those is a recruitment,
-- and the fix is not a better regex over the same crawl — it is to stop
-- publishing a link because it sits on a board's page.
--
-- So: every source off, the cron removed from vercel.json, and everything the
-- crawler published quarantined rather than deleted.
--
-- Quarantined, not dropped, for two reasons. The rows are the evidence for
-- what the crawler got wrong and what a corrected one has to handle. And the
-- URLs are already indexed — a row that still exists can answer with "this
-- listing was withdrawn, here is the directory", which serves a visitor far
-- better than a 404 that tells them nothing.
--
-- Nothing here touches resumes, jobs, profiles or any other feature.
--
-- Run after 103_govt_remove_signposts.sql. Safe to re-run. Reversible: see
-- the rollback at the foot.
-- ============================================================

-- ---------------------------------------------------------------- the stop

update public.govt_sources
   set active = false,
       last_error = 'paused — publishing gate not yet trustworthy';

-- ------------------------------------------------------------ quarantine

-- 'retired' means: we published this, we no longer stand behind it, and the
-- URL still answers. Added rather than reusing 'withdrawn', which means the
-- recruiting authority withdrew the notice — a different claim entirely, and
-- not one to make on their behalf.
alter table public.govt_exams   drop constraint if exists govt_exams_status_check;
alter table public.govt_notices drop constraint if exists govt_notices_status_check;

alter table public.govt_exams
  add constraint govt_exams_status_check
  check (status in ('draft', 'published', 'closed', 'withdrawn', 'retired'));

alter table public.govt_notices
  add constraint govt_notices_status_check
  check (status in ('draft', 'published', 'stale', 'withdrawn', 'retired'));

-- Everything the crawler published. Not a judgement on each row: the gate that
-- let them through did not check what these pages needed it to check, so none
-- of them has been verified, and a page that cannot say which of its rows are
-- trustworthy should not be showing any of them as though they are.
update public.govt_notices
   set status = 'retired'
 where status in ('published', 'stale')
   and source_id is not null;

update public.govt_exams e
   set status = 'retired'
 where e.status = 'published'
   and not exists (
     select 1 from public.govt_notices n
      where n.exam_id = e.id and n.status = 'published'
   );

-- ---------------------------------------------------------------- rollback
--
-- To put it all back exactly as it was:
--
--   update public.govt_notices set status = 'published' where status = 'retired';
--   update public.govt_exams   set status = 'published' where status = 'retired';
--   update public.govt_sources set active = true, last_error = null;
--
-- and restore the cron entry in vercel.json.
