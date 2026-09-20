-- ============================================================
-- Team logins.
--
-- The owner's credentials stay in environment variables — that account must
-- work even if the database is unreachable, because it is the account you use
-- to find out why the database is unreachable. Everybody else lives here, so
-- they can be added and removed from a screen instead of a deploy.
--
-- ------------------------------------------------------------- the password
--
-- Stored as scrypt(password, salt), never as the password. scrypt because it
-- is in Node's standard library: adding bcrypt or argon2 would put a native
-- dependency on the login path, and a login that fails to build is a worse
-- outcome than the marginal difference between two good hashes.
--
-- ------------------------------------------------------------ the sections
--
-- `sections` is a list of names like ['articles','reviews'], matching
-- lib/admin/roles.ts. A list rather than a column per screen, because the
-- screens change and a migration per screen is a migration nobody runs.
--
-- Run after 20_app_accounts.sql. Safe to re-run.
-- ============================================================

create table if not exists public.admin_users (
  id            uuid primary key default gen_random_uuid(),

  -- What they type to sign in. Lowercased by the application before it gets
  -- here, so "Instinct" and "instinct" cannot become two accounts.
  username      text not null unique,
  name          text,

  password_hash text not null,
  password_salt text not null,

  sections      text[] not null default '{}',

  -- Switched off rather than deleted, so the row that says who published an
  -- article does not disappear along with their access.
  is_active     boolean not null default true,

  created_at    timestamptz not null default now(),
  last_login_at timestamptz,

  constraint admin_users_username_ck check (char_length(username) between 3 and 40)
);

create index if not exists admin_users_active_idx
  on public.admin_users (username) where is_active;

-- ------------------------------------------------------------------ access
--
-- No policy for anyone. Not anon, not authenticated. This table holds
-- password hashes and the list of what each person may reach, and the only
-- code that ever touches it runs on the server with the service key, behind
-- the owner's own login.

alter table public.admin_users enable row level security;

comment on table public.admin_users is
  'Team logins for the admin panel. The owner is not in here — that account '
  'is environment variables so it survives the database being down.';
