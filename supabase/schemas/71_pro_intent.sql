-- ============================================================
-- Who wants to pay.
--
-- The paid plan has been visible in the product for a while and nothing has
-- been writing down who reached for it. The analytics tables cannot answer it
-- either, and that is by design rather than by accident: page_views and
-- page_events carry a random visitor id and no user id, which is what lets
-- the privacy policy say what it says. So this is a separate, deliberate
-- record — signed-in, named, and only for this one action.
--
-- Nothing backfills. Every click before this table existed was anonymous when
-- it happened and cannot be attributed to a person now; the admin screen
-- shows those as a count and says so, rather than guessing.
--
-- Run after 20_app_accounts.sql. Safe to re-run.
-- ============================================================

create table if not exists public.pro_intent (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users on delete cascade,

  -- Denormalised so the admin list needs no join and so the record survives
  -- the account being deleted from auth while the row is still wanted for a
  -- count. It is the address at the moment of the click, not a live lookup.
  email      text,

  -- Which surface sent them. 'direct' means they arrived at the upgrade
  -- screen without one of the tagged links — a bookmark, or a refresh.
  source     text not null default 'direct',
  path       text,

  created_at timestamptz not null default now()
);

create index if not exists pro_intent_user_idx
  on public.pro_intent (user_id, created_at desc);

create index if not exists pro_intent_recent_idx
  on public.pro_intent (created_at desc);

-- ------------------------------------------------------------------ access
--
-- No policy is granted to anon or authenticated on purpose. The only writer
-- is the server with the service key, and the only reader is the admin panel
-- behind its own login. A client that could insert here could inflate the
-- one number this table exists to report.

alter table public.pro_intent enable row level security;

comment on table public.pro_intent is
  'One row each time a signed-in person reaches the upgrade screen. Written '
  'server-side only. Not backfilled: clicks before this table existed were '
  'anonymous and stay that way.';
