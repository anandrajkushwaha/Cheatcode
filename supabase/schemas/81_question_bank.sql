-- ============================================================
-- The public interview question bank.
--
-- This is the acquisition side of mock interviews: role pages that answer
-- "graphic designer interview questions" for somebody who has never heard of
-- us, and end with a mock interview they can only take by signing in.
--
-- Two tables, and a `published` flag that starts false. That flag is the
-- important part. These sets are drafted by a model, and publishing
-- unreviewed machine-written pages at scale is both how a site gets treated
-- as spam and how a wrong answer ends up with our name on it. Nothing goes
-- live until a person has read it.
--
-- Run after 20_app_accounts.sql. Safe to re-run.
-- ============================================================

create table if not exists public.question_banks (
  id          bigint generated always as identity primary key,

  -- "Graphic Designer". Title case, as it should read in an <h1>.
  role        text not null,
  -- "graphic-designer". The URL. Unique, because it is the page.
  slug        text not null unique,

  -- One paragraph of real context above the questions, so the page is not
  -- twenty questions and nothing else.
  intro       text,

  published   boolean not null default false,
  published_at timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists question_banks_live_idx
  on public.question_banks (slug) where published;

create table if not exists public.question_bank_items (
  id        bigint generated always as identity primary key,
  bank_id   bigint not null references public.question_banks on delete cascade,

  position  int  not null,
  question  text not null,
  answer    text not null,

  unique (bank_id, position)
);

-- ------------------------------------------------------------------ access
--
-- Anonymous read of published banks, because the whole point is that these
-- pages are reachable without an account. Items follow their bank: an item
-- whose bank is a draft is not readable, or a draft page would be one
-- guessed id away from being public.
--
-- No write policy for anyone. The admin panel writes with the service key.

alter table public.question_banks      enable row level security;
alter table public.question_bank_items enable row level security;

drop policy if exists "read published banks" on public.question_banks;
create policy "read published banks"
  on public.question_banks for select
  to anon, authenticated
  using (published);

drop policy if exists "read published bank items" on public.question_bank_items;
create policy "read published bank items"
  on public.question_bank_items for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.question_banks b
      where b.id = bank_id and b.published
    )
  );

comment on table public.question_banks is
  'Public interview-question pages, one per role. Drafted by a model, '
  'published only after a person has read them.';
