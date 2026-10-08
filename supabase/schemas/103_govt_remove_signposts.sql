-- ============================================================
-- Remove the navigation that was published as jobs.
--
-- The first runs put "Vacancies", "Current Openings", "RECRUITMENT EXAMS" and
-- "View All" on /government-jobs under Latest Jobs and Results. Each one is
-- the board's own signpost — the heading above a list, or the link to the
-- rest of it — and each matched a keyword test perfectly while telling a
-- reader nothing. The code now refuses them (lib/govt/patterns.ts,
-- `isSubstantive`); this clears the ones already published.
--
-- The same rule, in SQL: a notice names a particular recruitment, so it has
-- four words, or two with a year in them. Anything thinner is a signpost.
--
-- Deleted rather than unpublished. These are not notices that have gone stale,
-- they are rows that should never have existed, and a withdrawn status would
-- keep them in every count on the admin screen forever.
--
-- Run after 102_govt_source_urls.sql. Safe to re-run.
-- ============================================================

delete from public.govt_notices n
where
  -- Fewer than four words, and no year to make up for it.
  (
    array_length(regexp_split_to_array(btrim(n.title), '\s+'), 1) < 4
    and not (
      array_length(regexp_split_to_array(btrim(n.title), '\s+'), 1) >= 2
      and n.title ~ '\m20\d{2}\M'
    )
  )
  -- Or a signpost whatever its length.
  or n.title ~* '^(view|see|show|read|click)?\s*(all|more|here|details?)?$'
  or btrim(lower(n.title)) in (
    'vacancies', 'vacancy', 'current openings', 'openings', 'recruitment exams',
    'latest jobs', 'notifications', 'notices', 'results', 'admit cards',
    'answer keys', 'syllabus', 'archives', 'downloads', 'what''s new', 'home'
  );

-- An exam that was minted only to hold one of those rows now holds nothing,
-- and an empty recruitment page is worse than no page: it ranks, somebody
-- lands on it, and it says nothing at all.
delete from public.govt_exams e
where not exists (select 1 from public.govt_notices n where n.exam_id = e.id)
  and e.created_at > now() - interval '30 days'
  and e.about is null
  and e.application_end is null;

-- Both boards must be read again from scratch, or the unchanged-hash check
-- will skip the pages these came from and nothing will replace them.
update public.govt_sources set last_hash = null;
