-- ============================================================
-- Talking the report through.
--
-- A report tells somebody what was weak. The question they actually have next
-- is "yes, but how do I say it", and that is a conversation. This is where it
-- lives.
--
-- Deliberately its own table rather than the agent's conversation history.
-- Three reasons: it is scoped to one interview and should die with it; it is
-- text only, with no voice path to account for; and the report needs to show
-- what came out of it, which means something has to own that summary.
--
-- --------------------------------------------------------------- the summary
--
-- `coach_summary` is on the feedback row, not in here, because it belongs to
-- the report rather than to the chat. It is rewritten on every exchange by
-- the same model call that produces the reply — one call, two outputs — so it
-- is never stale and never costs a second round trip.
--
-- The full transcript stays in this table so the conversation can be picked
-- up days later; the report only ever shows the summary. Nobody comes back to
-- a report to re-read forty messages.
--
-- Run after 80_interviews.sql. Safe to re-run.
-- ============================================================

create table if not exists public.interview_coach_messages (
  id         bigint generated always as identity primary key,
  session_id uuid not null references public.interview_sessions on delete cascade,

  role       text not null,
  text       text not null,

  created_at timestamptz not null default now(),

  constraint interview_coach_role_ck check (role in ('user', 'model'))
);

create index if not exists interview_coach_thread_idx
  on public.interview_coach_messages (session_id, id);

alter table public.interview_feedback
  add column if not exists coach_summary text;

alter table public.interview_feedback
  add column if not exists coach_updated_at timestamptz;

comment on column public.interview_feedback.coach_summary is
  'What came out of talking the report through, in a few lines. Rewritten on '
  'every exchange. The transcript itself lives in interview_coach_messages.';

-- ------------------------------------------------------------------ access
--
-- Read your own thread; write nothing. The server is the only writer, because
-- a client that could insert a row with role = 'model' could put words in the
-- coach's mouth and then have them summarised onto their own report.

alter table public.interview_coach_messages enable row level security;

drop policy if exists "read own coach messages" on public.interview_coach_messages;
create policy "read own coach messages"
  on public.interview_coach_messages for select
  to authenticated using (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );
