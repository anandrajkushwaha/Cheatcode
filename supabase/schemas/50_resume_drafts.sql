-- ============================================================
-- The resume somebody is working on, as data rather than a file.
--
-- `resumes` holds what they uploaded: the original text, its score, and what
-- the model read out of it. That row is a record of a document that exists
-- somewhere else, and it is deliberately never edited — re-scoring an upload
-- after we changed it would make the score a fiction.
--
-- A draft is the opposite: a structured document *we* own, that a person
-- edits, that the agent proposes changes to, and that renders to a PDF whose
-- every layout property we chose. Same shape as `resumes.parsed`, because a
-- draft starts life as a copy of it — the person's own roles, dates and
-- bullets, already in the boxes. Nobody should meet a blank editor.
--
-- Why this is a table and not browser storage, given that the ATS checker
-- goes to some length never to upload a file: an editor has to survive a
-- phone dying mid-sentence and a laptop opened later, and neither is possible
-- from localStorage. The trade is real and the product should say so where
-- somebody can read it, not only here.
--
-- Run after 20_app_accounts.sql. Safe to re-run.
-- ============================================================


create table if not exists public.resume_drafts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,

  -- What it was copied from, when it was. Null for a draft started from
  -- nothing, which is the second door rather than the front one.
  source_resume_id uuid references public.resumes on delete set null,

  -- Their name for it. "Backend — Razorpay" once tailoring exists; until then
  -- everybody has one and it is called what their resume is called.
  title text not null default 'My resume',

  /**
   * The document itself: the ParsedResume shape, extended.
   *
   * JSON rather than columns because the shape is a tree — roles hold
   * bullets, education holds rows — and because the agent's edits address
   * paths into it. Normalising it into six tables would buy referential
   * integrity nobody needs and cost a join on every keystroke.
   */
  content jsonb not null default '{}'::jsonb,

  -- Scored by the same function an upload goes through, stored so the list
  -- screen does not have to re-render and re-score every draft to show a
  -- number. Recomputed on every save; never edited by hand.
  ats_score  integer,
  ats_result jsonb,

  -- The one somebody is actually working on, and the one the agent edits when
  -- they say "my resume" without naming one.
  is_primary boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resume_drafts_user_idx
  on public.resume_drafts (user_id, updated_at desc);

-- One current draft per person, enforced by the database rather than by
-- whichever code path happens to run — the same reason `resumes` does it.
create unique index if not exists resume_drafts_one_primary_idx
  on public.resume_drafts (user_id) where is_primary;


-- ------------------------------------------------------------------- access

alter table public.resume_drafts enable row level security;

-- A policy filters rows inside a privilege the role already holds; without
-- the grant, the policy is never consulted and every query fails on
-- permission instead. Both are needed.
grant select, insert, update, delete on public.resume_drafts to authenticated;

drop policy if exists "read own drafts" on public.resume_drafts;
create policy "read own drafts" on public.resume_drafts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "insert own drafts" on public.resume_drafts;
create policy "insert own drafts" on public.resume_drafts
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update own drafts" on public.resume_drafts;
create policy "update own drafts" on public.resume_drafts
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own drafts" on public.resume_drafts;
create policy "delete own drafts" on public.resume_drafts
  for delete to authenticated using (auth.uid() = user_id);


-- --------------------------------------------------------------- updated_at

drop trigger if exists resume_drafts_touch on public.resume_drafts;
create trigger resume_drafts_touch before update on public.resume_drafts
  for each row execute function public.touch_updated_at();


-- ------------------------------------------------------------ verification

-- Should print one row, with rls on and four policies.
select c.relname,
       c.relrowsecurity as rls,
       count(p.polname) as policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policy p on p.polrelid = c.oid
 where n.nspname = 'public'
   and c.relname = 'resume_drafts'
 group by c.relname, c.relrowsecurity;
