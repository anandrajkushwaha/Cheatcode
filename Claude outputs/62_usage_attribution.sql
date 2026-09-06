-- ============================================================
-- Making every spent rupee traceable to a person and a thing.
--
-- Run after 61_admin_tracking.sql. Safe to re-run.
--
-- An audit of the admin dashboard against a seeded database found that about
-- a third of recorded spend could not be shown next to any conversation, and
-- that the session count itself was wrong. Three separate causes, two of
-- which are fixed in application code and one of which needs this file:
--
--   1. The first message of every conversation was billed before the
--      conversation row existed, so it carried no session id. (Code.)
--
--   2. Reading an uploaded document passed no session id at all. (Code.)
--
--   3. Résumé parsing passed the *résumé* id into `session_id`. That column
--      means "which conversation", so a résumé id in it is not merely useless
--      — it was counted as a distinct session and inflated the headline
--      "agent sessions" number. There was nowhere correct to put it, which is
--      what this migration adds.
--
-- Nothing here backfills a value that was never true. Rows written before
-- today keep their nulls, because inventing an attribution is worse than
-- admitting the row is unattributed — the dashboard now says which is which.
-- ============================================================


-- ------------------------------------------------ which résumé the spend was for
--
-- Separate from session_id on purpose. A conversation and a résumé are
-- different things, and one column cannot hold both without the reader having
-- to guess which kind of id it is looking at — which is exactly the bug.
--
-- No foreign key, for the same reason session_id has none: accounting must
-- outlive the thing it describes. Deleting a résumé must not delete the record
-- of what it cost to produce.

alter table public.ai_usage
  add column if not exists resume_id uuid;

comment on column public.ai_usage.resume_id is
  'Which résumé this spend was for, when it was not part of a conversation. '
  'Deliberately not a foreign key and deliberately not session_id — a résumé '
  'id written into session_id was counted as a conversation and inflated the '
  'session total.';


-- --------------------------------------------------------------- the indexes
--
-- The dashboard reads a window of rows and groups them in memory, so these are
-- for the queries that filter rather than for the grouping. `session_id` was
-- missing entirely, which was survivable at today's volumes and would not have
-- stayed that way.

create index if not exists ai_usage_session_idx
  on public.ai_usage (session_id)
  where session_id is not null;

create index if not exists ai_usage_resume_idx
  on public.ai_usage (resume_id)
  where resume_id is not null;

-- The user listing sorts by recency within a window, which is this pair.
create index if not exists ai_usage_user_created_idx
  on public.ai_usage (user_id, created_at desc);


-- --------------------------------------------------- everybody has a profile
--
-- The admin screen shows an email by joining `profiles`, because `auth.users`
-- is not in the exposed schema and never should be. A trigger has created a
-- profile for every new signup since 20_app_accounts.sql ran — but anybody who
-- signed up *before* it has no row, and shows on the dashboard as a bare uuid
-- with no name against it.
--
-- This fills those in from auth.users. It touches nothing that already exists:
-- `on conflict do nothing` means a profile somebody has edited is never
-- overwritten by whatever the auth record happens to say.

insert into public.profiles (id, email, full_name)
select
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name'
  )
from auth.users u
on conflict (id) do nothing;

-- An email that arrived after the profile did — a phone-first signup that
-- later linked an address — leaves the column null. Fill only those.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null
  and u.email is not null;
