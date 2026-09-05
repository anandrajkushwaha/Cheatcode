-- ============================================================
-- The three things the admin dashboard needs and nobody was writing down.
--
-- Run after 60_ai_usage.sql. Safe to re-run.
--
-- `ai_usage` already answers what a model call cost, for whom, on what
-- feature. What it cannot answer is what happened *after* the call: did the
-- résumé that came out of the conversation ever get shared, and did anybody
-- download it. Those are the questions that separate "the agent ran" from
-- "the agent worked", and neither was recorded anywhere.
--
-- Nothing here backfills. Every column starts empty for rows that already
-- exist, because inventing a download that may not have happened would make
-- the dashboard worse than having no column at all.
-- ============================================================


-- ------------------------------------------------- did anybody download it

alter table public.resume_drafts
  add column if not exists download_count integer not null default 0,
  add column if not exists last_downloaded_at timestamptz;

comment on column public.resume_drafts.download_count is
  'How many times the PDF has been built for this résumé. Written server-side '
  'by the pdf route only — the browser never reports its own downloads, '
  'because a number a client can inflate is not a number.';


-- ------------------------------------------- which conversation made this
--
-- The link the dashboard needs to put a résumé next to the session that
-- produced it. Set the first time an agent tool writes to a draft during a
-- conversation, and never overwritten: a résumé is created once, and later
-- conversations editing it do not make them its author.
--
-- `set null` on delete, not cascade. Deleting a conversation must not delete
-- somebody's résumé; it only makes the résumé unattributed.

alter table public.resume_drafts
  add column if not exists agent_conversation_id uuid
    references public.agent_conversations on delete set null;

create index if not exists resume_drafts_conversation_idx
  on public.resume_drafts (agent_conversation_id)
  where agent_conversation_id is not null;


-- ----------------------------------------------------------------- flags
--
-- Configuration that can change without a deploy.
--
-- Deliberately not a key-value store of strings: `value` is jsonb because the
-- interesting flags carry a shape — which provider and model a feature uses —
-- and a second table per shape is how a settings screen becomes a migration
-- every time somebody adds a checkbox.
--
-- `enabled` is separate from `value` on purpose. Turning a feature off and
-- changing which model it uses are different acts, and folding them into one
-- column means switching a feature back on restores whatever model it had
-- before rather than the one you meant.

create table if not exists public.feature_flags (
  key        text primary key,
  enabled    boolean not null default true,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  -- Free text, written by the admin screen. Who changed it and why, for the
  -- morning somebody asks why the agent is suddenly on a different model.
  note       text
);

alter table public.feature_flags enable row level security;

-- No policies and no grants, deliberately. Every read and write goes through
-- the service key from server code that has already checked the admin cookie.
-- A flag that the browser could read would leak the shape of the product; one
-- it could write would be a remote configuration hole.

comment on table public.feature_flags is
  'Runtime configuration for the admin Settings screen. Read server-side with '
  'a short in-process cache — see lib/app/flags.ts — so a change takes effect '
  'within about half a minute without a deploy.';
