-- ============================================================
-- Writing and promoting from the dashboard.
--
-- Until now every article arrived through the deployment: edit articles.json,
-- push, wait for Vercel, press Re-sync. That is the right pipeline for a batch
-- of twenty, and the wrong one for fixing a typo or putting one post out today.
-- This adds the second path — write, schedule and publish from the admin panel,
-- into the same posts table, so both routes produce identical rows.
--
-- It also adds promotional banners: your own slots on your own site, with the
-- one thing an ad network would never give you — honest per-banner numbers.
--
-- Run AFTER 10_dashboard.sql. Safe to re-run.
-- ============================================================


-- ---------- posts: fields the editor needs ----------

-- The image at the top of an article, and in its social card.
alter table public.posts add column if not exists cover_image     text;
alter table public.posts add column if not exists cover_alt       text;

-- Where the row came from. 'file' rows are owned by content/launch/articles.json
-- and a re-sync will overwrite them; 'editor' rows are yours and it must not.
alter table public.posts add column if not exists origin          text not null default 'file';

-- A post being written but not yet scheduled. status was already here but only
-- ever held 'published'; drafts make the editor usable without publishing.
alter table public.posts add column if not exists last_edited_at  timestamptz;

create index if not exists posts_origin_idx on public.posts (origin);
create index if not exists posts_status_idx on public.posts (status, published_at desc);

comment on column public.posts.origin is
  'file = imported from the bundled JSON and overwritten on re-sync; editor = written in the admin panel and never overwritten.';


-- ---------- promotional banners ----------

create table if not exists public.promo_banners (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                 -- internal label, never shown
  placement   text not null,                 -- in_article | sidebar | blog_list
  eyebrow     text,
  title       text not null,
  body        text,
  cta_label   text,
  cta_href    text,
  image_url   text,
  image_alt   text,
  theme       text not null default 'dark',  -- dark | light
  active      boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint promo_placement_ck
    check (placement in ('in_article', 'sidebar', 'blog_list')),
  constraint promo_theme_ck
    check (theme in ('dark', 'light'))
);

create index if not exists promo_live_idx
  on public.promo_banners (placement, sort_order)
  where active = true;

alter table public.promo_banners enable row level security;

-- Readable by the site so a banner can render for an anonymous visitor.
-- Writable only with the secret key, from the admin panel.
grant select on public.promo_banners to anon, authenticated;

drop policy if exists "anyone can read a live banner" on public.promo_banners;
create policy "anyone can read a live banner"
  on public.promo_banners for select to anon, authenticated
  using (
    active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >  now())
  );

comment on table public.promo_banners is
  'Self-served promo slots. One row per banner; placement decides where on the site it appears.';


-- ============================================================
-- banner_stats — views, clicks and CTR per banner.
--
-- The banner id travels in the event label, so this joins events back onto the
-- table rather than storing counters on the row. That keeps the write path a
-- plain insert (no contention, no lost updates) and means the numbers respect
-- the same bot and owner exclusion as everything else on the dashboard.
-- ============================================================
create or replace function public.banner_stats(
  p_days int default 30,
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
    select coalesce(p_from, now() - make_interval(days => p_days)) as win_start,
           coalesce(p_to,   now())                                 as win_end
  ),
  ev as (
    select e.event, e.label, e.session_id
      from public.page_events e, bounds b
     where e.created_at >= b.win_start and e.created_at < b.win_end
       and e.is_bot = false
       and e.event in ('banner_view', 'banner_click')
       and (e.visitor_id is null
            or e.visitor_id not in (select visitor_id from public.analytics_excluded))
  ),
  agg as (
    select label as banner_id,
           count(*) filter (where event = 'banner_view')  as views,
           count(*) filter (where event = 'banner_click') as clicks,
           count(distinct session_id) filter (where event = 'banner_view')  as view_sessions,
           count(distinct session_id) filter (where event = 'banner_click') as click_sessions
      from ev group by 1
  ),
  rows as (
    select b.id::text as id, b.name, b.placement, b.active, b.title,
           coalesce(a.views, 0)          as views,
           coalesce(a.clicks, 0)         as clicks,
           coalesce(a.view_sessions, 0)  as view_sessions,
           coalesce(a.click_sessions, 0) as click_sessions,
           case when coalesce(a.views, 0) = 0 then 0
                else round(100.0 * a.clicks / a.views, 2) end as ctr
      from public.promo_banners b
      left join agg a on a.banner_id = b.id::text
     order by coalesce(a.clicks, 0) desc, b.sort_order
  )
  select jsonb_build_object(
    'days', p_days,
    'rows', (select coalesce(jsonb_agg(to_jsonb(rows)), '[]'::jsonb) from rows),
    'totals', jsonb_build_object(
      'views',  (select coalesce(sum(views), 0)  from rows),
      'clicks', (select coalesce(sum(clicks), 0) from rows)
    )
  );
$$;

revoke all on function public.banner_stats(int, timestamptz, timestamptz)
  from public, anon, authenticated;

comment on function public.banner_stats(int, timestamptz, timestamptz) is
  'Per-banner views, clicks and CTR, using the same bot and owner exclusion as the rest of the dashboard.';


-- ============================================================
-- Storage for images uploaded in the editor.
--
-- The bucket is created here rather than by hand so a fresh install has it.
-- If the storage extension is not present the block is skipped and the editor
-- falls back to pasting an image URL, which always works.
-- ============================================================
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'storage' and table_name = 'buckets') then

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'post-media', 'post-media', true, 10485760,
      array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml']
    )
    on conflict (id) do update
      set public = true,
          file_size_limit = 10485760,
          allowed_mime_types = excluded.allowed_mime_types;

    -- Anyone may read an image; only the secret key may write one.
    begin
      execute $p$
        drop policy if exists "public read of post media" on storage.objects;
        create policy "public read of post media"
          on storage.objects for select
          to public
          using (bucket_id = 'post-media');
      $p$;
    exception when insufficient_privilege then
      raise notice 'Could not set the storage policy — create it in the Storage UI if uploads 403.';
    end;

    raise notice 'Storage bucket post-media is ready.';
  else
    raise notice 'No storage schema here — image upload will fall back to pasting a URL.';
  end if;
end $$;
