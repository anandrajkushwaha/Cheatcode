-- ============================================================
-- Mock interviews.
--
-- Three tables rather than one JSON blob per session, because two of the
-- three get read on their own: the answers while the interview is running,
-- and the feedback long after it finished. A single document would mean
-- rewriting the whole session row on every answer, which is how a half-
-- finished interview ends up losing the answer before it.
--
-- What is NOT here, deliberately: no score out of a hundred. The model can
-- tell you which of five areas was weak and why, and it cannot tell you that
-- you are a 72. A number nobody can defend is worse than a sentence somebody
-- can act on.
--
-- Run after 20_app_accounts.sql. Safe to re-run.
-- ============================================================

create table if not exists public.interview_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,

  -- What this interview is about, in the words shown on screen:
  -- a role ("Graphic Designer"), a skill ("Typography"), or a job title.
  topic        text not null,
  -- 'topic' | 'role' | 'job'. Only changes the wording of the prompt and the
  -- label on the card; the flow is identical.
  kind         text not null default 'topic',
  -- Set when this came from a real posting, so the report can link back to it.
  job_id       uuid references public.jobs on delete set null,
  company      text,

  status       text not null default 'running',

  started_at   timestamptz not null default now(),
  finished_at  timestamptz,

  constraint interview_sessions_kind_ck   check (kind in ('topic', 'role', 'job')),
  constraint interview_sessions_status_ck check (status in ('running', 'done', 'abandoned'))
);

create index if not exists interview_sessions_user_idx
  on public.interview_sessions (user_id, started_at desc);

-- ------------------------------------------------------------- questions
--
-- Written once, when the session opens. Generating them up front rather than
-- one at a time costs a single model call instead of four, and — more to the
-- point — lets the set be written as a set, so the four questions cover four
-- different things instead of asking the same thing four ways.

create table if not exists public.interview_questions (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.interview_sessions on delete cascade,

  position    int  not null,
  question    text not null,
  -- The one thing this question is testing, in a few words. It becomes a row
  -- in the report, which is why it is stored rather than re-derived later.
  skill       text not null,
  -- The model answer. Written at the same time as the question so the
  -- feedback screen needs no second call, and withheld from free accounts by
  -- the API rather than by the query.
  model_answer text,

  unique (session_id, position)
);

-- --------------------------------------------------------------- answers

create table if not exists public.interview_answers (
  id           bigint generated always as identity primary key,
  session_id   uuid not null references public.interview_sessions on delete cascade,
  question_id  bigint not null references public.interview_questions on delete cascade,

  answer       text not null,
  -- 'text' today. 'voice' when the live interviewer lands, at which point
  -- this column is how the report knows whether to talk about delivery.
  channel      text not null default 'text',
  -- How long they took, in seconds. Not scored — shown, because "you answered
  -- that in nine seconds" is a fact somebody can use.
  seconds      int,

  created_at   timestamptz not null default now(),

  unique (question_id),
  constraint interview_answers_channel_ck check (channel in ('text', 'voice'))
);

-- -------------------------------------------------------------- feedback
--
-- One row per session, written once when the interview ends.
--
-- The two jsonb columns hold shapes the application owns rather than columns
-- the database does: `areas` is a list of {skill, rating, note} and `tips` is
-- a list of {position, tip, quote}. They are only ever read whole, by one
-- screen, so giving them columns would buy nothing and cost a migration every
-- time the report changes.

create table if not exists public.interview_feedback (
  session_id  uuid primary key references public.interview_sessions on delete cascade,

  -- A short verdict in words. Never a number.
  verdict     text not null,
  headline    text,

  areas       jsonb not null default '[]'::jsonb,
  tips        jsonb not null default '[]'::jsonb,

  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------ access
--
-- Everything is read by its owner and written only by the server. There is no
-- insert or update policy for `authenticated` on purpose: a client that could
-- write interview_answers could also write interview_feedback, and a report
-- somebody wrote for themselves is not a report.

alter table public.interview_sessions  enable row level security;
alter table public.interview_questions enable row level security;
alter table public.interview_answers   enable row level security;
alter table public.interview_feedback  enable row level security;

drop policy if exists "read own interview sessions" on public.interview_sessions;
create policy "read own interview sessions"
  on public.interview_sessions for select
  to authenticated using (user_id = (select auth.uid()));

drop policy if exists "read own interview questions" on public.interview_questions;
create policy "read own interview questions"
  on public.interview_questions for select
  to authenticated using (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );

drop policy if exists "read own interview answers" on public.interview_answers;
create policy "read own interview answers"
  on public.interview_answers for select
  to authenticated using (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );

drop policy if exists "read own interview feedback" on public.interview_feedback;
create policy "read own interview feedback"
  on public.interview_feedback for select
  to authenticated using (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );

comment on table public.interview_sessions is
  'One mock interview. Questions are generated when it opens; feedback once '
  'it finishes. Written server-side only.';
