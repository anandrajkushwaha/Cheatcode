-- ============================================================
-- Who else may open this resume, and what they may do with it.
--
-- Run after 53_resume_style.sql. Safe to re-run.
--
-- Two separate ideas, deliberately kept separate:
--
--   `link_role` is what the *link* grants. 'view' is the default and stays
--   the default: a link that edits is a link that anybody who has ever been
--   forwarded it can rewrite, and a resume is exactly the document where a
--   silent edit does the most damage. Even at 'edit' the route still demands
--   a signed-in account, so an edit always has a name attached to it.
--
--   `resume_collaborators` is what a *person* was granted, by email, one at a
--   time. This is the honest version of "share with someone": the owner names
--   who, the grant survives the link being switched off, and it can be taken
--   back from one person without breaking everybody else's access.
--
-- Email rather than user id, because the person being invited very often does
-- not have an account yet — the invite has to be able to sit and wait for
-- them. It is stored lower-cased and the unique index is on the pair, so
-- inviting the same address twice updates rather than duplicates.
-- ============================================================

alter table public.resume_drafts
  add column if not exists link_role text not null default 'view';

alter table public.resume_drafts
  drop constraint if exists resume_drafts_link_role_check;

alter table public.resume_drafts
  add constraint resume_drafts_link_role_check
  check (link_role in ('view', 'edit'));

comment on column public.resume_drafts.link_role is
  'What /r/<share_id> grants: view (default) or edit. Edit still requires the '
  'visitor to be signed in, so every change is attributable.';

create table if not exists public.resume_collaborators (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.resume_drafts (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'view' check (role in ('view', 'edit')),
  created_at timestamptz not null default now()
);

create unique index if not exists resume_collaborators_draft_email_idx
  on public.resume_collaborators (draft_id, lower(email));

create index if not exists resume_collaborators_email_idx
  on public.resume_collaborators (lower(email));

alter table public.resume_collaborators enable row level security;

-- RLS decides which rows; the grant decides whether the table can be touched
-- at all. Without the grant the policies below are never consulted and every
-- query fails on permission instead — which reads like a bug in the app.
grant select, insert, update, delete on public.resume_collaborators to authenticated;

-- The owner is the only one who may see or change the guest list. A guest
-- reads their own access through the service key on the public route, where
-- the check is `email = the signed-in session's email` and nothing else —
-- letting guests select this table directly would let anybody enumerate who
-- else a resume was shared with.
drop policy if exists "owner reads collaborators" on public.resume_collaborators;
create policy "owner reads collaborators" on public.resume_collaborators
  for select using (auth.uid() = owner_id);

drop policy if exists "owner writes collaborators" on public.resume_collaborators;
create policy "owner writes collaborators" on public.resume_collaborators
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

comment on table public.resume_collaborators is
  'People invited to one resume by email address. Survives the public link '
  'being switched off; revoking one person does not affect the others.';
