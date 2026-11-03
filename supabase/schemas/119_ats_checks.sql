-- ============================================================
-- The ATS checker's daily free check and its ₹49 unlimited unlock.
--
-- One free check a day per person; after that the score and the fixes stay
-- on the server until the person has paid ₹49 once (job_unlocks kind 'ats',
-- no expiry) or is on Pro. The checker scores on the server for exactly this
-- reason: a score computed in the browser can be read in the browser.
--
-- ats_checks is one row per scoring request, written only by
-- /api/tools/ats-score. A person is recognised by any of: their account,
-- the browser's visitor id, a first-party device cookie, or the email and
-- phone in the resume — so clearing one of them is not a fresh free check.
-- The resume text is never stored, only a hash of it, so re-opening the
-- same resume on the same day shows the same result without a charge.
-- ============================================================

alter table public.job_unlocks drop constraint if exists job_unlocks_kind_check;
alter table public.job_unlocks add constraint job_unlocks_kind_check check (kind in ('job', 'pass', 'ats'));

create table if not exists public.ats_checks (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete set null,
  visitor     text,
  device      text,
  email       text,
  phone       text,
  text_hash   text not null,
  score       int,
  outcome     text not null check (outcome in ('free', 'repeat', 'paid', 'locked'))
);

create index if not exists ats_checks_created_idx on public.ats_checks (created_at desc);
create index if not exists ats_checks_visitor_idx on public.ats_checks (visitor, created_at desc);
create index if not exists ats_checks_device_idx on public.ats_checks (device, created_at desc);
create index if not exists ats_checks_email_idx on public.ats_checks (email, created_at desc);
create index if not exists ats_checks_phone_idx on public.ats_checks (phone, created_at desc);
create index if not exists ats_checks_user_idx on public.ats_checks (user_id, created_at desc);

alter table public.ats_checks enable row level security;
