-- ============================================================
-- Which template a draft is painted in.
--
-- Run after 50_resume_drafts.sql. Safe to re-run.
--
-- A column rather than a key inside `content`, and the reason is worth
-- writing down: `content` is the document — the words that get rendered,
-- scored, and read back by the agent. `cleanResume()` is the one gate into
-- it and it drops anything it does not recognise, which is exactly the
-- behaviour you want for a tree the model writes into. A presentation choice
-- living in there would either have to punch a hole in that gate or be
-- silently discarded on the next save.
--
-- Text rather than an enum, and validated in TypeScript instead. Adding a
-- template should be one row in lib/app/resume-templates.ts, not a row plus a
-- migration plus a deploy in the right order. The cost is that an unknown
-- value can be stored; `templateById()` falls back to the default for
-- anything it does not recognise, so the failure is a familiar-looking resume
-- rather than a broken page.
-- ============================================================

alter table public.resume_drafts
  add column if not exists template text not null default 'classic';

comment on column public.resume_drafts.template is
  'Theme id from lib/app/resume-templates.ts. Presentation only: every '
  'template renders the same sections in the same order, so this never '
  'changes what the ATS score describes. Unknown values fall back to classic.';
