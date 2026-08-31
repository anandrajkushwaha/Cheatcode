-- ============================================================
-- Accounts, resumes and subscriptions for the logged-in product.
--
-- This is the first schema in Cheatcode that stores personal data about
-- other people rather than analytics about page views, so the rules are
-- different and worth stating plainly:
--
--   * Every table here is deny-by-default. A row is readable only by the
--     account that owns it. There is no "read all" policy anywhere, not
--     even for convenience, because a resume carries a phone number, a
--     home address and an employment history.
--
--   * auth.uid() is the only identity. Nothing trusts a user_id sent from
--     the browser — the policies read the session, so a forged request
--     cannot reach another person's row.
--
--   * Subscription state lives on the server side of the fence. A client
--     can read its own plan but can never write it; only the payment
--     webhook, holding the secret key, may change it. Otherwise anyone
--     could grant themselves a paid plan from the browser console.
--
-- Run in the Supabase project that owns your app users. Safe to re-run.
-- ============================================================


-- ---------------------------------------------------------------- profiles

create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  full_name    text,
  email        text,
  phone        text,
  avatar_url   text,

  -- What the person is looking for. The agent fills most of this in
  -- conversation; the forms are a fallback for people who would rather type.
  headline           text,
  current_title      text,
  current_company    text,
  years_experience   numeric(4,1),
  current_ctc        integer,          -- rupees per year
  expected_ctc       integer,
  notice_period_days integer,
  preferred_cities   text[] not null default '{}',
  open_to_remote     boolean not null default true,
  target_roles       text[] not null default '{}',

  -- Subscription. Written by the payment webhook only — see the policies.
  plan            text not null default 'free',
  plan_status     text not null default 'inactive',
  plan_expires_at timestamptz,
  razorpay_customer_id     text,
  razorpay_subscription_id text,

  onboarded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint profiles_plan_ck   check (plan in ('free', 'pro')),
  constraint profiles_status_ck check (plan_status in ('inactive', 'active', 'past_due', 'cancelled'))
);

comment on column public.profiles.plan is
  'free or pro. Never written from the browser — the Razorpay webhook owns this column.';


-- ---------------------------------------------------------------- resumes

create table if not exists public.resumes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,

  file_name  text,
  file_type  text,
  -- The extracted plain text. Kept because re-parsing is free and re-uploading
  -- is not: when the parser improves, every stored resume can be re-read
  -- without asking anyone to find their file again.
  raw_text   text,

  -- What the ATS engine already computes today.
  ats_score  integer,
  ats_result jsonb,

  -- What the language model pulled out, validated before it lands here.
  parsed          jsonb,
  parse_model     text,
  parsed_at       timestamptz,
  parse_error     text,

  -- Denormalised out of `parsed` so job matching can use an index instead of
  -- unpacking JSON for every candidate on every query.
  skills           text[] not null default '{}',
  years_experience numeric(4,1),
  latest_title     text,
  latest_company   text,

  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resumes_user_idx    on public.resumes (user_id, created_at desc);
create index if not exists resumes_skills_idx  on public.resumes using gin (skills);

-- One primary resume per person. A partial unique index rather than a trigger:
-- the database enforces it, so no code path can produce two.
create unique index if not exists resumes_one_primary_idx
  on public.resumes (user_id) where is_primary;


-- ---------------------------------------------------------------- events

-- An append-only record of what happened in an account. Useful for support
-- ("what did this person actually do?") and for the agent to have memory of
-- past sessions without re-reading every table.
create table if not exists public.account_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users on delete cascade,
  kind       text not null,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists account_events_user_idx
  on public.account_events (user_id, created_at desc);


-- ============================================================
-- Row level security.
--
-- Enabled on every table, with policies that name auth.uid() explicitly.
-- Note what is missing on purpose: no update policy for the plan columns,
-- and no policy at all for anon.
-- ============================================================

alter table public.profiles       enable row level security;
alter table public.resumes        enable row level security;
alter table public.account_events enable row level security;

/*
 * Grants and policies are two separate gates and both have to be open.
 *
 * A policy can only filter rows within a privilege the role already holds —
 * with no GRANT, every query fails with "permission denied for table" before
 * any policy is consulted. Supabase's default privileges usually hand these
 * out for new tables in public, but "usually" is not a security model and it
 * differs between projects, so they are stated here.
 *
 * anon gets nothing at all. A signed-out visitor has no business reading a
 * single row in this file, and the safest way to guarantee that is to never
 * grant the privilege in the first place.
 */
revoke all on public.profiles, public.resumes, public.account_events from anon;

grant select, insert, update          on public.profiles       to authenticated;
grant select, insert, update, delete  on public.resumes        to authenticated;
grant select                          on public.account_events to authenticated;

-- No delete on profiles: an account is removed through auth.users, which
-- cascades. Letting the client delete the profile row directly would leave an
-- auth user with no profile and every page erroring on a missing row.

-- ---------- profiles ----------
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists "create own profile" on public.profiles;
create policy "create own profile" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

/*
 * Update is allowed on the person's own row, but the plan columns are frozen
 * by the WITH CHECK below: the new values have to equal the old ones. Postgres
 * evaluates WITH CHECK against the row as it would be after the update, so
 * comparing against a subquery of the current row is what makes this work.
 *
 * The webhook bypasses all of this with the secret key, which is the point.
 */
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and plan        = (select p.plan        from public.profiles p where p.id = auth.uid())
    and plan_status = (select p.plan_status from public.profiles p where p.id = auth.uid())
    and coalesce(plan_expires_at, 'epoch'::timestamptz)
        = coalesce((select p.plan_expires_at from public.profiles p where p.id = auth.uid()), 'epoch'::timestamptz)
  );

-- ---------- resumes ----------
drop policy if exists "read own resumes" on public.resumes;
create policy "read own resumes" on public.resumes
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "insert own resumes" on public.resumes;
create policy "insert own resumes" on public.resumes
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update own resumes" on public.resumes;
create policy "update own resumes" on public.resumes
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own resumes" on public.resumes;
create policy "delete own resumes" on public.resumes
  for delete to authenticated using (auth.uid() = user_id);

-- ---------- account events ----------
-- Readable by the owner, written only by the server. A client that could write
-- its own history could also forge it.
drop policy if exists "read own events" on public.account_events;
create policy "read own events" on public.account_events
  for select to authenticated using (auth.uid() = user_id);


-- ============================================================
-- A profile row for every new sign-up.
--
-- Done as a trigger rather than in application code because there are three
-- ways in (Google, phone, and whatever comes later) and a missing profile row
-- breaks every page. One place, no exceptions.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.phone,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------- updated_at

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists resumes_touch on public.resumes;
create trigger resumes_touch before update on public.resumes
  for each row execute function public.touch_updated_at();


-- ============================================================
-- Does this account have a live paid plan?
--
-- A function rather than a boolean column, because "paid" is a question about
-- the clock as much as the row: a cancelled plan is still valid until it
-- expires, and an expired one is not paid however the status column reads.
-- ============================================================
create or replace function public.has_active_plan(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = p_user
       and plan = 'pro'
       and plan_status in ('active', 'cancelled')
       and (plan_expires_at is null or plan_expires_at > now())
  );
$$;

grant execute on function public.has_active_plan(uuid) to authenticated;
