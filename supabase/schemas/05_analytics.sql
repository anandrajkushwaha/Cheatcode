-- ============================================================
-- Cheatcode — page view tracking (self-hosted, no third party)
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists public.page_views (
  id            bigint generated always as identity primary key,
  path          text not null,
  referrer      text,
  referrer_host text,
  source        text,                 -- 'google' | 'direct' | 'linkedin' | ...
  country       text,
  device        text,                 -- 'mobile' | 'desktop'
  session_id    text,
  created_at    timestamptz not null default now()
);

create index if not exists pv_created_idx  on public.page_views (created_at desc);
create index if not exists pv_path_idx     on public.page_views (path, created_at desc);
create index if not exists pv_source_idx   on public.page_views (source, created_at desc);
create index if not exists pv_session_idx  on public.page_views (session_id, created_at desc);

alter table public.page_views enable row level security;

-- Anyone may record a view. Nobody public may read them back.
grant insert on public.page_views to anon, authenticated;

drop policy if exists "anyone can record a page view" on public.page_views;
create policy "anyone can record a page view"
  on public.page_views for insert to anon, authenticated
  with check (true);

-- No select grant and no select policy on purpose: the admin panel reads
-- this with the secret key, server-side only.


-- ============================================================
-- One RPC returning everything the admin Traffic page needs.
-- Aggregating in Postgres keeps the payload tiny no matter how much
-- traffic accumulates.
--
-- Note: every bucket aggregates in an inner query first and builds the
-- JSON in an outer one. Building JSON and grouping in the same SELECT
-- puts the aggregate inside the GROUP BY target, which Postgres rejects.
-- ============================================================
create or replace function public.analytics_summary(p_days int default 7)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with win as (
    select *
      from public.page_views
     where created_at >= now() - make_interval(days => p_days)
  ),
  today as (
    select *
      from public.page_views
     where created_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata')
                          at time zone 'Asia/Kolkata')
  ),
  daily_agg as (
    select date_trunc('day', created_at at time zone 'Asia/Kolkata') as d,
           count(*)                        as views,
           count(distinct session_id)      as visitors
      from win
     group by 1
  ),
  pages_agg as (
    select path, count(*) as views
      from win group by path order by count(*) desc limit 15
  ),
  sources_agg as (
    select coalesce(source, 'direct') as source, count(*) as views
      from win group by 1 order by count(*) desc limit 12
  ),
  countries_agg as (
    select coalesce(country, 'unknown') as country, count(*) as views
      from win group by 1 order by count(*) desc limit 12
  ),
  devices_agg as (
    select coalesce(device, 'unknown') as device, count(*) as views
      from win group by 1 order by count(*) desc
  )
  select jsonb_build_object(
    'days',            p_days,
    'views',           (select count(*) from win),
    'visitors',        (select count(distinct session_id) from win where session_id is not null),
    'views_today',     (select count(*) from today),
    'visitors_today',  (select count(distinct session_id) from today where session_id is not null),
    'views_all_time',  (select count(*) from public.page_views),
    'daily', (
      select coalesce(
               jsonb_agg(
                 jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'),
                                    'views', views,
                                    'visitors', visitors)
                 order by d
               ),
               '[]'::jsonb)
        from daily_agg
    ),
    'top_pages', (
      select coalesce(jsonb_agg(jsonb_build_object('path', path, 'views', views)), '[]'::jsonb)
        from pages_agg
    ),
    'top_sources', (
      select coalesce(jsonb_agg(jsonb_build_object('source', source, 'views', views)), '[]'::jsonb)
        from sources_agg
    ),
    'top_countries', (
      select coalesce(jsonb_agg(jsonb_build_object('country', country, 'views', views)), '[]'::jsonb)
        from countries_agg
    ),
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object('device', device, 'views', views)), '[]'::jsonb)
        from devices_agg
    )
  );
$$;

revoke all on function public.analytics_summary(int) from public, anon, authenticated;
