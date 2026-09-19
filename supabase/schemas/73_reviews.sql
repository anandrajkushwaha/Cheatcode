-- ============================================================
-- What customers say, kept as data rather than as markup.
--
-- The Pro landing page shows quotes from people who use the product. The
-- obvious version of that is an array in a .tsx file, and it is wrong for one
-- reason: every new quote then needs a code change and a deploy, which means
-- in practice the quotes never change. Putting them in a table means the
-- admin panel can add one in a minute.
--
-- `position` is what decides the order on the page, not created_at. Which
-- testimonial leads is an editorial decision — the strongest one goes first,
-- and that is rarely the newest.
--
-- Safe to re-run.
-- ============================================================

create table if not exists public.reviews (
  id          bigint generated always as identity primary key,

  name        text not null,
  -- The line under the name: "Software Engineer", "Marketing Executive".
  -- Deliberately free text rather than a job-title lookup; these are people's
  -- own words about themselves.
  role        text not null,
  quote       text not null,

  -- Nullable on purpose. A review with no photo renders as initials rather
  -- than a broken image, so a missing upload never blocks publishing one.
  avatar_url  text,

  -- Lower sorts first. Gaps are fine and expected — the admin screen moves a
  -- row by swapping this value with its neighbour's.
  position    int  not null default 0,

  -- Drafts are the point: write a quote now, publish it once the person has
  -- agreed to it being on the site.
  published   boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists reviews_running_order_idx
  on public.reviews (position asc, id asc) where published;

-- ------------------------------------------------------------------ access
--
-- Readable by anyone, but only the published rows — the landing page needs
-- them and there is nothing private in a testimonial that is already on a
-- public page. Drafts stay invisible to the client entirely.
--
-- No insert, update or delete policy exists for anon or authenticated. The
-- only writer is the admin panel, through the service key. A visitor who
-- could write here could put words in a named person's mouth on our own
-- domain, which is the one thing this table must never allow.

alter table public.reviews enable row level security;

drop policy if exists "read published reviews" on public.reviews;
create policy "read published reviews"
  on public.reviews for select
  to anon, authenticated
  using (published);

comment on table public.reviews is
  'Testimonials shown on the Pro landing page. Ordered by position, not date. '
  'Written only by the admin panel via the service key.';
