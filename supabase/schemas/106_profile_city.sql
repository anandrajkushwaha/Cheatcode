-- ============================================================
-- profiles.city — the city someone gives when they sign up with a number or
-- an email (Google sign-ups don't ask, so it stays null for them).
--
-- The sign-up route puts full_name and city in the new user's metadata;
-- handle_new_user copies both into the profile row it creates.
-- Safe to re-run.
-- ============================================================

alter table public.profiles add column if not exists city text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone, full_name, avatar_url, city)
  values (
    new.id,
    new.email,
    new.phone,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    nullif(trim(new.raw_user_meta_data ->> 'city'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
