-- ============================================================
-- Keeps your own traffic out of your own numbers — including the
-- weeks of it already sitting in the tables.
--
-- The cookie and IP checks in the app stop *new* rows. This adds the
-- retroactive half: an exclusion list of visitor ids that every admin
-- query filters against, so history cleans itself up too.
--
-- Run AFTER 08_visitors_platform.sql. Safe to re-run.
-- ============================================================

create table if not exists public.analytics_excluded (
  visitor_id text primary key,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.analytics_excluded enable row level security;
-- No grants at all: only the secret key (admin panel) touches this.

comment on table public.analytics_excluded is
  'Visitor ids whose page views and events are hidden from the admin panel.';


-- ============================================================
-- analytics_summary — bots out, and now the owner out too.
-- ============================================================
create or replace function public.analytics_summary(p_days int default 7)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with excluded as (
    select visitor_id from public.analytics_excluded
  ),
  clean as (
    select * from public.page_views
     where is_bot = false
       and (visitor_id is null or visitor_id not in (select visitor_id from excluded))
  ),
  win as (
    select * from clean
     where created_at >= now() - make_interval(days => p_days)
  ),
  today as (
    select * from clean
     where created_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata')
                          at time zone 'Asia/Kolkata')
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
    'views_all_time', (select count(*) from clean),
    'users_all_time', (select count(distinct visitor_id) from clean where visitor_id is not null),
    'excluded_devices', (select count(*) from public.analytics_excluded),
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


-- ============================================================
-- events_summary — same exclusion applied.
-- ============================================================
create or replace function public.events_summary(p_days int default 7)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with win as (
    select * from public.page_events
     where created_at >= now() - make_interval(days => p_days)
       and is_bot = false
       and (visitor_id is null
            or visitor_id not in (select visitor_id from public.analytics_excluded))
  ),
  by_event as (
    select event, count(*) as n, count(distinct session_id) as sessions
      from win group by event order by count(*) desc limit 30
  ),
  by_cta as (
    select coalesce(nullif(location,''),'unknown') as location,
           coalesce(nullif(label,''),'')           as label,
           count(*) as n
      from win where event = 'cta_click'
     group by 1,2 order by count(*) desc limit 15
  ),
  outbound as (
    select coalesce(label,'') as label, count(*) as n
      from win where event = 'outbound_click'
     group by 1 order by count(*) desc limit 10
  )
  select jsonb_build_object(
    'days', p_days,
    'total', (select count(*) from win),
    'bots_blocked', (select count(*) from public.page_events
                      where is_bot = true and created_at >= now() - make_interval(days => p_days)),
    'by_event', (select coalesce(jsonb_agg(jsonb_build_object(
                   'event',event,'count',n,'sessions',sessions)),'[]'::jsonb) from by_event),
    'top_ctas', (select coalesce(jsonb_agg(jsonb_build_object(
                   'location',location,'label',label,'count',n)),'[]'::jsonb) from by_cta),
    'outbound', (select coalesce(jsonb_agg(jsonb_build_object(
                   'label',label,'count',n)),'[]'::jsonb) from outbound),
    'funnel', jsonb_build_object(
      'sessions',        (select count(distinct session_id) from win),
      'cta_view',        (select count(distinct session_id) from win where event = 'cta_view'),
      'cta_click',       (select count(distinct session_id) from win where event = 'cta_click'),
      'waitlist_start',  (select count(distinct session_id) from win where event = 'waitlist_start'),
      'waitlist_submit', (select count(distinct session_id) from win where event = 'waitlist_submit'),
      'waitlist_success',(select count(distinct session_id) from win where event = 'waitlist_success'),
      'tool_compute',    (select count(distinct session_id) from win where event = 'tool_compute')
    )
  );
$$;

revoke all on function public.events_summary(int) from public, anon, authenticated;
