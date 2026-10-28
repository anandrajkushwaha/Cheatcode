-- ============================================================
-- What each signed-in user did with the post-download match popup: shown,
-- closed, which unlock they reached for, applied. Keyed to the user (the
-- page_events log only knows a browser session), for /admin/match-popup.
-- Written by the server only (/api/app/funnel/popup); nobody reads it but
-- the admin, through the service key.
-- ============================================================

create table if not exists public.match_popup_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  event       text not null check (event in ('shown','closed','unlock_click','pass_click','apply_click','see_all_click','pro_click')),
  job_id      uuid,
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists match_popup_events_created_idx on public.match_popup_events (created_at desc);
create index if not exists match_popup_events_user_idx on public.match_popup_events (user_id, created_at desc);

alter table public.match_popup_events enable row level security;
revoke all on public.match_popup_events from anon, authenticated;

-- The same popup after the free ATS check, where the person may not be
-- signed in: then the row carries the browser's visitor id and the contact
-- block the checker already read from the resume (see /admin/leads).
alter table public.match_popup_events alter column user_id drop not null;
alter table public.match_popup_events add column if not exists source text not null default 'resume' check (source in ('resume','ats'));
alter table public.match_popup_events add column if not exists visitor text;
alter table public.match_popup_events add column if not exists contact jsonb;
create index if not exists match_popup_events_visitor_idx on public.match_popup_events (visitor, created_at desc);
