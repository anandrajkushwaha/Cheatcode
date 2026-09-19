-- ============================================================
-- Insights: the hiring-market feed behind the studio's right panel.
--
-- Same shape as the jobs pipeline next door, and deliberately so: a table of
-- sources that can be switched on and off without a deploy, a table of items
-- deduplicated per source, and a run that writes its own status back onto the
-- source row. If you understand 30_jobs.sql you already understand this.
--
-- What is stored, and what is not. Each row keeps a headline, a short excerpt
-- and a link. It does not keep the publisher's article. That is a legal line
-- rather than a storage decision: an aggregator that mirrors full text is
-- republishing somebody else's work, and no amount of attribution fixes it.
-- Every screen that shows one of these ends in a link to the source.
--
-- Run after 20_app_accounts.sql. Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------ sources

create table if not exists public.insight_sources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  feed_url    text not null unique,

  -- Which tab in the panel this source's items land under. Set per feed
  -- rather than per item because a feed has an editorial character — a
  -- market-news feed is not going to start emitting how-to guides.
  kind        text not null default 'trend'
              check (kind in ('trend', 'guide', 'tip')),

  is_active   boolean not null default true,

  -- Written by the run, read by the dashboard. A feed that has been failing
  -- for a week should be visible as a failing feed, not as silence.
  last_run_at timestamptz,
  last_status text,
  last_count  int,
  last_error  text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------ items

create table if not exists public.insights (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid not null references public.insight_sources on delete cascade,

  -- The feed's own id for this item: its guid, or its link when it has none.
  -- Unique per source rather than globally, because two outlets covering the
  -- same wire story are two items, and collapsing them would silently drop
  -- one publisher's coverage.
  external_id  text not null,

  kind         text not null default 'trend'
               check (kind in ('trend', 'guide', 'tip')),

  title        text not null,
  summary      text,
  url          text not null,
  image_url    text,

  -- Denormalised from the source so a card can be rendered without a join,
  -- and so the attribution survives the source row being deleted.
  source_name  text not null,

  published_at  timestamptz,
  first_seen_at timestamptz not null default now(),
  is_active     boolean not null default true,

  unique (source_id, external_id)
);

create index if not exists insights_recent_idx
  on public.insights (published_at desc nulls last, first_seen_at desc)
  where is_active;

create index if not exists insights_kind_idx
  on public.insights (kind, published_at desc nulls last)
  where is_active;

-- ------------------------------------------------------------ access
--
-- The studio is behind sign-in, so reading is granted to authenticated users
-- and to nobody else. Writing happens only through the service key inside the
-- ingest run — there is no client path that can insert a row here, which is
-- what stops a signed-in user from injecting a card into everyone's panel.

alter table public.insight_sources enable row level security;
alter table public.insights        enable row level security;

drop policy if exists "signed-in users can read insights" on public.insights;
create policy "signed-in users can read insights"
  on public.insights for select to authenticated
  using (is_active);

drop policy if exists "signed-in users can read sources" on public.insight_sources;
create policy "signed-in users can read sources"
  on public.insight_sources for select to authenticated
  using (true);

grant select on public.insights        to authenticated;
grant select on public.insight_sources to authenticated;

-- ------------------------------------------------------------ seeds
--
-- Two to start, both standard WordPress feeds from Indian startup and tech
-- outlets. Verify each one returns items before you rely on it — a feed URL
-- is the sort of thing that is right until a publisher redesigns — and add
-- the rest from the table. The run records per-source failures, so a wrong
-- URL here shows up as last_error rather than as an empty panel.

insert into public.insight_sources (name, feed_url, kind) values
  ('YourStory', 'https://yourstory.com/feed', 'trend'),
  ('Inc42',     'https://inc42.com/feed/',    'trend')
on conflict (feed_url) do nothing;
