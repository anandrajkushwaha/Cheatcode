-- ---------------------------------------------------------------------------
-- Jobs.
--
-- Two tables and no more. `job_sources` is the list of company job boards we
-- pull from — one row per board, editable from the admin dashboard, because a
-- hardcoded array in a TypeScript file means a deploy every time a company
-- changes its board slug. `jobs` is what came back.
--
-- Everything here is public, official data: Greenhouse, Lever and Ashby all
-- publish a job board API for exactly this purpose. Nothing is scraped.
-- ---------------------------------------------------------------------------

create extension if not exists pg_trgm;

-- ------------------------------------------------------------------ sources

create table if not exists public.job_sources (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null check (provider in ('greenhouse', 'lever', 'ashby')),
  token         text not null,                       -- the board slug in the URL
  company_name  text not null,
  careers_url   text,
  is_active     boolean not null default true,

  -- Written by the ingest run so a board that quietly starts 404ing is
  -- visible in the dashboard instead of just producing fewer jobs.
  last_run_at   timestamptz,
  last_status   text,                                -- 'ok' | 'error'
  last_count    int  not null default 0,
  last_error    text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (provider, token)
);

-- --------------------------------------------------------------------- jobs

create table if not exists public.jobs (
  id              uuid primary key default gen_random_uuid(),
  source_id       uuid references public.job_sources(id) on delete cascade,

  provider        text not null,
  external_id     text not null,

  title           text not null,
  company         text not null,
  department      text,

  location_raw    text,
  -- Canonical Indian cities, so a filter is an array overlap rather than a
  -- LIKE across four spellings of Bengaluru.
  cities          text[] not null default '{}',
  is_remote       boolean not null default false,

  employment_type text,                              -- full_time | contract | internship
  seniority       text,                              -- intern | junior | mid | senior | lead
  years_min       numeric(4,1),
  years_max       numeric(4,1),

  salary_min      bigint,
  salary_max      bigint,
  salary_currency text,
  salary_period   text,                              -- year | month | hour

  skills          text[] not null default '{}',

  description     text,                              -- plain text, trimmed
  apply_url       text not null,

  posted_at       timestamptz,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),

  -- Not deleted when a posting disappears: a job someone applied to should
  -- still resolve, and "when did this close" is worth knowing later.
  is_active       boolean not null default true,
  closed_at       timestamptz,

  unique (provider, external_id)
);

create index if not exists jobs_active_posted_idx
  on public.jobs (posted_at desc nulls last) where is_active;

create index if not exists jobs_cities_idx  on public.jobs using gin (cities);
create index if not exists jobs_skills_idx  on public.jobs using gin (skills);
create index if not exists jobs_title_trgm_idx on public.jobs using gin (title gin_trgm_ops);
create index if not exists jobs_company_trgm_idx on public.jobs using gin (company gin_trgm_ops);
create index if not exists jobs_source_idx on public.jobs (source_id);

-- ---------------------------------------------------------------- updated_at

create or replace function public.touch_job_source()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists job_sources_touch on public.job_sources;
create trigger job_sources_touch before update on public.job_sources
  for each row execute function public.touch_job_source();

-- ----------------------------------------------------------------- security
--
-- Policies and grants are two separate gates in Postgres. A policy that
-- nobody has been granted SELECT on is still a locked door, so both are
-- spelled out here.

alter table public.jobs         enable row level security;
alter table public.job_sources  enable row level security;

drop policy if exists "read active jobs" on public.jobs;
create policy "read active jobs" on public.jobs
  for select to authenticated
  using (is_active);

-- No policy at all on job_sources for ordinary users: which boards we pull
-- from is an operational detail, and the secret key bypasses RLS anyway.

revoke all on public.jobs, public.job_sources from anon, authenticated;
grant select on public.jobs to authenticated;

-- ------------------------------------------------------------------ search
--
-- One function rather than a query builder in TypeScript, because filtering
-- and counting have to agree exactly — two hand-written queries drift, and
-- the symptom is a pagination bar that promises a page that does not exist.

drop function if exists public.search_jobs(text, text[], boolean, numeric, int, int);

create or replace function public.search_jobs(
  p_query      text        default null,
  p_cities     text[]      default null,
  p_remote     boolean     default null,   -- true = remote only
  p_max_years  numeric     default null,   -- your experience; hides jobs asking for more
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
  )
  select f.id, f.title, f.company, f.department,
         f.location_raw, f.cities, f.is_remote,
         f.employment_type, f.seniority, f.years_min, f.years_max,
         f.salary_min, f.salary_max, f.salary_currency, f.salary_period,
         f.skills, f.apply_url, f.posted_at,
         count(*) over () as total_count
  from filtered f
  order by f.posted_at desc nulls last, f.first_seen_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.search_jobs(text, text[], boolean, numeric, int, int)
  to authenticated;

-- ------------------------------------------------------------------- seeds
--
-- A starting handful, all verified to return Indian roles. The point is that
-- the table is not empty on day one; the real list grows from the dashboard.

insert into public.job_sources (provider, token, company_name, careers_url) values
  ('greenhouse', 'postman',                        'Postman',   'https://www.postman.com/company/careers/'),
  ('greenhouse', 'razorpaysoftwareprivatelimited', 'Razorpay',  'https://razorpay.com/jobs/'),
  ('lever',      'mindtickle',                     'Mindtickle','https://www.mindtickle.com/careers/')
on conflict (provider, token) do nothing;
