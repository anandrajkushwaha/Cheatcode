-- ============================================================
-- Verdicts on role names, cached.
--
-- A blocklist catches what somebody thought of in advance. It cannot catch a
-- misspelling, a transliteration, next year's slang, or a phrase that is only
-- a problem in context — and that gap is the grey area. So every role name is
-- also read by the model before it is accepted.
--
-- That would be a model call on every attempt, which is why this table
-- exists. The answer to "is Graphic Designer a real job" does not depend on
-- who is asking or when, so the first person to type it pays for the check
-- and everybody afterwards gets it free. In practice the cache hits almost
-- always: job titles are a small, repetitive set.
--
-- Rejections are cached too. Somebody hammering the same word should not
-- cost a model call each time.
--
-- Run any time. Safe to re-run.
-- ============================================================

create table if not exists public.role_moderation (
  -- The normalised role: lowercase, letters and single spaces only. Two
  -- people typing "graphic designer" and "Graphic  Designer" share a row.
  slug       text primary key,
  -- What they actually typed, for looking at later.
  sample     text,

  allowed    boolean not null,
  -- 'ok' | 'adult' | 'illegal' | 'hate' | 'not_a_role'. Kept so a bad
  -- verdict can be found and corrected rather than only counted.
  category   text,

  created_at timestamptz not null default now()
);

create index if not exists role_moderation_rejected_idx
  on public.role_moderation (created_at desc) where not allowed;

-- ------------------------------------------------------------------ access
--
-- No policy for anyone. This is read and written by the server only. A client
-- that could insert here could pre-approve any string it liked, which would
-- turn the cache into the way around the check rather than the check.

alter table public.role_moderation enable row level security;

comment on table public.role_moderation is
  'Cached model verdicts on whether a role name is one we will generate '
  'interview questions for. Server-only.';
