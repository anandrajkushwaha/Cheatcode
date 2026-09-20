-- ============================================================
-- Who wrote which article.
--
-- `author_id` already exists and points at public.authors — that is the byline
-- readers see, and it is a different question from the one this answers. Two
-- people can publish under one byline, and the owner needs to know which of
-- them did it.
--
-- So these two columns point at admin_users instead: the account that did the
-- work, not the name on the page.
--
--   created_by      set once, when the article first exists. Never rewritten,
--                   because "who wrote this" does not change when somebody
--                   else fixes a typo in it.
--   last_edited_by  rewritten on every save, which is how a rewrite by
--                   somebody else is visible at all.
--
-- on delete set null, deliberately. Removing somebody from the team must not
-- take their articles down with them.
--
-- Run after 02_content.sql and 85_admin_users.sql. Safe to re-run.
-- ============================================================

alter table public.posts
  add column if not exists created_by uuid references public.admin_users(id) on delete set null;

alter table public.posts
  add column if not exists last_edited_by uuid references public.admin_users(id) on delete set null;

-- The team screen asks "what did this person publish, newest first" on every
-- load, so that is the index.
create index if not exists posts_created_by_idx
  on public.posts (created_by, created_at desc);

comment on column public.posts.created_by is
  'The admin_users account that created this article. Null for the owner and '
  'for anything imported from the content files.';
