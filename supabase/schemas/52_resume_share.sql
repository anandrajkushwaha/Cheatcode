-- ============================================================
-- A resume somebody can send to a person.
--
-- Run after 51_resume_template.sql. Safe to re-run.
--
-- Two columns rather than one. `share_id` is the address and survives being
-- switched off — turning sharing off and on again gives back the same link,
-- so a URL already sent in an email does not silently become a different
-- resume. `is_public` is the switch, and it is what the public route checks.
--
-- The id is random and long rather than sequential: the whole security model
-- of an unlisted link is that it cannot be guessed, and /r/1, /r/2 can be.
-- Unique because two resumes answering the same URL is a data leak, not a
-- collision.
-- ============================================================

alter table public.resume_drafts
  add column if not exists share_id text,
  add column if not exists is_public boolean not null default false;

create unique index if not exists resume_drafts_share_id_idx
  on public.resume_drafts (share_id) where share_id is not null;

comment on column public.resume_drafts.share_id is
  'Unguessable public address for /r/<id>. Kept when sharing is switched off '
  'so an already-sent link keeps working if it is switched back on.';

comment on column public.resume_drafts.is_public is
  'Whether /r/<share_id> serves this resume. Read by the public route with '
  'the service key, so it is the only thing standing between a draft and the '
  'open internet — never default it to true.';
