-- ============================================================
-- "Have a person read my resume."
--
-- The one perk on the Pro card that was never a feature. This is the smallest
-- honest version of it: somebody asks, it lands in a queue, a human reads it
-- and emails them back. No workflow engine, no SLA timer, no reviewer
-- assignment — those are things to add when there is more than one reviewer,
-- and adding them first is how a feature that could have shipped this week
-- ships in a quarter.
--
-- What is deliberately NOT here: the resume itself. It is already in
-- public.resumes and public.resume_drafts, and copying it into this row would
-- mean a review of a version they have since replaced. The request points at
-- what they had; the reviewer reads the current one.
--
-- Run after 50_resume_drafts.sql. Safe to re-run.
-- ============================================================

create table if not exists public.resume_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,

  -- Whichever they pointed at. Both nullable: somebody may have an upload and
  -- no draft, or the other way round.
  resume_id   uuid references public.resumes on delete set null,
  draft_id    uuid references public.resume_drafts on delete set null,

  -- The role they are aiming at, and anything they want looked at in
  -- particular. This is what turns a review from generic advice into an
  -- answer, so the form asks for it rather than making it optional.
  target_role text,
  note        text,

  -- Denormalised so the queue needs no join and so a reply is still
  -- deliverable after the auth row is gone.
  email       text,
  full_name   text,

  status      text not null default 'open',
  -- Written by whoever handled it. Never shown to the person — it is a note
  -- to the next reviewer, not feedback.
  admin_note  text,

  created_at  timestamptz not null default now(),
  done_at     timestamptz,

  constraint resume_reviews_status_ck check (status in ('open', 'done', 'cancelled'))
);

create index if not exists resume_reviews_queue_idx
  on public.resume_reviews (created_at desc) where status = 'open';

create index if not exists resume_reviews_user_idx
  on public.resume_reviews (user_id, created_at desc);

-- ------------------------------------------------------------------ access
--
-- Read your own, so the resume screen can say "we have it, expect an email".
-- No insert policy: the server writes these, because inserting one is the
-- thing Pro pays for and a client that could insert could help itself.

alter table public.resume_reviews enable row level security;

drop policy if exists "read own resume reviews" on public.resume_reviews;
create policy "read own resume reviews"
  on public.resume_reviews for select
  to authenticated using (user_id = (select auth.uid()));

comment on table public.resume_reviews is
  'Requests for a human resume review. Pro only. Handled by a person, who '
  'replies by email — there is no in-product reply thread on purpose.';
