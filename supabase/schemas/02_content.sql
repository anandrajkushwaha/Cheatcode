-- ============================================================
-- Cheatcode — Phase 1 content engine schema
-- Run this in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- ---------- enums ----------
do $$ begin
  create type public.post_status as enum ('queued','drafting','published','failed','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.post_type as enum ('editorial','programmatic','practical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.queue_status as enum ('pending','claimed','done','failed','skipped');
exception when duplicate_object then null; end $$;

-- ---------- categories (the 10 cluster hubs) ----------
create table if not exists public.categories (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  short_name      text,
  description     text,
  seo_title       text,
  seo_description text,
  intro_html      text,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

-- ---------- authors ----------
create table if not exists public.authors (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  role_title   text,
  bio          text,
  avatar_url   text,
  linkedin_url text,
  created_at   timestamptz not null default now()
);

-- ---------- posts ----------
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  post_type     public.post_type   not null default 'editorial',
  status        public.post_status not null default 'published',

  title         text not null,
  h1            text,
  excerpt       text not null,
  content_html  text not null,
  toc           jsonb not null default '[]'::jsonb,

  published_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),

  category_id   uuid references public.categories(id) on delete set null,
  author_id     uuid references public.authors(id)    on delete set null,

  -- SEO
  seo_title          text not null,
  seo_description    text not null,
  focus_keyword      text not null,
  secondary_keywords text[] not null default '{}',
  canonical_url      text,
  noindex            boolean not null default false,
  faq                jsonb not null default '[]'::jsonb,

  -- programmatic entity (null for editorial/practical)
  entity_type   text,
  entity_slug   text,
  entity_name   text,

  -- linking + conversion
  related_tool_slugs text[] not null default '{}',
  internal_links     jsonb  not null default '[]'::jsonb,

  -- quality gate output (written by /api/ingest, never by the author)
  word_count    int not null default 0,
  data_points   int not null default 0,
  quality_score int not null default 0,

  reading_minutes int not null default 0,
  view_count      bigint not null default 0,

  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title,'')),   'A') ||
    setweight(to_tsvector('english', coalesce(excerpt,'')), 'B')
  ) stored
);

create unique index if not exists posts_entity_uidx
  on public.posts (entity_type, entity_slug)
  where entity_type is not null;

create index if not exists posts_published_idx on public.posts (published_at desc) where status = 'published';
create index if not exists posts_category_idx  on public.posts (category_id, published_at desc);
create index if not exists posts_type_idx      on public.posts (post_type, published_at desc);
create index if not exists posts_search_idx    on public.posts using gin (search_vector);

-- keep updated_at honest
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
  before update on public.posts
  for each row execute function public.touch_updated_at();

-- ---------- tags (light, optional) ----------
create table if not exists public.tags (
  id   uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

create table if not exists public.post_tags (
  post_id uuid references public.posts(id) on delete cascade,
  tag_id  uuid references public.tags(id)  on delete cascade,
  primary key (post_id, tag_id)
);

-- ---------- keyword queue = the editorial calendar ----------
create table if not exists public.keyword_queue (
  id                 bigint generated always as identity primary key,
  focus_keyword      text not null unique,
  secondary_keywords text[] not null default '{}',
  category_slug      text not null,
  post_type          public.post_type not null default 'editorial',
  slot               int  not null default 1,
  priority           int  not null default 100,
  est_volume_in      text,
  intent             text,
  target_slug        text,
  entity_type        text,
  entity_slug        text,
  entity_name        text,
  brief              text,
  status             public.queue_status not null default 'pending',
  claimed_at         timestamptz,
  post_id            uuid references public.posts(id) on delete set null,
  attempts           int not null default 0,
  last_error         text,
  created_at         timestamptz not null default now()
);

create index if not exists kq_next_idx on public.keyword_queue (status, slot, priority, id);

-- ---------- ops ----------
create table if not exists public.publish_log (
  id          bigint generated always as identity primary key,
  queue_id    bigint,
  post_id     uuid,
  slot        int,
  ok          boolean not null,
  reason      text,
  word_count  int,
  duration_ms int,
  created_at  timestamptz not null default now()
);

create index if not exists publish_log_recent_idx on public.publish_log (created_at desc);

create table if not exists public.redirects (
  id          bigint generated always as identity primary key,
  from_path   text not null unique,
  to_path     text not null,
  status_code int not null default 301,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Claim the next keyword for a slot.
-- Avoids publishing two articles from the same cluster back to back.
-- SECURITY DEFINER + revoked from public: only the secret key can call it.
-- ============================================================
create or replace function public.claim_next_keyword(p_slot int default null)
returns public.keyword_queue
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  row_out  public.keyword_queue;
  last_cat text;
begin
  select c.slug into last_cat
    from public.posts p
    join public.categories c on c.id = p.category_id
   where p.status = 'published'
   order by p.published_at desc
   limit 1;

  -- preferred: right slot, different cluster from the last published post
  select * into row_out
    from public.keyword_queue
   where status = 'pending'
     and (p_slot is null or slot = p_slot)
     and (last_cat is null or category_slug is distinct from last_cat)
   order by priority, id
   for update skip locked
   limit 1;

  -- fallback 1: right slot, ignore cluster rotation
  if row_out.id is null then
    select * into row_out
      from public.keyword_queue
     where status = 'pending'
       and (p_slot is null or slot = p_slot)
     order by priority, id
     for update skip locked
     limit 1;
  end if;

  -- fallback 2: any pending row, so a slot is never wasted
  if row_out.id is null then
    select * into row_out
      from public.keyword_queue
     where status = 'pending'
     order by priority, id
     for update skip locked
     limit 1;
  end if;

  if row_out.id is null then
    return null;
  end if;

  update public.keyword_queue
     set status = 'claimed',
         claimed_at = now(),
         attempts = attempts + 1
   where id = row_out.id;

  row_out.status := 'claimed';
  return row_out;
end;
$$;

revoke all on function public.claim_next_keyword(int) from public, anon, authenticated;

-- ============================================================
-- Row Level Security
-- Public may read published content and nothing else.
-- Every write goes through the API using the secret key.
-- ============================================================

alter table public.categories    enable row level security;
alter table public.authors       enable row level security;
alter table public.posts         enable row level security;
alter table public.tags          enable row level security;
alter table public.post_tags     enable row level security;
alter table public.redirects     enable row level security;
alter table public.keyword_queue enable row level security;
alter table public.publish_log   enable row level security;

grant select on public.categories, public.authors, public.tags,
               public.post_tags, public.redirects to anon, authenticated;
grant select on public.posts to anon, authenticated;

-- NOTE: no grants at all on keyword_queue / publish_log.
-- The publishable key cannot see the content calendar or the logs.

drop policy if exists "public reads published posts" on public.posts;
create policy "public reads published posts" on public.posts
  for select to anon, authenticated
  using (status = 'published' and published_at <= now() and noindex = false);

drop policy if exists "public reads categories" on public.categories;
create policy "public reads categories" on public.categories
  for select to anon, authenticated using (true);

drop policy if exists "public reads authors" on public.authors;
create policy "public reads authors" on public.authors
  for select to anon, authenticated using (true);

drop policy if exists "public reads tags" on public.tags;
create policy "public reads tags" on public.tags
  for select to anon, authenticated using (true);

drop policy if exists "public reads post_tags" on public.post_tags;
create policy "public reads post_tags" on public.post_tags
  for select to anon, authenticated using (true);

drop policy if exists "public reads redirects" on public.redirects;
create policy "public reads redirects" on public.redirects
  for select to anon, authenticated using (true);
