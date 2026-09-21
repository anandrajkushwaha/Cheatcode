-- ============================================================
-- Make the jobs actually findable.
--
-- The problem this fixes: search_jobs matched p_query against `title` and
-- `company` and nothing else. So somebody typing "react" got only the jobs
-- with the word React in their title — while every "Frontend Engineer" whose
-- stack is React sat in the table, active and unreachable. The jobs were not
-- missing. They were unsearchable, which looks identical from the outside and
-- is the more annoying of the two problems because more supply does not fix
-- it.
--
-- So the haystack becomes title + company + skills + department + description,
-- weighted in that order, as a Postgres tsvector. That also buys word-order
-- independence and stemming for free: "developer frontend" finds the same
-- rows as "frontend developer", and "engineering" matches "engineer".
--
-- ILIKE is kept alongside it rather than replaced. Full-text search works in
-- whole words, so "razor" does not match "Razorpay" and a half-typed query
-- would fall off a cliff. The trigram indexes for that already exist.
--
-- Two ordering fixes ride along, both of them dilution:
--
--   · A city filter also returns remote roles, on purpose — somebody in Indore
--     can take them. But "every remote job in India" then floods a filter for
--     one city. The rows stay; the ones actually in the city now come first.
--
--   · With a query, relevance is a real score rather than a three-step CASE.
--
-- Signature is unchanged, so every existing call site keeps working.
--
-- Run after 33_jobs_browse.sql. Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------ the document
--
-- A wrapper rather than the expression inline, because a generated column may
-- only call an IMMUTABLE function and array_to_string is declared STABLE —
-- it takes anyarray, and an arbitrary element type's output function need not
-- be immutable. For text[] it genuinely is, which is what makes this safe to
-- declare.
create or replace function public.jobs_search_doc(
  p_title       text,
  p_company     text,
  p_department  text,
  p_skills      text[],
  p_description text
)
returns tsvector
language sql immutable parallel safe as $$
  select setweight(to_tsvector('english', coalesce(p_title, '')), 'A')
      || setweight(to_tsvector('english', coalesce(p_company, '')), 'B')
      || setweight(to_tsvector('english', coalesce(array_to_string(p_skills, ' '), '')), 'B')
      || setweight(to_tsvector('english', coalesce(p_department, '')), 'C')
      -- Descriptions run to thousands of words and the tail is boilerplate —
      -- benefits, equal-opportunity statements. Indexing all of it costs
      -- space and buys false matches.
      || setweight(to_tsvector('english', left(coalesce(p_description, ''), 4000)), 'D')
$$;

alter table public.jobs
  add column if not exists search_doc tsvector
  generated always as (
    public.jobs_search_doc(title, company, department, skills, description)
  ) stored;

create index if not exists jobs_search_doc_idx
  on public.jobs using gin (search_doc) where is_active;

-- ------------------------------------------------------------ the function
drop function if exists public.search_jobs(text, text[], boolean, numeric, int, int);
drop function if exists public.search_jobs(text, text[], boolean, numeric, int, int, int, text);

create or replace function public.search_jobs(
  p_query        text     default null,
  p_cities       text[]   default null,
  p_remote       boolean  default null,
  p_max_years    numeric  default null,
  p_limit        int      default 20,
  p_offset       int      default 0,
  p_max_age_days int      default null,
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
  with parsed as (
    select
      nullif(btrim(coalesce(p_query, '')), '') as raw,
      -- websearch_to_tsquery never raises on user input — quotes, operators
      -- and stray punctuation are all accepted. plainto_/to_tsquery are not
      -- that forgiving, and this string comes straight from a URL.
      case
        when nullif(btrim(coalesce(p_query, '')), '') is null then null
        else websearch_to_tsquery('english', btrim(p_query))
      end as tsq
  ),
  filtered as (
    select j.*,
           -- A query of nothing but stop words parses to an empty tsquery,
           -- which matches nothing; the ILIKE arm below still answers.
           coalesce(ts_rank_cd(j.search_doc, p.tsq), 0) as fts_rank,
           p.raw as raw
    from public.jobs j
    cross join parsed p
    where j.is_active
      and (p.raw is null
           or (p.tsq is not null and j.search_doc @@ p.tsq)
           or j.title   ilike '%' || p.raw || '%'
           or j.company ilike '%' || p.raw || '%')
      and (p_cities is null or cardinality(p_cities) = 0
           or j.cities && p_cities
           -- Someone filtering by city still wants the remote roles they
           -- could take from that city. Ranked below them, further down.
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
  ),
  scored as (
    select d.*,
           -- Where the match landed still dominates how often it landed: a
           -- title hit beats a description that says "react" six times.
           (case
              when d.raw is null                          then 0
              when d.title   ilike d.raw || '%'           then 3.0
              when d.title   ilike '%' || d.raw || '%'    then 2.0
              when d.company ilike '%' || d.raw || '%'    then 1.0
              else 0
            end) + d.fts_rank * 4.0 as score,
           (p_cities is not null
            and cardinality(p_cities) > 0
            and d.cities && p_cities) as in_wanted_city
    from deduped d
  )
  select s.id, s.title, s.company, s.department,
         s.location_raw, s.cities, s.is_remote,
         s.employment_type, s.seniority, s.years_min, s.years_max,
         s.salary_min, s.salary_max, s.salary_currency, s.salary_period,
         s.skills, s.apply_url, s.posted_at,
         count(*) over () as total_count
  from scored s
  order by
    -- Grouping, not sorting: whatever the chosen order, the jobs in the
    -- cities somebody asked for are listed before the remote ones that merely
    -- could be done from there.
    s.in_wanted_city desc nulls last,
    -- Each CASE collapses to null when its sort is not the one asked for, so
    -- the clause below it decides. Date is always the final tie-break.
    case when p_sort = 'salary'
         then coalesce(s.salary_max, s.salary_min) end desc nulls last,
    case when p_sort = 'relevance' then s.score end desc nulls last,
    s.posted_at desc nulls last,
    s.first_seen_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.search_jobs(text, text[], boolean, numeric, int, int, int, text)
  to authenticated;
