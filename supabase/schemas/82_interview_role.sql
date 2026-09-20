-- ============================================================
-- Which role somebody is interviewing for, and the topics that go with it.
--
-- The first version of the interviews screen guessed: it showed whatever jobs
-- the profile's city and years filter returned, and offered those as practice.
-- For a graphic designer that produced six software engineering postings,
-- because the job filter has never known anything about role. Guessing wrong
-- in public is worse than asking, so now it asks.
--
-- `interview_role` is deliberately NOT target_roles. That array drives job
-- matching, and letting the interview screen write to it would mean picking
-- "Product Manager" to practise once quietly re-pointed somebody's entire job
-- feed.
--
-- Run after 80_interviews.sql. Safe to re-run.
-- ============================================================

alter table public.profiles
  add column if not exists interview_role text;

comment on column public.profiles.interview_role is
  'The role mock interviews are pitched at. Separate from target_roles, which '
  'drives job matching — practising for a role is not the same as wanting it.';

-- ------------------------------------------------------------------ topics
--
-- The sub-topics offered for a role — "Typography", "Brand identity" and so
-- on for a designer. Written by a model once per role and then shared by
-- everybody who picks that role, because the answer does not depend on who is
-- asking. One generation serves every future graphic designer.

create table if not exists public.interview_topic_sets (
  -- The role, lowercased and hyphenated. The cache key.
  slug       text primary key,
  role       text not null,
  -- A list of strings. Read whole, never queried into.
  topics     jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Readable by any signed-in person: it is a list of topic names for a job
-- title, with nothing personal in it, and every user of that role wants the
-- same rows. Written only by the server.
alter table public.interview_topic_sets enable row level security;

drop policy if exists "read topic sets" on public.interview_topic_sets;
create policy "read topic sets"
  on public.interview_topic_sets for select
  to authenticated
  using (true);

comment on table public.interview_topic_sets is
  'Sub-topics per role, generated once and shared. Not per user — the topics '
  'for "Graphic Designer" are the same whoever asks.';
