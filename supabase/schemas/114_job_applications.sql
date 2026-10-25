-- ============================================================
-- Applications: one row per job somebody prepared an application for.
--
-- The pack (fit, tailored summary/skills/bullets, cover letter, answers)
-- is written by the server after the model calls succeed; the person can
-- only move the status and keep notes. The posting's facts are copied in, so
-- the row still reads correctly after the job closes or leaves the feed.
-- ============================================================

create table if not exists public.job_applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  job_id        uuid references public.jobs(id) on delete set null,
  company       text not null,
  title         text not null,
  apply_url     text,
  status        text not null default 'prepared'
                check (status in ('prepared', 'applied', 'interview', 'offer', 'rejected', 'withdrawn')),
  match_score   int,
  pack          jsonb,
  draft_id      uuid references public.resume_drafts(id) on delete set null,
  notes         text,
  applied_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, job_id)
);

create index if not exists job_applications_user_idx
  on public.job_applications (user_id, updated_at desc);

alter table public.job_applications enable row level security;

grant select, update, delete on public.job_applications to authenticated;

drop policy if exists "read own applications" on public.job_applications;
create policy "read own applications" on public.job_applications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "update own applications" on public.job_applications;
create policy "update own applications" on public.job_applications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "delete own applications" on public.job_applications;
create policy "delete own applications" on public.job_applications
  for delete to authenticated using (user_id = auth.uid());

-- The pack and the job are the server's to write; a person moves the status.
revoke update on public.job_applications from authenticated;
grant update (status, notes, applied_at, updated_at) on public.job_applications to authenticated;
