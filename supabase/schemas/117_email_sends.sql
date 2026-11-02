-- One row per email sent to a person, for the admin's campaign report:
-- delivered, opened (tracking pixel), clicked (redirect), unsubscribed.
-- Written and read only with the service key (no RLS policies on purpose).
create table if not exists public.email_sends (
  id uuid primary key default gen_random_uuid(),
  campaign text not null,
  segment text not null,
  user_id uuid,
  email text not null,
  token text not null unique,
  status text not null default 'queued',      -- queued | sent | failed | test
  error text,
  sent_at timestamptz,
  opened_at timestamptz,
  open_count int not null default 0,
  clicked_at timestamptz,
  click_count int not null default 0,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_sends_campaign_idx on public.email_sends (campaign, created_at desc);
create unique index if not exists email_sends_once on public.email_sends (campaign, lower(email)) where status <> 'test';
alter table public.email_sends enable row level security;

-- Addresses that asked for no more marketing email. Checked before every send.
create table if not exists public.email_optouts (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.email_optouts enable row level security;
