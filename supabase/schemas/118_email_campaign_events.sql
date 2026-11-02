-- Opens and clicks for emails sent by hand (from Gmail), counted per
-- campaign rather than per person: the HTML carries a pixel
-- (/e/p/<campaign>) and the button a tracked link (/e/l/<campaign>).
-- Service key only (no RLS policies on purpose).
create table if not exists public.email_campaign_events (
  id bigint generated always as identity primary key,
  campaign text not null,
  kind text not null check (kind in ('open','click')),
  ua text,
  created_at timestamptz not null default now()
);
create index if not exists email_campaign_events_idx on public.email_campaign_events (campaign, kind, created_at);
alter table public.email_campaign_events enable row level security;
