-- ============================================================
-- What every model call cost, and who it was for.
--
-- The app already meters: agent_voice_usage counts seconds and messages, and
-- agent_allowance() turns those into an entitlement. That answers "may this
-- person do another one". It has never answered "what did that cost", which is
-- a different question and the only one that says whether the product works as
-- a business.
--
-- One row per model call. Written by the server with the service key, never by
-- the browser — see lib/app/ai-usage.ts for why that is deliberate.
--
-- Cost is priced at write time and never recomputed. Rates change; what a call
-- cost on the day it was made does not, and a figure that drifts every time
-- the rate table is edited is a figure nobody can reconcile against an invoice.
--
-- Run after 20_app_accounts.sql. Safe to re-run.
-- ============================================================


create table if not exists public.ai_usage (
  id         uuid primary key default gen_random_uuid(),

  -- Null is legitimate: a scheduled job or an unauthenticated path can still
  -- spend money, and losing that row would understate the bill. `set null` on
  -- delete rather than cascade — a person leaving does not unspend what they
  -- spent, and the totals must survive them.
  user_id    uuid references auth.users on delete set null,

  -- The conversation, or the live session. Not a foreign key: sessions outlive
  -- and predate rows in other tables, and a cascade here could delete
  -- accounting as a side effect of tidying a conversation.
  session_id uuid,

  -- What the money was spent on, in product terms rather than endpoint terms.
  -- voice_conversation | agent_chat | resume_extraction | document_read
  -- ats_analysis | resume_generation | resume_rewrite
  feature    text not null,

  provider   text not null,
  model      text not null,

  -- Nullable throughout, and that is the point: a provider that sends no usage
  -- block leaves these null rather than zero. "We do not know" and "it used
  -- nothing" are different facts, and only one of them is ever true.
  input_tokens        integer,
  output_tokens       integer,

  -- Realtime bills audio separately and around eight times higher than text,
  -- so folding it into the text columns would understate a call badly.
  audio_input_tokens  integer,
  audio_output_tokens integer,

  -- For the live session, which bills through a connection the server never
  -- sees. There is no response body to read a usage block out of, so duration
  -- is what we have.
  duration_seconds    integer,

  -- Null when the model has no rate yet. Never zero: none of these calls are
  -- free, and a zero here would read as a claim that one was.
  cost_usd   numeric(12,6),

  created_at timestamptz not null default now()
);


-- The three questions this table exists to answer, in the order they get
-- asked: what did today cost, what does this person cost, what does this
-- feature cost.
create index if not exists ai_usage_created_idx
  on public.ai_usage (created_at desc);

create index if not exists ai_usage_user_idx
  on public.ai_usage (user_id, created_at desc);

create index if not exists ai_usage_feature_idx
  on public.ai_usage (feature, created_at desc);


-- ------------------------------------------------------------------- access

alter table public.ai_usage enable row level security;

-- Read only, and only your own. There is deliberately no insert, update or
-- delete policy for `authenticated`: rows are written by the service key, and
-- a spend record somebody can edit is not a spend record.
grant select on public.ai_usage to authenticated;

drop policy if exists "read own usage" on public.ai_usage;
create policy "read own usage" on public.ai_usage
  for select to authenticated using (auth.uid() = user_id);


-- ---------------------------------------------------------------- questions

-- Kept as comments rather than views. A view would have to be migrated every
-- time the question changes, and these change constantly at this stage.
--
--   -- what did today cost
--   select round(sum(cost_usd), 4) as usd, count(*) as calls
--     from public.ai_usage
--    where created_at >= date_trunc('day', now() at time zone 'Asia/Kolkata');
--
--   -- where the money goes
--   select feature, model,
--          count(*) as calls,
--          round(sum(cost_usd), 4) as usd
--     from public.ai_usage
--    where created_at > now() - interval '30 days'
--    group by feature, model
--    order by usd desc nulls last;
--
--   -- cost per person, worst first
--   select user_id,
--          count(*) as calls,
--          round(sum(cost_usd), 4) as usd
--     from public.ai_usage
--    where created_at > now() - interval '30 days'
--    group by user_id
--    order by usd desc nulls last
--    limit 20;
--
--   -- anything unpriced, which means RATES needs a row
--   select model, count(*)
--     from public.ai_usage
--    where cost_usd is null and input_tokens is not null
--    group by model;


-- ------------------------------------------------------------ verification

-- Should print one row, with rls on and one policy.
select c.relname,
       c.relrowsecurity as rls,
       count(p.polname) as policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policy p on p.polrelid = c.oid
 where n.nspname = 'public'
   and c.relname = 'ai_usage'
 group by c.relname, c.relrowsecurity;
