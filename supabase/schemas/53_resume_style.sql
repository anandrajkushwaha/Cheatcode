-- ============================================================
-- Per-field styling, and a photograph.
--
-- Run after 52_resume_share.sql. Safe to re-run.
--
-- Both are presentation, and both are deliberately outside `content`.
-- `content` is the document — the words that get rendered, scored, and read
-- back by the agent — and `cleanResume()` is the one gate into it, dropping
-- anything it does not recognise. That is exactly right for a tree a model
-- writes into, and exactly wrong for a colour somebody picked.
--
-- `styles` holds two things: `fields`, keyed by the same path strings the
-- editor uses (`roles.0.title`), and `hidden`, the sections switched off. A
-- blob rather than columns because the keys are unbounded — one per field per
-- resume — and nothing ever queries inside it.
--
-- `photo` is a data URL, compressed in the browser to 200KB before it is ever
-- sent. Storage would be tidier for large files and is the right answer if
-- these ever get big; at 200KB the row stays small, the print path needs no
-- second request, and there is no bucket to get the policies wrong on.
-- ============================================================

alter table public.resume_drafts
  add column if not exists styles jsonb not null default '{}'::jsonb,
  add column if not exists photo text;

comment on column public.resume_drafts.styles is
  'Presentation only: {"fields": {"<path>": {font,size,bold,...}}, "hidden": '
  '["projects"]}. Never read by the scorer — styling cannot change the text a '
  'parser extracts, so it cannot change the score.';

comment on column public.resume_drafts.photo is
  'A data URL, compressed client-side to at most 200KB. Only the templates '
  'that have somewhere to put one will render it.';
