-- ============================================================
-- ats_leads — who ran the free resume ATS checker.
--
-- The checker reads the file in the browser; only the contact block it finds
-- (name, email, phone, LinkedIn) plus the score is posted to
-- /api/tools/ats-lead and stored here. The uploader says so, and so does the
-- privacy page. Signed-in or not: user_id is set when there is a session.
--
-- Written only by the server with the service role. RLS on with no policies,
-- so the anon and authenticated keys can neither read nor write it.
-- Safe to re-run.
-- ============================================================

create table if not exists public.ats_leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text,
  email       text,
  phone       text,
  linkedin    text,
  score       integer,
  file_type   text,
  user_id     uuid,
  source      text,
  medium      text,
  campaign    text,
  landing     text,
  in_app      boolean not null default false
);

create index if not exists ats_leads_created_idx on public.ats_leads (created_at desc);
create index if not exists ats_leads_email_idx on public.ats_leads (email) where email is not null;
create index if not exists ats_leads_phone_idx on public.ats_leads (phone) where phone is not null;

alter table public.ats_leads enable row level security;
revoke all on public.ats_leads from anon, authenticated;
