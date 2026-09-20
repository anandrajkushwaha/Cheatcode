-- ============================================================
-- Answering a question again, and what the interview says about the resume.
--
-- Two small additions that turn a report you read into a thing you use.
--
-- `attempts` counts how many times an answer was given. The answer column
-- still holds the latest one rather than a history: the point of a retry is
-- that the new answer replaces the old, and keeping three versions of a
-- practice answer nobody will re-read is storage with no reader.
--
-- `resume_actions` is what the interview learned about their resume. It is
-- the thing that stops the paid plan feeling like three separate tools — the
-- mock interview finds the gap, the resume builder fixes it.
--
-- Run after 80_interviews.sql. Safe to re-run.
-- ============================================================

alter table public.interview_answers
  add column if not exists attempts int not null default 1;

comment on column public.interview_answers.attempts is
  'How many times this question was answered. The answer column holds the '
  'latest attempt, not a history.';

alter table public.interview_feedback
  add column if not exists resume_actions jsonb not null default '[]'::jsonb;

comment on column public.interview_feedback.resume_actions is
  'What this interview suggests changing on their resume: a list of '
  '{title, detail}. Derived from the answers, not from the resume alone.';
