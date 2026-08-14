-- ============================================================
-- Adds unique-visitor tracking and OS / browser breakdown.
-- Run AFTER 07_events.sql. Safe to re-run.
-- ============================================================

alter table public.page_views  add column if not exists visitor_id text;
alter table public.page_views  add column if not exists os         text;
alter table public.page_views  add column if not exists browser    text;

alter table public.page_events add column if not exists visitor_id text;
alter table public.page_events add column if not exists os         text;
alter table public.page_events add column if not exists browser    text;

create index if not exists pv_visitor_idx on public.page_views  (visitor_id, created_at desc);
create index if not exists ev_visitor_idx on public.page_events (visitor_id, created_at desc);

-- ============================================================
-- analytics_summary — now also returns unique users, OS and browser.
-- "visitors" stays as-is (distinct sessions) so nothing that already
-- reads it changes meaning; unique_users is the new, separate number.
-- ============================================================
create or replace function public.analytics_summary(p_days int default 7)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with win as (
    select * from public.page_views
     where created_at >= now() - make_interval(days => p_days)
       and is_bot = false
  ),
  today as (
    select * from public.page_views
     where created_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata')
                          at time zone 'Asia/Kolkata')
       and is_bot = false
  ),
  daily_agg as (
    select date_trunc('day', created_at at time zone 'Asia/Kolkata') as d,
           count(*) as views,
           count(distinct session_id) as visitors,
           count(distinct visitor_id) as users
      from win group by 1
  ),
  pages_agg as (
    select path, count(*) as views from win group by path order by count(*) desc limit 15
  ),
  sources_agg as (
    select coalesce(source,'direct') as source, count(*) as views
      from win group by 1 order by count(*) desc limit 12
  ),
  countries_agg as (
    select coalesce(country,'unknown') as country, count(*) as views
      from win group by 1 order by count(*) desc limit 12
  ),
  cities_agg as (
    select coalesce(nullif(city,''),'unknown') as city,
           coalesce(nullif(country,''),'')     as country,
           count(*) as views
      from win group by 1,2 order by count(*) desc limit 15
  ),
  devices_agg as (
    select coalesce(device,'unknown') as device, count(*) as views
      from win group by 1 order by count(*) desc
  ),
  os_agg as (
    select coalesce(nullif(os,''),'unknown') as os,
           count(*) as views,
           count(distinct visitor_id) as users
      from win group by 1 order by count(*) desc limit 12
  ),
  browser_agg as (
    select coalesce(nullif(browser,''),'unknown') as browser,
           count(*) as views,
           count(distinct visitor_id) as users
      from win group by 1 order by count(*) desc limit 12
  )
  select jsonb_build_object(
    'days', p_days,
    'views',          (select count(*) from win),
    'visitors',       (select count(distinct session_id) from win where session_id is not null),
    'unique_users',   (select count(distinct visitor_id) from win where visitor_id is not null),
    'views_today',    (select count(*) from today),
    'visitors_today', (select count(distinct session_id) from today where session_id is not null),
    'users_today',    (select count(distinct visitor_id) from today where visitor_id is not null),
    'views_all_time', (select count(*) from public.page_views where is_bot = false),
    'users_all_time', (select count(distinct visitor_id) from public.page_views
                        where is_bot = false and visitor_id is not null),
    'bots_blocked',   (select count(*) from public.page_views
                        where is_bot = true
                          and created_at >= now() - make_interval(days => p_days)),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
                'day', to_char(d,'YYYY-MM-DD'),'views',views,'visitors',visitors,'users',users
              ) order by d), '[]'::jsonb) from daily_agg),
    'top_pages',     (select coalesce(jsonb_agg(jsonb_build_object('path',path,'views',views)),'[]'::jsonb) from pages_agg),
    'top_sources',   (select coalesce(jsonb_agg(jsonb_build_object('source',source,'views',views)),'[]'::jsonb) from sources_agg),
    'top_countries', (select coalesce(jsonb_agg(jsonb_build_object('country',country,'views',views)),'[]'::jsonb) from countries_agg),
    'top_cities',    (select coalesce(jsonb_agg(jsonb_build_object('city',city,'country',country,'views',views)),'[]'::jsonb) from cities_agg),
    'devices',       (select coalesce(jsonb_agg(jsonb_build_object('device',device,'views',views)),'[]'::jsonb) from devices_agg),
    'top_os',        (select coalesce(jsonb_agg(jsonb_build_object('os',os,'views',views,'users',users)),'[]'::jsonb) from os_agg),
    'top_browsers',  (select coalesce(jsonb_agg(jsonb_build_object('browser',browser,'views',views,'users',users)),'[]'::jsonb) from browser_agg)
  );
$$;

revoke all on function public.analytics_summary(int) from public, anon, authenticated;
