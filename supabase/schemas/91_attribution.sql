-- ============================================================
-- Where people come from — per visit, and per account.
--
-- page_views.medium / campaign   the session's source detail (paid / social /
--                                organic…, and the utm_campaign of the ad).
--                                `source` itself is now the session's source
--                                too, so an ad visitor's second page is no
--                                longer filed as "direct".
-- profiles.signup_*              what first brought an account holder here,
--                                recorded the first time they open the app.
--
-- Each half runs only where its table exists, so this one file is safe to
-- run in the site project, the app project, or both if they are the same.
-- Safe to re-run.
-- ============================================================

do $$
begin
  if to_regclass('public.page_views') is not null then
    alter table public.page_views add column if not exists medium   text;
    alter table public.page_views add column if not exists campaign text;
    create index if not exists pv_campaign_idx
      on public.page_views (campaign, created_at desc) where campaign is not null;
  end if;

  if to_regclass('public.profiles') is not null then
    alter table public.profiles add column if not exists signup_source     text;
    alter table public.profiles add column if not exists signup_medium     text;
    alter table public.profiles add column if not exists signup_campaign   text;
    alter table public.profiles add column if not exists signup_landing    text;
    alter table public.profiles add column if not exists first_seen_at     timestamptz;
  end if;
end $$;
