-- ============================================================
-- The design: pages of objects, which is now what a resume is.
--
-- Run after 54_resume_access.sql. Safe to re-run.
--
-- `content` is deliberately left exactly where it is. It stops being the
-- master copy the moment a design exists — the elements are the document, and
-- nothing re-derives them from the fields — but it is what a new design is
-- seeded from, and it is what an ATS check will read when that is built as its
-- own feature. Dropping it would make both of those impossible to get back.
--
-- Null means "not converted yet". A draft written before this migration opens
-- in the editor, gets a design seeded from its content and template on first
-- load, and is saved with one from then on. That is why there is no default
-- here: '{}' would be indistinguishable from a design somebody had emptied on
-- purpose, and the seeder would refill a page they had just cleared.
-- ============================================================

alter table public.resume_drafts
  add column if not exists design jsonb;

comment on column public.resume_drafts.design is
  'Pages of positioned elements — the document itself. Null on rows written '
  'before the canvas editor; seeded from content + template on first open. '
  'Shape and limits are enforced by cleanDesign() in lib/app/design.ts, never '
  'by this column.';
