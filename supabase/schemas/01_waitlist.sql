-- Phase 1: waitlist capture.
-- Run this in Supabase → SQL Editor (or keep it as the declarative source
-- of truth and generate a migration with `supabase db diff -f waitlist`).

create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  source     text not null default 'unknown',
  created_at timestamptz not null default now(),
  unique (email)
);

alter table public.waitlist enable row level security;

-- Anyone may join the list...
grant insert on public.waitlist to anon, authenticated;

create policy "anyone can join the waitlist"
on public.waitlist
for insert
to anon, authenticated
with check (true);

-- ...but nobody public can read it. No select grant, no select policy.
-- View signups in the Supabase dashboard, which bypasses RLS as the owner.
