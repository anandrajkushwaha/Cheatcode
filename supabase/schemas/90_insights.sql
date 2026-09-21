-- ============================================================
-- Insights: short, sourced news for Indian job seekers.
--
-- Inshorts-shaped: every item is a headline and a summary of at most 70
-- words, written by us from the publisher's own text, with a link back to
-- the original. Nothing else from the article is stored — no body, no image.
--
-- insight_sources  RSS/Atom feeds we read. Switch one off with `active`;
--                  last_* shows whether it is still working.
-- insights         what the reader sees. Written and published by the team
--                  from the admin panel (Insights tab). The automatic feed
--                  reader in lib/insights/ingest.ts can also fill it, but it
--                  is not scheduled — see vercel.json.
--
-- Read server-side with the service key only; RLS is on with no policies,
-- so the browser can reach neither table directly.
--
-- Safe to re-run.
-- ============================================================

create table if not exists public.insight_sources (
  id           bigserial primary key,
  name         text not null,
  feed_url     text not null unique,
  active       boolean not null default true,
  last_run_at  timestamptz,
  last_status  text,
  last_count   int,
  last_error   text
);

create table if not exists public.insights (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 5 and 160),
  summary       text not null check (char_length(summary) between 40 and 700),
  -- trend: what the market is doing. guide: a rule, policy or date the
  -- reader may need to act on.
  category      text not null check (category in ('trend', 'guide')),
  source_name   text not null,
  source_url    text not null unique,
  -- The publisher's time, when the feed gave one.
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  -- The model's 0–10 judgement of how much this matters to our audience.
  relevance     smallint,
  -- Normalised headline words, for spotting the same story from two outlets.
  title_key     text,
  is_published  boolean not null default true
);

create index if not exists insights_feed_idx
  on public.insights (created_at desc) where is_published;
create index if not exists insights_category_idx
  on public.insights (category, created_at desc) where is_published;

alter table public.insight_sources enable row level security;
alter table public.insights enable row level security;

-- Feeds from Indian business and jobs desks. If one stops working its row
-- shows last_status = 'error' with the reason; replace or deactivate it here.
insert into public.insight_sources (name, feed_url) values
  ('The Economic Times',  'https://economictimes.indiatimes.com/jobs/rssfeeds/107115321.cms'),
  ('The Economic Times',  'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms'),
  ('The Economic Times',  'https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms'),
  ('Mint',                'https://www.livemint.com/rss/companies'),
  ('Mint',                'https://www.livemint.com/rss/economy'),
  ('Mint',                'https://www.livemint.com/rss/technology'),
  ('BusinessLine',        'https://www.thehindubusinessline.com/economy/feeder/default.rss'),
  ('Business Standard',   'https://www.business-standard.com/rss/economy-102.rss'),
  ('Google News',         'https://news.google.com/rss/search?q=India+(hiring+OR+layoffs+OR+jobs+OR+salary+OR+freshers)+when:2d&hl=en-IN&gl=IN&ceid=IN:en'),
  ('Google News',         'https://news.google.com/rss/search?q=(H-1B+OR+EPFO+OR+%22labour+code%22+OR+%22income+tax%22+OR+%22notice+period%22)+India+when:3d&hl=en-IN&gl=IN&ceid=IN:en')
on conflict (feed_url) do nothing;

-- ------------------------------------------------------------ written by hand
-- Posts from the admin panel may have no source link, may carry an image
-- (shown only inside the Insights reader, never on the home card), and
-- remember who wrote them. Written as alters so this file stays safe to
-- re-run on a table created by an earlier version of it.
alter table public.insights alter column source_name drop not null;
alter table public.insights alter column source_url  drop not null;
alter table public.insights add column if not exists image_url   text;
alter table public.insights add column if not exists author_id   text;
alter table public.insights add column if not exists author_name text;
alter table public.insights add column if not exists updated_at  timestamptz;
