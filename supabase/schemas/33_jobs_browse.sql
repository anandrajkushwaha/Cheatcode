-- ============================================================
-- search_jobs, with the two controls a browse page needs.
--
-- The studio's jobs screen wants what every job board's does: sort the list,
-- and hide anything older than a few days. Neither was expressible, so both
-- arrive here as optional parameters.
--
-- The old six-argument function is dropped rather than left beside this one.
-- Postgres would happily keep both, and then a six-argument call would match
-- either and fail as ambiguous — which is a runtime error on the live /app
-- jobs page, not a migration-time one. Every new parameter has a default, so
-- the existing call sites keep working untouched.
--
-- Run after 31_jobs_jsearch.sql. Safe to re-run.
-- ============================================================

drop function if exists public.search_jobs(text, text[], boolean, numeric, int, int);
drop function if exists public.search_jobs(text, text[], boolean, numeric, int, int, int, text);

create or replace function public.search_jobs(
  p_query        text     default null,
  p_cities       text[]   default null,
  p_remote       boolean  default null,
  p_max_years    numeric  default null,
  p_limit        int      default 20,
  p_offset       int      default 0,
  -- Null means every age. Anything else is a cut-off in days against
  -- posted_at; rows with no date are kept, because "we do not know when this
  -- was posted" is not the same claim as "this is old".
  p_max_age_days int      default null,
  -- 'recent' (default), 'salary', or 'relevance'. Anything unrecognised
  -- behaves as 'recent' rather than erroring — a bad sort in a URL should
  -- give somebody a list, not a 500.
  p_sort         text     default 'recent'
)
returns table (
  id uuid, title text, company text, department text,
  location_raw text, cities text[], is_remote boolean,
  employment_type text, seniority text, years_min numeric, years_max numeric,
  salary_min bigint, salary_max bigint, salary_currency text, salary_period text,
  skills text[], apply_url text, posted_at timestamptz, total_count bigint
)
language sql stable security definer set search_path = public as $$
  with filtered as (
    select j.*
    from public.jobs j
    where j.is_active
      and (p_query is null or p_query = ''
           or j.title   ilike '%' || p_query || '%'
           or j.company ilike '%' || p_query || '%')
      and (p_cities is null or cardinality(p_cities) = 0
           or j.cities && p_cities
           -- Someone filtering by city still wants the remote roles they
           -- could take from that city.
           or j.is_remote)
      and (p_remote is null or p_remote is false or j.is_remote)
      -- years_min is what the job demands. Null means unstated, which is
      -- never a reason to hide it.
      and (p_max_years is null or j.years_min is null or j.years_min <= p_max_years)
      and (p_max_age_days is null
           or j.posted_at is null
           or j.posted_at >= now() - make_interval(days => p_max_age_days))
  ),
  deduped as (
    -- One row per real job. A company's own board beats an aggregator's copy
    -- of it, so the apply link goes to the company; after that, the fresher
    -- record wins.
    select distinct on (f.dedupe_key) f.*
    from filtered f
    order by f.dedupe_key,
             (f.provider = 'jsearch'),
             f.posted_at desc nulls last
  )
  select d.id, d.title, d.company, d.department,
         d.location_raw, d.cities, d.is_remote,
         d.employment_type, d.seniority, d.years_min, d.years_max,
         d.salary_min, d.salary_max, d.salary_currency, d.salary_period,
         d.skills, d.apply_url, d.posted_at,
         count(*) over () as total_count
  from deduped d
  -- Each CASE collapses to null when its sort is not the one asked for, so
  -- the clause below it decides. Date is always the final tie-break.
  order by
    case when p_sort = 'salary'
         then coalesce(d.salary_max, d.salary_min) end desc nulls last,
    case when p_sort = 'relevance' and coalesce(p_query, '') <> ''
         then (case
                 when d.title   ilike p_query || '%'        then 3
                 when d.title   ilike '%' || p_query || '%' then 2
                 when d.company ilike '%' || p_query || '%' then 1
                 else 0
               end)
         end desc nulls last,
    d.posted_at desc nulls last,
    d.first_seen_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.search_jobs(text, text[], boolean, numeric, int, int, int, text)
  to authenticated;
