-- ---------------------------------------------------------------------------
-- A fourth source: JSearch.
--
-- The three company boards are exact but narrow — only the companies we add,
-- and only ones using Greenhouse, Lever or Ashby. JSearch reads Google for
-- Jobs, which indexes Naukri, LinkedIn, Indeed and the rest, so it covers the
-- market the boards cannot.
--
-- It is a *search* API, not a feed: one request answers one query with a
-- page of results, and the free tier allows 200 requests a month. So a
-- "source" of this kind is a saved query rather than a company, and the runs
-- rotate through them a few per night.
--
-- Because the same job can now arrive twice — once from a company's own board
-- and once from Google's index of that same posting — this file also adds
-- deduplication. The direct board link wins, because it goes to the company
-- rather than through an aggregator.
-- ---------------------------------------------------------------------------

-- ------------------------------------------------------- sources: a query

alter table public.job_sources drop constraint if exists job_sources_provider_check;
alter table public.job_sources add constraint job_sources_provider_check
  check (provider in ('greenhouse', 'lever', 'ashby', 'jsearch'));

alter table public.job_sources add column if not exists search_query   text;
alter table public.job_sources add column if not exists search_country text not null default 'in';
alter table public.job_sources add column if not exists search_remote  boolean not null default false;

-- A board row needs a slug; a query row needs a query. Neither needs both.
alter table public.job_sources drop constraint if exists job_sources_shape;
alter table public.job_sources add constraint job_sources_shape check (
  (provider = 'jsearch' and search_query is not null and length(btrim(search_query)) > 0)
  or (provider <> 'jsearch' and token is not null and length(btrim(token)) > 0)
);

-- ------------------------------------------------------------- dedupe key

/**
 * Two rows describe the same job when the same company is advertising the
 * same title in the same place.
 *
 * Cities are sorted before joining, because "Bengaluru, Pune" from one source
 * and "Pune, Bengaluru" from another are the same job and must not produce two
 * different keys. Declared immutable so a generated column can use it.
 */
create or replace function public.job_dedupe_key(
  p_company text,
  p_title   text,
  p_cities  text[]
)
returns text language sql immutable as $$
  select lower(btrim(coalesce(p_company, ''))) || '|'
      || lower(btrim(coalesce(p_title, ''))) || '|'
      || coalesce(
           (select string_agg(lower(c), ',' order by lower(c)) from unnest(coalesce(p_cities, '{}')) c),
           ''
         );
$$;

alter table public.jobs drop column if exists dedupe_key;
alter table public.jobs add column dedupe_key text
  generated always as (public.job_dedupe_key(company, title, cities)) stored;

create index if not exists jobs_dedupe_idx on public.jobs (dedupe_key) where is_active;

-- ---------------------------------------------------------------- search

drop function if exists public.search_jobs(text, text[], boolean, numeric, int, int);

create or replace function public.search_jobs(
  p_query      text        default null,
  p_cities     text[]      default null,
  p_remote     boolean     default null,
  p_max_years  numeric     default null,
  p_limit      int         default 20,
  p_offset     int         default 0
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
  order by d.posted_at desc nulls last, d.first_seen_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.search_jobs(text, text[], boolean, numeric, int, int)
  to authenticated;

-- ------------------------------------------------------------- seed queries
--
-- Ten saved searches, run a few per night in rotation. Chosen to cover the
-- roles and cities this audience actually asks about rather than to be
-- exhaustive — breadth comes from Google's index behind each one.

insert into public.job_sources (provider, token, company_name, search_query, search_country) values
  ('jsearch', 'q-sde-blr',      'Software engineer · Bengaluru', 'software engineer in Bengaluru India',       'in'),
  ('jsearch', 'q-backend-blr',  'Backend · Bengaluru',           'backend developer in Bengaluru India',       'in'),
  ('jsearch', 'q-frontend-blr', 'Frontend · Bengaluru',          'frontend developer in Bengaluru India',      'in'),
  ('jsearch', 'q-data-blr',     'Data · Bengaluru',              'data analyst in Bengaluru India',            'in'),
  ('jsearch', 'q-design-blr',   'Design · Bengaluru',            'product designer in Bengaluru India',        'in'),
  ('jsearch', 'q-sde-hyd',      'Software engineer · Hyderabad', 'software engineer in Hyderabad India',       'in'),
  ('jsearch', 'q-sde-pune',     'Software engineer · Pune',      'software engineer in Pune India',            'in'),
  ('jsearch', 'q-sde-ncr',      'Software engineer · Delhi NCR', 'software engineer in Gurugram India',        'in'),
  ('jsearch', 'q-pm-india',     'Product manager · India',       'product manager in India',                   'in'),
  ('jsearch', 'q-fresher',      'Fresher · India',               'fresher software developer in India',        'in')
on conflict (provider, token) do nothing;
