-- ============================================================
-- The agent's memory, and the meter on its voice.
--
-- Two jobs, one file:
--
--   1. Conversations survive the tab. Everything said to the agent — typed
--      or spoken — is written here, so the Agent page can show what was
--      said last week, and so a session that drops can be picked back up.
--
--   2. Live voice is metered. It costs real money per minute, and the
--      browser cannot be trusted to report how long it talked. Minutes are
--      counted server-side against a daily allowance, and the count is
--      written by a security-definer function rather than by the client.
--
-- Same rules as 20_app_accounts.sql: deny by default, auth.uid() is the
-- only identity, and anything that costs money is written server-side only.
--
-- Run after 20_app_accounts.sql. Safe to re-run.
-- ============================================================


-- ----------------------------------------------------------- conversations

create table if not exists public.agent_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,

  -- Written by the model after the first exchange, so the history list reads
  -- as "Switching to backend roles" rather than as a row of timestamps.
  title      text,

  -- How it started. A conversation can begin as voice and continue as text,
  -- so this is the opening mode, not a constraint on what follows.
  channel    text not null default 'text',

  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  updated_at timestamptz not null default now(),

  constraint agent_conversations_channel_ck check (channel in ('text', 'voice'))
);

create index if not exists agent_conversations_user_idx
  on public.agent_conversations (user_id, updated_at desc);


-- --------------------------------------------------------------- messages

create table if not exists public.agent_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,

  role    text not null,
  content text not null,

  -- Spoken turns are stored as their transcript. Keeping the distinction
  -- means the history can show what was said aloud versus typed, and means
  -- a transcription that came back wrong is identifiable later.
  spoken  boolean not null default false,

  -- What the agent did, not just what it said: the jobs it pulled up, the
  -- filter it applied. Rendered as cards under the message.
  actions jsonb,

  created_at timestamptz not null default now(),

  constraint agent_messages_role_ck check (role in ('user', 'model'))
);

create index if not exists agent_messages_conversation_idx
  on public.agent_messages (conversation_id, created_at);


-- ---------------------------------------------------------- voice minutes
--
-- One row per user per day. Deliberately not a log of sessions: the only
-- question that ever needs answering is "how much has this person used
-- today", and a daily counter answers it in one indexed read.

create table if not exists public.agent_voice_usage (
  user_id uuid not null references auth.users on delete cascade,
  day     date not null default (now() at time zone 'Asia/Kolkata')::date,
  seconds integer not null default 0,

  primary key (user_id, day)
);


-- ------------------------------------------------------------------- rls

alter table public.agent_conversations enable row level security;
alter table public.agent_messages      enable row level security;
alter table public.agent_voice_usage   enable row level security;

-- Read your own. Nothing here is ever readable by anyone else, including
-- for support: a conversation about someone's salary and their reasons for
-- leaving a job is not a thing to leave open "just in case".
drop policy if exists agent_conversations_read on public.agent_conversations;
create policy agent_conversations_read on public.agent_conversations
  for select using (auth.uid() = user_id);

drop policy if exists agent_messages_read on public.agent_messages;
create policy agent_messages_read on public.agent_messages
  for select using (auth.uid() = user_id);

drop policy if exists agent_voice_usage_read on public.agent_voice_usage;
create policy agent_voice_usage_read on public.agent_voice_usage
  for select using (auth.uid() = user_id);

-- Deleting your own history is the one write a client may do. There is no
-- insert or update policy anywhere in this file — messages are written by
-- the server with the secret key, because a browser that can write its own
-- transcript can also write a transcript that never happened.
drop policy if exists agent_conversations_delete on public.agent_conversations;
create policy agent_conversations_delete on public.agent_conversations
  for delete using (auth.uid() = user_id);

-- RLS is one gate; the grant is the other. Both have to be open.
grant select, delete on public.agent_conversations to authenticated;
grant select          on public.agent_messages      to authenticated;
grant select          on public.agent_voice_usage   to authenticated;


-- ------------------------------------------------------------- the meter

-- Seconds allowed per person per day. A number in one place rather than
-- scattered through the code, so changing the allowance is one line.
create or replace function public.agent_voice_daily_limit()
returns integer language sql immutable as $$ select 600 $$;   -- 10 minutes

/**
 * How much voice this person has left today, in seconds.
 *
 * Security definer so it can read the counter regardless of policy, and so
 * the answer comes from the database rather than from anything the browser
 * said about itself.
 */
create or replace function public.agent_voice_remaining(p_user uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select greatest(
    0,
    public.agent_voice_daily_limit() - coalesce(
      (select seconds
         from public.agent_voice_usage
        where user_id = p_user
          and day = (now() at time zone 'Asia/Kolkata')::date),
      0)
  )
$$;

/**
 * Add to today's total and return what is left.
 *
 * Called when a live session ends or checkpoints. Takes the seconds actually
 * streamed, which only the server knows.
 */
create or replace function public.agent_voice_spend(p_user uuid, p_seconds integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer;
begin
  if p_seconds is null or p_seconds <= 0 then
    return public.agent_voice_remaining(p_user);
  end if;

  insert into public.agent_voice_usage (user_id, day, seconds)
  values (p_user, (now() at time zone 'Asia/Kolkata')::date, p_seconds)
  on conflict (user_id, day)
  do update set seconds = public.agent_voice_usage.seconds + excluded.seconds;

  select public.agent_voice_remaining(p_user) into remaining;
  return remaining;
end;
$$;

revoke all on function public.agent_voice_spend(uuid, integer) from public, anon, authenticated;
grant execute on function public.agent_voice_remaining(uuid) to authenticated;


-- ------------------------------------------------------------ updated_at

create or replace function public.touch_agent_conversation()
returns trigger language plpgsql as $$
begin
  update public.agent_conversations
     set updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists agent_messages_touch on public.agent_messages;
create trigger agent_messages_touch
  after insert on public.agent_messages
  for each row execute function public.touch_agent_conversation();
