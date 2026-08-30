-- ============================================================
-- The dashboard rewrite.
--
-- Three things were wrong with what came before:
--
--  1. Every number was a bare count with nothing to compare it to. "412 views"
--     tells you nothing; "412 views, up 23% on the previous seven days" is the
--     whole point. Every headline figure now ships with its previous-period
--     twin so the UI can show direction.
--
--  2. Data was being collected and thrown away. scroll_depth, time_on_page and
--     the tool_compute params have been landing in the database for weeks and
--     no screen read them. Engagement and tool outcomes now come out.
--
--  3. There was no way to ask the only question that matters for a content
--     site: which articles are working. content_performance answers it.
--
-- Run AFTER 09_owner_exclusion.sql. Safe to re-run.
-- ============================================================


-- ============================================================
-- Shared helper: the visitor ids whose traffic never counts.
-- Inlined into each function rather than a view, because a security
-- definer function reading a view adds a permission surface for no gain.
-- ============================================================


-- ============================================================
-- Drop the earlier signatures first.
--
-- `create or replace function` only replaces a function with the SAME argument
-- list. Adding p_from/p_to creates a second overload instead, and Postgres then
-- refuses every call that does not disambiguate — "function analytics_summary(
-- integer) is not unique". These drops are what make this file safe to run over
-- an existing install.
-- ============================================================
drop function if exists public.analytics_summary(int);
drop function if exists public.events_summary(int);
drop function if exists public.content_performance(int, int);


-- ============================================================
-- analytics_summary — now with a previous period, new vs returning,
-- bounce rate and entry pages.
-- ============================================================
create or replace function public.analytics_summary(
  p_days int default 7,
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with clean as (
    select * from public.page_views
     where is_bot = false
       and (visitor_id is null
            or visitor_id not in (select visitor_id from public.analytics_excluded))
  ),
  -- An explicit p_from/p_to wins; otherwise the window is the last p_days.
  -- The comparison period is always the same length, immediately before.
  bounds as (
    select
      coalesce(p_from, now() - make_interval(days => p_days)) as win_start,
      coalesce(p_to,   now())                                 as win_end,
      coalesce(p_from, now() - make_interval(days => p_days))
        - (coalesce(p_to, now()) - coalesce(p_from, now() - make_interval(days => p_days)))
                                                              as prev_start
  ),
  win as (
    select c.* from clean c, bounds b
     where c.created_at >= b.win_start and c.created_at < b.win_end
  ),
  prev as (
    select c.* from clean c, bounds b
     where c.created_at >= b.prev_start and c.created_at < b.win_start
  ),
  today as (
    select * from clean
     where created_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata')
                          at time zone 'Asia/Kolkata')
  ),

  -- A visitor is "returning" if we saw them before this window opened.
  seen_before as (
    select distinct c.visitor_id from clean c, bounds b
     where c.created_at < b.win_start and c.visitor_id is not null
  ),
  win_visitors as (
    select distinct visitor_id from win where visitor_id is not null
  ),

  -- Session shape: how many pages, and which page opened it.
  sess as (
    select session_id,
           count(*) as views,
           min(created_at) as started_at
      from win where session_id is not null group by session_id
  ),
  entry as (
    select w.path, count(*) as n
      from win w
      join sess s on s.session_id = w.session_id and s.started_at = w.created_at
     group by w.path order by count(*) desc limit 12
  ),

  daily_agg as (
    select date_trunc('day', created_at at time zone 'Asia/Kolkata') as d,
           count(*) as views,
           count(distinct session_id) as visitors,
           count(distinct visitor_id) as users
      from win group by 1
  ),
  pages_agg as (
    select path, count(*) as views, count(distinct visitor_id) as users
      from win group by path order by count(*) desc limit 15
  ),
  sources_agg as (
    select coalesce(source,'direct') as source,
           count(*) as views,
           count(distinct visitor_id) as users
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
      from win group by 1,2 order by count(*) desc limit 12
  ),
  devices_agg as (
    select coalesce(device,'unknown') as device, count(*) as views
      from win group by 1 order by count(*) desc
  ),
  os_agg as (
    select coalesce(nullif(os,''),'unknown') as os,
           count(*) as views, count(distinct visitor_id) as users
      from win group by 1 order by count(*) desc limit 10
  ),
  browser_agg as (
    select coalesce(nullif(browser,''),'unknown') as browser,
           count(*) as views, count(distinct visitor_id) as users
      from win group by 1 order by count(*) desc limit 10
  )
  select jsonb_build_object(
    'days', p_days,

    -- headline, each with its previous-period twin
    'views',          (select count(*) from win),
    'prev_views',     (select count(*) from prev),
    'visitors',       (select count(distinct session_id) from win where session_id is not null),
    'prev_visitors',  (select count(distinct session_id) from prev where session_id is not null),
    'unique_users',   (select count(distinct visitor_id) from win where visitor_id is not null),
    'prev_users',     (select count(distinct visitor_id) from prev where visitor_id is not null),

    'views_today',    (select count(*) from today),
    'visitors_today', (select count(distinct session_id) from today where session_id is not null),
    'users_today',    (select count(distinct visitor_id) from today where visitor_id is not null),
    'views_all_time', (select count(*) from clean),
    'users_all_time', (select count(distinct visitor_id) from clean where visitor_id is not null),

    -- audience shape
    'new_users',      (select count(*) from win_visitors
                        where visitor_id not in (select visitor_id from seen_before)),
    'returning_users',(select count(*) from win_visitors
                        where visitor_id in (select visitor_id from seen_before)),

    -- session quality. A "bounce" here is a session that saw exactly one page.
    'sessions_total',  (select count(*) from sess),
    'sessions_bounced',(select count(*) from sess where views = 1),
    'views_per_session',(select round(avg(views), 2) from sess),

    'excluded_devices', (select count(*) from public.analytics_excluded),
    'bots_blocked',   (select count(*) from public.page_views, bounds
                        where is_bot = true
                          and created_at >= win_start and created_at < win_end),

    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
                'day', to_char(d,'YYYY-MM-DD'),'views',views,'visitors',visitors,'users',users
              ) order by d), '[]'::jsonb) from daily_agg),
    'entry_pages',   (select coalesce(jsonb_agg(jsonb_build_object('path',path,'views',n)),'[]'::jsonb) from entry),
    'top_pages',     (select coalesce(jsonb_agg(jsonb_build_object('path',path,'views',views,'users',users)),'[]'::jsonb) from pages_agg),
    'top_sources',   (select coalesce(jsonb_agg(jsonb_build_object('source',source,'views',views,'users',users)),'[]'::jsonb) from sources_agg),
    'top_countries', (select coalesce(jsonb_agg(jsonb_build_object('country',country,'views',views)),'[]'::jsonb) from countries_agg),
    'top_cities',    (select coalesce(jsonb_agg(jsonb_build_object('city',city,'country',country,'views',views)),'[]'::jsonb) from cities_agg),
    'devices',       (select coalesce(jsonb_agg(jsonb_build_object('device',device,'views',views)),'[]'::jsonb) from devices_agg),
    'top_os',        (select coalesce(jsonb_agg(jsonb_build_object('os',os,'views',views,'users',users)),'[]'::jsonb) from os_agg),
    'top_browsers',  (select coalesce(jsonb_agg(jsonb_build_object('browser',browser,'views',views,'users',users)),'[]'::jsonb) from browser_agg)
  );
$$;

revoke all on function public.analytics_summary(int, timestamptz, timestamptz) from public, anon, authenticated;

comment on function public.analytics_summary(int, timestamptz, timestamptz) is
  'Traffic rollup for the admin panel. Bots and excluded visitors removed; every headline figure ships with its previous-period value.';


-- ============================================================
-- events_summary — a funnel that matches the actual product, plus the
-- engagement and tool-outcome data that was already being collected.
--
-- Two things worth knowing about the underlying events:
--
--   * time_on_page is fired after the router has already moved on, so its
--     `path` column names the NEXT page. `label` carries the page the time
--     was actually spent on. label wins, everywhere.
--
--   * the salary calculator re-fires tool_compute on every settled input
--     change, so a raw count of it is a count of keystrokes, not of people.
--     params->>'first' marks the first fire of a session; that is the one
--     that means "someone used the calculator".
-- ============================================================
create or replace function public.events_summary(
  p_days int default 7,
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      coalesce(p_from, now() - make_interval(days => p_days)) as win_start,
      coalesce(p_to,   now())                                 as win_end,
      coalesce(p_from, now() - make_interval(days => p_days))
        - (coalesce(p_to, now()) - coalesce(p_from, now() - make_interval(days => p_days)))
                                                              as prev_start
  ),
  clean as (
    select * from public.page_events
     where is_bot = false
       and (visitor_id is null
            or visitor_id not in (select visitor_id from public.analytics_excluded))
  ),
  win as (
    select c.* from clean c, bounds b
     where c.created_at >= b.win_start and c.created_at < b.win_end
  ),
  prev as (
    select c.* from clean c, bounds b
     where c.created_at >= b.prev_start and c.created_at < b.win_start
  ),

  by_event as (
    select event, count(*) as n, count(distinct session_id) as sessions
      from win group by event order by count(*) desc limit 30
  ),
  by_cta as (
    select coalesce(nullif(location,''),'unknown') as location,
           coalesce(nullif(label,''),'')           as label,
           count(*) as n,
           count(distinct session_id) as sessions
      from win where event = 'cta_click'
     group by 1,2 order by count(*) desc limit 12
  ),
  outbound as (
    select coalesce(label,'') as label, count(*) as n
      from win where event = 'outbound_click'
     group by 1 order by count(*) desc limit 10
  ),

  -- Engagement: the deepest scroll each session reached on each page,
  -- then averaged. Averaging the raw marks would just measure how many
  -- marks fired, which rewards long pages for no reason.
  scroll_per as (
    select session_id, coalesce(nullif(label,''), path) as page, max(value) as depth
      from win where event = 'scroll_depth' and value is not null
     group by 1,2
  ),
  time_per as (
    select session_id, coalesce(nullif(label,''), path) as page, sum(value) as seconds
      from win where event = 'time_on_page' and value is not null
     group by 1,2
  ),

  -- Tool outcomes. `value` means a different thing per tool, so they are
  -- reported separately rather than averaged together into nonsense.
  ats as (
    select * from win
     where event = 'tool_compute' and label = 'resume-ats-checker'
  ),
  ats_bands as (
    select case
             when value is null then 'could not read the file'
             when value >= 85 then '85-100 · nothing structural wrong'
             when value >= 70 then '70-84 · writing is costing marks'
             when value >= 50 then '50-69 · something is being lost'
             else 'below 50 · needs rebuilding'
           end as band,
           count(*) as n
      from ats group by 1 order by 1 desc
  ),
  salary as (
    select * from win
     where event = 'tool_compute' and label = 'in-hand-salary-calculator'
       and params->>'first' = 'true'
  ),
  salary_bands as (
    select case
             when value < 500000  then 'under 5 LPA'
             when value < 1000000 then '5-10 LPA'
             when value < 1500000 then '10-15 LPA'
             when value < 2500000 then '15-25 LPA'
             else '25 LPA and above'
           end as band,
           count(*) as n
      from salary where value is not null group by 1 order by count(*) desc
  ),

  -- The real funnel: someone lands, reads, tries a tool, then asks for access.
  f as (
    select
      (select count(distinct session_id) from win)                                          as sessions,
      (select count(distinct session_id) from win where event = 'article_view')             as read_article,
      (select count(distinct session_id) from scroll_per where depth >= 75)                 as read_deeply,
      (select count(distinct session_id) from win where event = 'tool_view')                as opened_tool,
      (select count(distinct session_id) from win where event = 'tool_compute')             as used_tool,
      (select count(distinct session_id) from win where event = 'cta_view')                 as saw_cta,
      (select count(distinct session_id) from win where event = 'cta_click')                as clicked_cta,
      (select count(distinct session_id) from win where event = 'waitlist_success')         as joined
  ),
  prev_f as (
    select
      (select count(distinct session_id) from prev where event = 'tool_compute')     as used_tool,
      (select count(distinct session_id) from prev where event = 'waitlist_success') as joined
  ),

  -- When each event was first ever recorded.
  --
  -- Without this the funnel lies by omission: an event only wired up last week
  -- shows a tiny number next to events measured for months, and it reads as a
  -- collapse in behaviour rather than a gap in instrumentation. The UI uses
  -- these dates to say "measuring from" instead of showing a false drop.
  coverage as (
    select event, min(created_at) as first_seen
      from public.page_events
     where is_bot = false
     group by event
  )
  select jsonb_build_object(
    'days', p_days,
    'total', (select count(*) from win),
    'bots_blocked', (select count(*) from public.page_events, bounds
                      where is_bot = true
                        and created_at >= win_start and created_at < win_end),

    'by_event', (select coalesce(jsonb_agg(jsonb_build_object(
                   'event',event,'count',n,'sessions',sessions)),'[]'::jsonb) from by_event),
    'top_ctas', (select coalesce(jsonb_agg(jsonb_build_object(
                   'location',location,'label',label,'count',n,'sessions',sessions)),'[]'::jsonb) from by_cta),
    'outbound', (select coalesce(jsonb_agg(jsonb_build_object(
                   'label',label,'count',n)),'[]'::jsonb) from outbound),

    'engagement', jsonb_build_object(
      'avg_scroll',      (select round(avg(depth)) from scroll_per),
      'read_75_share',   (select case when count(*) = 0 then 0
                                 else round(100.0 * count(*) filter (where depth >= 75) / count(*)) end
                            from scroll_per),
      'avg_seconds',     (select round(avg(seconds)) from time_per),
      'median_seconds',  (select round(percentile_cont(0.5) within group (order by seconds)) from time_per)
    ),

    'tools', jsonb_build_object(
      'ats_runs',        (select count(*) from ats),
      'ats_people',      (select count(distinct visitor_id) from ats),
      'ats_avg_score',   (select round(avg(value)) from ats where value is not null),
      'ats_failed_read', (select count(*) from ats where value is null),
      'ats_bands',       (select coalesce(jsonb_agg(jsonb_build_object('band',band,'count',n)),'[]'::jsonb) from ats_bands),
      'salary_runs',     (select count(*) from salary),
      'salary_people',   (select count(distinct visitor_id) from salary),
      'salary_median_ctc',(select round(percentile_cont(0.5) within group (order by value)) from salary where value is not null),
      'salary_bands',    (select coalesce(jsonb_agg(jsonb_build_object('band',band,'count',n)),'[]'::jsonb) from salary_bands)
    ),

    'funnel', (select jsonb_build_object(
      'sessions', sessions, 'read_article', read_article, 'read_deeply', read_deeply,
      'opened_tool', opened_tool, 'used_tool', used_tool,
      'saw_cta', saw_cta, 'clicked_cta', clicked_cta, 'joined', joined) from f),
    'prev_funnel', (select jsonb_build_object(
      'used_tool', used_tool, 'joined', joined) from prev_f),
    'first_seen', (select coalesce(jsonb_object_agg(event, to_char(first_seen, 'YYYY-MM-DD')),
                                   '{}'::jsonb) from coverage)
  );
$$;

revoke all on function public.events_summary(int, timestamptz, timestamptz) from public, anon, authenticated;

comment on function public.events_summary(int, timestamptz, timestamptz) is
  'Behaviour rollup: the product funnel, engagement depth, and per-tool outcomes.';


-- ============================================================
-- content_performance — the screen that answers "which articles work".
--
-- Page views alone rank a page by how many times it was opened. That is not
-- the same as which page earns its place: a page can be opened often because
-- it sits in the nav, and a page can be opened rarely but read to the end and
-- send people to a tool. This returns both halves side by side.
-- ============================================================
create or replace function public.content_performance(
  p_days  int default 30,
  p_limit int default 60,
  p_from  timestamptz default null,
  p_to    timestamptz default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select coalesce(p_from, now() - make_interval(days => p_days)) as win_start,
           coalesce(p_to,   now())                                 as win_end
  ),
  views as (
    select v.* from public.page_views v, bounds b
     where v.is_bot = false
       and v.created_at >= b.win_start and v.created_at < b.win_end
       and (v.visitor_id is null
            or v.visitor_id not in (select visitor_id from public.analytics_excluded))
  ),
  events as (
    select e.* from public.page_events e, bounds b
     where e.is_bot = false
       and e.created_at >= b.win_start and e.created_at < b.win_end
       and (e.visitor_id is null
            or e.visitor_id not in (select visitor_id from public.analytics_excluded))
  ),

  -- Which page opened each session, so we can tell a front door from a
  -- page people only reach by clicking around inside the site.
  sess as (
    select session_id, min(created_at) as started_at
      from views where session_id is not null group by session_id
  ),
  entries as (
    select v.path, count(*) as n
      from views v join sess s
        on s.session_id = v.session_id and s.started_at = v.created_at
     group by v.path
  ),

  -- Tagged so the screen can separate the thing you can improve (an article)
  -- from the things you cannot (the home page, a category listing).
  base as (
    select path,
           case
             when path like '/blog/category/%' or path like '/blog/page/%' or path = '/blog'
               then 'listing'
             when path like '/blog/%'  then 'article'
             when path like '/tools/%' then 'tool'
             else 'page'
           end as kind,
           count(*) as views,
           count(distinct visitor_id) as readers,
           count(distinct session_id) as sessions
      from views
     where path = '/' or path like '/blog%' or path like '/tools/%'
     group by 1, 2
  ),
  scroll_per as (
    select session_id, coalesce(nullif(label,''), path) as page, max(value) as depth
      from events where event = 'scroll_depth' and value is not null group by 1,2
  ),
  scroll_agg as (
    select page as path, round(avg(depth)) as avg_scroll,
           round(100.0 * count(*) filter (where depth >= 75) / nullif(count(*),0)) as finished_share
      from scroll_per group by 1
  ),
  time_per as (
    select session_id, coalesce(nullif(label,''), path) as page, sum(value) as seconds
      from events where event = 'time_on_page' and value is not null group by 1,2
  ),
  time_agg as (
    select page as path, round(avg(seconds)) as avg_seconds from time_per group by 1
  ),
  cta_agg as (
    select path, count(*) as cta_clicks
      from events where event = 'cta_click' group by 1
  ),
  src_agg as (
    select path, count(*) filter (where source = 'google') as google_views
      from views group by 1
  ),
  rows as (
    select b.path, b.kind,
           b.views, b.readers, b.sessions,
           coalesce(e.n, 0)             as entries,
           coalesce(s.avg_scroll, 0)    as avg_scroll,
           coalesce(s.finished_share,0) as finished_share,
           coalesce(t.avg_seconds, 0)   as avg_seconds,
           coalesce(c.cta_clicks, 0)    as cta_clicks,
           coalesce(g.google_views, 0)  as google_views
      from base b
      left join entries    e on e.path = b.path
      left join scroll_agg s on s.path = b.path
      left join time_agg   t on t.path = b.path
      left join cta_agg    c on c.path = b.path
      left join src_agg    g on g.path = b.path
     order by b.views desc
     limit p_limit
  )
  select jsonb_build_object(
    'days', p_days,
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
       'path', path, 'kind', kind, 'views', views, 'readers', readers, 'sessions', sessions,
       'entries', entries, 'avg_scroll', avg_scroll, 'finished_share', finished_share,
       'avg_seconds', avg_seconds, 'cta_clicks', cta_clicks, 'google_views', google_views
     ) order by views desc), '[]'::jsonb) from rows),
    'totals', jsonb_build_object(
      'pages',    (select count(*) from base),
      'articles', (select count(*) from base where kind = 'article'),
      'views',    (select coalesce(sum(views),0) from base)
    )
  );
$$;

revoke all on function public.content_performance(int, int, timestamptz, timestamptz) from public, anon, authenticated;

comment on function public.content_performance(int, int, timestamptz, timestamptz) is
  'Per-page performance: views, readers, entry share, scroll depth, time on page and CTA clicks.';
