-- ============================================================
-- Event tracking + bot filtering.
-- Run AFTER 05_analytics.sql and 06_analytics_city.sql. Safe to re-run.
-- ============================================================

-- ---------- bot flags on page views ----------
alter table public.page_views add column if not exists is_bot     boolean not null default false;
alter table public.page_views add column if not exists bot_reason text;

create index if not exists pv_human_idx on public.page_views (created_at desc) where is_bot = false;

-- ---------- events ----------
create table if not exists public.page_events (
  id          bigint generated always as identity primary key,
  event       text not null,
  path        text,
  label       text,
  location    text,
  value       numeric,
  params      jsonb not null default '{}'::jsonb,
  session_id  text,
  source      text,
  country     text,
  city        text,
  device      text,
  is_bot      boolean not null default false,
  bot_reason  text,
  created_at  timestamptz not null default now()
);

create index if not exists ev_created_idx on public.page_events (created_at desc);
create index if not exists ev_event_idx   on public.page_events (event, created_at desc);
create index if not exists ev_human_idx   on public.page_events (event, created_at desc) where is_bot = false;

alter table public.page_events enable row level security;
grant insert on public.page_events to anon, authenticated;

drop policy if exists "anyone can record an event" on public.page_events;
create policy "anyone can record an event"
  on public.page_events for insert to anon, authenticated
  with check (true);

-- No select grant: the admin panel reads this with the secret key only.


-- ============================================================
-- analytics_summary — now excludes bots.
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
           count(*) as views, count(distinct session_id) as visitors
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
  )
  select jsonb_build_object(
    'days', p_days,
    'views',          (select count(*) from win),
    'visitors',       (select count(distinct session_id) from win where session_id is not null),
    'views_today',    (select count(*) from today),
    'visitors_today', (select count(distinct session_id) from today where session_id is not null),
    'views_all_time', (select count(*) from public.page_views where is_bot = false),
    'bots_blocked',   (select count(*) from public.page_views
                        where is_bot = true
                          and created_at >= now() - make_interval(days => p_days)),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
                'day', to_char(d,'YYYY-MM-DD'),'views',views,'visitors',visitors) order by d),
                '[]'::jsonb) from daily_agg),
    'top_pages',     (select coalesce(jsonb_agg(jsonb_build_object('path',path,'views',views)),'[]'::jsonb) from pages_agg),
    'top_sources',   (select coalesce(jsonb_agg(jsonb_build_object('source',source,'views',views)),'[]'::jsonb) from sources_agg),
    'top_countries', (select coalesce(jsonb_agg(jsonb_build_object('country',country,'views',views)),'[]'::jsonb) from countries_agg),
    'top_cities',    (select coalesce(jsonb_agg(jsonb_build_object('city',city,'country',country,'views',views)),'[]'::jsonb) from cities_agg),
    'devices',       (select coalesce(jsonb_agg(jsonb_build_object('device',device,'views',views)),'[]'::jsonb) from devices_agg)
  );
$$;

revoke all on function public.analytics_summary(int) from public, anon, authenticated;


-- ============================================================
-- events_summary — counts by event, plus the funnel and top CTAs.
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
