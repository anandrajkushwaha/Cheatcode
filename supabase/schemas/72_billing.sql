-- ============================================================
-- Subscriptions, and the webhook log that makes them trustworthy.
--
-- Razorpay is the source of truth for money; this is the local mirror of it.
-- Two tables, and the second one is not optional:
--
--   `subscriptions` is what we know about a person's mandate — its Razorpay
--   id, its status, and the period it has been paid up to. `profiles.plan`
--   stays the thing the product reads, so nothing in the app has to learn
--   about billing to know whether somebody is Pro.
--
--   `billing_events` exists because webhooks are delivered *at least* once.
--   Razorpay will resend an event if our response is slow or lost, and a
--   handler without a memory would grant a second month for the same rupee.
--   The unique event id is the memory.
--
-- Nothing here is written from a browser. The only writer is the webhook
-- route with the service key, and the only reader outside it is the admin
-- panel — a client that could insert here could grant itself a plan.
--
-- Run after 20_app_accounts.sql. Safe to re-run.
-- ============================================================

create table if not exists public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users on delete cascade,

  -- Razorpay's ids. The subscription id is unique because one mandate is one
  -- row; re-authorising creates a new subscription at their end too.
  rzp_subscription_id text not null unique,
  rzp_plan_id         text,

  -- Mirrors Razorpay's own vocabulary rather than inventing ours: created,
  -- authenticated, active, pending, halted, cancelled, completed, expired.
  status              text not null default 'created',

  /**
   * The period the customer has actually paid for.
   *
   * current_end is what plan_expires_at is set from. It is deliberately taken
   * from the charge event rather than computed as "now + 30 days": a failed
   * retry, a paused mandate or a mid-cycle upgrade all move this date, and a
   * locally invented one would drift from what the customer was billed.
   */
  current_start       timestamptz,
  current_end         timestamptz,

  charge_count        integer not null default 0,
  short_url           text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists subscriptions_user_idx
  on public.subscriptions (user_id, created_at desc);

-- ------------------------------------------------------------ webhook log

create table if not exists public.billing_events (
  id           bigint generated always as identity primary key,

  -- Razorpay's x-razorpay-event-id header. The whole point of this table.
  event_id     text not null unique,

  event        text not null,
  rzp_subscription_id text,
  payload      jsonb,
  received_at  timestamptz not null default now()
);

create index if not exists billing_events_recent_idx
  on public.billing_events (received_at desc);

-- ------------------------------------------------------------------ access

alter table public.subscriptions  enable row level security;
alter table public.billing_events enable row level security;

-- A person may see their own mandate — the upgrade screen shows its status
-- and renewal date. Nobody may write one.
drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription"
  on public.subscriptions for select to authenticated
  using (user_id = auth.uid());

grant select on public.subscriptions to authenticated;

comment on table public.billing_events is
  'Every Razorpay webhook we have accepted, keyed by their event id. Exists '
  'so a redelivered webhook is recognised and ignored rather than granting a '
  'second month.';
