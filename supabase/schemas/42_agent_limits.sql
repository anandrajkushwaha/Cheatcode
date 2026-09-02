-- ============================================================
-- What the agent is allowed to spend, per person.
--
-- Replaces the voice-only meter in 40_agent.sql with one that counts
-- messages too, because both cost money and only one of them was capped.
--
-- The numbers live in agent_limits() and nowhere else. They come from the
-- price: at ₹299/month an AI budget of roughly ₹90 per subscriber is 30% of
-- revenue, and the caps below are what fits inside that once you accept that
-- most subscribers are not active in a given month. The daily cap stops one
-- bad day; the monthly cap stops one bad month. Without both, a single user
-- talking ten minutes every day costs more than they pay.
--
-- Free is a demonstration, not a product: enough typing to see whether the
-- thing is any good, and one taste of voice that does not renew. A daily free
-- voice allowance reads as generous and is not — at ~₹1 a minute it is ₹60 a
-- month for every free account that uses it, forever, with no path to
-- revenue.
--
-- Run after 40_agent.sql. Safe to re-run.
-- ============================================================


-- ------------------------------------------------------------- the numbers

/**
 * Every limit in the product, in one place.
 *
 * Returns seconds and counts, not minutes, so nothing downstream has to
 * remember which unit it is holding.
 */
create or replace function public.agent_limits()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    -- Free. Ten messages is two or three real questions with follow-ups —
    -- enough to judge it. The trial is once, ever, not once a day.
    'free_messages_day',   10,
    'free_trial_seconds',  180,

    -- Pro at ₹299.
    --
    -- The daily cap is 30 minutes so a real session is never cut short
    -- mid-thought; the monthly cap is what actually bounds the bill. With
    -- both, somebody can have four heavy days or twelve ordinary ones.
    --
    -- A warning attached to the monthly number, because it was written when
    -- voice ran on Gemini Live at roughly ₹2/min, where 120 minutes is about
    -- 80% of the subscription. On OpenAI's realtime audio it is several times
    -- that, and this cap is then the only thing standing between a ₹299 plan
    -- and a four-figure bill. Whichever provider voice ends up on, check this
    -- number against the real per-minute cost in ai_usage before raising it.
    'pro_messages_day',    200,
    'pro_voice_day',       1800,
    'pro_voice_month',     7200
  )
$$;


-- ---------------------------------------------------------------- counters

-- Daily, per user. Voice seconds were already here; messages are new.
alter table public.agent_voice_usage
  add column if not exists messages integer not null default 0;

-- Renaming would break 40_agent.sql for anybody who has not re-run it, and
-- a view costs nothing.
create or replace view public.agent_usage as
  select user_id, day, seconds as voice_seconds, messages
    from public.agent_voice_usage;

/**
 * The free voice trial, which is spent once and never resets.
 *
 * Its own table rather than a column on profiles: profiles is written by the
 * payment webhook and read on every page, and a counter that changes mid
 * conversation does not belong in it.
 */
create table if not exists public.agent_trial (
  user_id       uuid primary key references auth.users on delete cascade,
  voice_seconds integer not null default 0,
  first_used_at timestamptz not null default now()
);

alter table public.agent_trial enable row level security;

drop policy if exists agent_trial_read on public.agent_trial;
create policy agent_trial_read on public.agent_trial
  for select using (auth.uid() = user_id);

grant select on public.agent_trial to authenticated;
grant select on public.agent_usage to authenticated;


-- --------------------------------------------------------------- the gate

/**
 * What this person may do right now.
 *
 * One round trip, everything the server needs to decide. Security definer so
 * the answer comes from the database rather than from anything the browser
 * claimed about itself, and so it can read counters the browser's role
 * cannot.
 *
 * Returns seconds and counts remaining, never booleans — the caller needs to
 * be able to say "4 minutes left", not just yes or no.
 */
create or replace function public.agent_allowance(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  lim        jsonb := public.agent_limits();
  paid       boolean := public.has_active_plan(p_user);
  today      date := (now() at time zone 'Asia/Kolkata')::date;
  -- Plain integers rather than a record. `select into` on a row that does not
  -- exist leaves a record with no fields at all, so the first reference to
  -- msgs_today raised "record has no field" for every account that had
  -- not used the agent yet — which is every new account.
  voice_today   integer := 0;
  msgs_today    integer := 0;
  used_month integer;
  trial_used integer;
begin
  select coalesce(seconds, 0), coalesce(messages, 0)
    into voice_today, msgs_today
    from public.agent_voice_usage
   where user_id = p_user and day = today;

  voice_today := coalesce(voice_today, 0);
  msgs_today  := coalesce(msgs_today, 0);

  select coalesce(sum(seconds), 0) into used_month
    from public.agent_voice_usage
   where user_id = p_user
     and day >= date_trunc('month', today)::date;

  select coalesce(voice_seconds, 0) into trial_used
    from public.agent_trial where user_id = p_user;
  trial_used := coalesce(trial_used, 0);

  if paid then
    return jsonb_build_object(
      'paid', true,
      'messages_left', greatest(0, (lim->>'pro_messages_day')::int - msgs_today),
      'voice_left', least(
        greatest(0, (lim->>'pro_voice_day')::int   - voice_today),
        greatest(0, (lim->>'pro_voice_month')::int - used_month)
      ),
      -- Both halves, separately, because the screen has to say *which* wall
      -- somebody hit. "It resets at midnight" is a lie when the monthly cap is
      -- the one that bound, and a paying customer who comes back tomorrow to
      -- the same refusal, having been told it would be gone, has been misled
      -- by us rather than limited by us.
      'voice_day_left',   greatest(0, (lim->>'pro_voice_day')::int   - voice_today),
      'voice_month_left', greatest(0, (lim->>'pro_voice_month')::int - used_month),
      'voice_is_trial', false
    );
  end if;

  return jsonb_build_object(
    'paid', false,
    'messages_left', greatest(0, (lim->>'free_messages_day')::int - msgs_today),
    -- The trial is the only voice a free account gets, and it is a lifetime
    -- number, so the day and month counters do not enter into it.
    'voice_left', greatest(0, (lim->>'free_trial_seconds')::int - trial_used),
    'voice_is_trial', true
  );
end;
$$;

/**
 * Record what was used, and return what is left.
 *
 * Called after the fact — a message that failed upstream is not charged, and
 * voice is billed on the seconds the socket was actually open. Free accounts
 * spend voice out of the trial rather than the daily counter, which is what
 * makes the trial never come back.
 */
create or replace function public.agent_spend(
  p_user     uuid,
  p_messages integer default 0,
  p_seconds  integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  paid  boolean := public.has_active_plan(p_user);
begin
  if coalesce(p_messages, 0) > 0 or (coalesce(p_seconds, 0) > 0 and paid) then
    insert into public.agent_voice_usage (user_id, day, seconds, messages)
    values (p_user, today, greatest(coalesce(p_seconds, 0), 0) * paid::int,
                           greatest(coalesce(p_messages, 0), 0))
    on conflict (user_id, day) do update
      set seconds  = public.agent_voice_usage.seconds  + excluded.seconds,
          messages = public.agent_voice_usage.messages + excluded.messages;
  end if;

  if coalesce(p_seconds, 0) > 0 and not paid then
    insert into public.agent_trial (user_id, voice_seconds)
    values (p_user, greatest(p_seconds, 0))
    on conflict (user_id) do update
      set voice_seconds = public.agent_trial.voice_seconds + excluded.voice_seconds;
  end if;

  return public.agent_allowance(p_user);
end;
$$;

-- Readable by the browser so a page can render "6 messages left" without a
-- round trip through our own API. Spending stays server-side only: a client
-- that can write its own counter has no limit at all.
grant execute on function public.agent_limits() to authenticated;
grant execute on function public.agent_allowance(uuid) to authenticated;
revoke all on function public.agent_spend(uuid, integer, integer) from public, anon, authenticated;

-- Superseded by agent_allowance, which answers the same question and more.
drop function if exists public.agent_voice_remaining(uuid);
drop function if exists public.agent_voice_spend(uuid, integer);
drop function if exists public.agent_voice_daily_limit();
