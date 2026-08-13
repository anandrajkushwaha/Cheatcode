-- ============================================================
-- Adds city / region to page view tracking.
-- Run AFTER 05_analytics.sql. Safe to re-run.
-- ============================================================

alter table public.page_views add column if not exists city   text;
alter table public.page_views add column if not exists region text;

create index if not exists pv_city_idx on public.page_views (city, created_at desc);

-- Replace the summary function so it also returns top cities.
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
           count(*) as views, count(distinct session_id) as visitors
      from win group by 1
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
  cities_agg as (
    select coalesce(nullif(city, ''), 'unknown') as city,
           coalesce(nullif(country, ''), '')     as country,
           count(*) as views
      from win group by 1, 2 order by count(*) desc limit 15
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
      select coalesce(jsonb_agg(jsonb_build_object(
               'day', to_char(d, 'YYYY-MM-DD'), 'views', views, 'visitors', visitors
             ) order by d), '[]'::jsonb) from daily_agg
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
    'top_cities', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'city', city, 'country', country, 'views', views)), '[]'::jsonb)
        from cities_agg
    ),
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object('device', device, 'views', views)), '[]'::jsonb)
        from devices_agg
    )
  );
$$;

revoke all on function public.analytics_summary(int) from public, anon, authenticated;
