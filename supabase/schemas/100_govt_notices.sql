-- ============================================================
-- Government jobs: one exam, many notices.
--
-- The thing this file gets right, and the reason it is shaped the way it is:
-- a result, an admit card, an answer key and a recruitment notification are
-- not four kinds of thing. They are four events in ONE recruitment. Sarkari
-- Result and FreeJobAlert list them as unrelated rows in four columns, so
-- somebody following SSC CGL has to go and find each one separately, every
-- time. Here they hang off a single `govt_exams` row and the exam's page can
-- show the whole lifecycle, including the stages that have not happened yet.
--
-- govt_exams             the recruitment. Carries the dates, the fee, the
--                        vacancies — everything a person filters or decides on.
-- govt_notices           one row per published notice. Uniform across all six
--                        kinds: a title, a date, a link, and which exam it is about.
-- govt_sources           the official pages we watch. One row per recruiter.
-- govt_notice_candidates what a run found and has not published. Nothing a
--                        machine produced is ever written straight into the
--                        tables a reader sees.
-- govt_saves             a person's bookmarks.
-- govt_error_reports     readers telling us something is wrong. The cheapest
--                        accuracy signal there is, and the one that matters
--                        most now that nothing waits for a human to approve it.
--
-- Everything here is public information that recruitment boards publish in
-- order to be read, linked back to the official page on every row. Nothing is
-- taken from an aggregator.
--
-- Run after 30_jobs.sql (it enables pg_trgm). Safe to re-run.
-- ============================================================

create extension if not exists pg_trgm;

-- -------------------------------------------------------------------- exams

create table if not exists public.govt_exams (
  id                   uuid primary key default gen_random_uuid(),

  -- Generated once, at creation, from organisation + exam + year, and never
  -- recomputed. A slug that changes because somebody fixed a title is a dead
  -- Google result, and this feature's whole acquisition case is Google.
  slug                 text not null unique,

  organisation         text not null,                 -- 'SSC', 'BPSC', 'UPESSC'
  organisation_type    text not null default 'state'
    check (organisation_type in ('central', 'state', 'bank', 'railway', 'defence', 'psu', 'court', 'university')),
  name                 text not null,                 -- 'Combined Graduate Level 2026'
  year                 int,

  /* ---- what people filter on ----
   *
   * Canonical arrays, never prose. A filter has to be an array overlap; the
   * moment it becomes a LIKE over a qualification sentence it starts matching
   * "not a graduate" as "graduate". The verbatim text lives beside it, in
   * `qualification_text`, and that is what the reader is shown. */
  qualification_levels text[] not null default '{}',   -- 10th 12th iti diploma graduate pg engineering medical
  qualification_text   text,
  states               text[] not null default '{}',
  is_all_india         boolean not null default false,
  age_min              int,
  age_max              int,
  vacancies            int,

  /* ---- the application ----
   *
   * On the exam rather than on the notice, deliberately: a recruitment has one
   * application window, announced by a notice and then usually extended by
   * another. Holding the dates here means an extension updates one row and
   * every page showing it is correct, instead of two notices disagreeing about
   * when applications close. */
  application_start    date,
  application_end      date,
  apply_url            text,
  -- ₹100 general, nil for SC/ST/PwD/women is the standard shape, and a single
  -- `fee` column cannot say it. {"general": 100, "sc": 0, "st": 0, "women": 0}
  fee_by_category      jsonb,

  /* ---- the exam itself ----
   *
   * A range and a note, not one date. Most notifications say "tentatively in
   * March 2026", and a single `exam_date` column forces that into a lie. */
  exam_date_from       date,
  exam_date_to         date,
  date_note            text,

  selection_process    text[] not null default '{}',   -- 'Tier 1', 'Tier 2', 'Document verification'
  about                text,

  /* ---- where every consequential field came from ----
   *
   * The asymmetry this column exists for: a MISSING last date costs somebody a
   * click through to the official notification, which is where we are sending
   * them anyway. A WRONG last date costs them the job. So the dangerous fields
   * — application_end, application_start, fee, vacancies, age_min, age_max —
   * are published only when the extractor can quote the sentence it read them
   * from, and that quote is kept here:
   *
   *   {"application_end": {"quote": "…last date 20.10.2026…", "url": "https://…"}}
   *
   * A field with no entry here was not verified. The page shows it as absent
   * and points at the notification, rather than guessing.
   *
   * Which means a value set WITHOUT an entry here is invisible, and that is a
   * trap for hand entry: somebody types the vacancy count into the admin form,
   * the page does not show it, and nothing says why. So the admin form writes
   * its own evidence as it saves — {"vacancies": {"quote": "entered by hand",
   * "by": "<admin email>"}} — because a person reading the notification and
   * typing what it says IS the verification. The rule is about provenance,
   * not about who did the reading. */
  evidence             jsonb not null default '{}'::jsonb,

  status               text not null default 'draft'
    check (status in ('draft', 'published', 'closed', 'withdrawn')),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Every list page is "published, closing soonest" or "published, newest".
create index if not exists govt_exams_closing_idx
  on public.govt_exams (application_end) where status = 'published';
create index if not exists govt_exams_org_idx
  on public.govt_exams (organisation, created_at desc) where status = 'published';
create index if not exists govt_exams_qual_idx
  on public.govt_exams using gin (qualification_levels);
create index if not exists govt_exams_states_idx
  on public.govt_exams using gin (states);

-- ------------------------------------------------------------------ sources

create table if not exists public.govt_sources (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  organisation  text not null,
  -- Copied onto any exam this source mints, so a notice that arrives with no
  -- recruitment behind it still lands on a page that knows what kind of body
  -- published it.
  organisation_type text not null default 'state'
    check (organisation_type in ('central', 'state', 'bank', 'railway', 'defence', 'psu', 'court', 'university')),
  -- The page that lists notifications, not the home page.
  list_url      text unique,
  kind          text not null default 'html'
    check (kind in ('html', 'pdf_index', 'rss', 'api')),
  active        boolean not null default false,

  -- Hashed over the links we extract, not the raw HTML: plenty of government
  -- pages re-render a timestamp on every request, so a raw hash changes every
  -- run and the monitor never stops.
  last_hash     text,

  -- Written back by each run, so a board that quietly starts 404ing is a red
  -- row in the dashboard rather than a quiet week with fewer jobs.
  last_run_at   timestamptz,
  last_status   text,
  last_count    int not null default 0,
  last_error    text,

  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------------ notices

create table if not exists public.govt_notices (
  id             uuid primary key default gen_random_uuid(),

  /* Nullable in the schema because the pipeline will meet orphans — a
   * corrigendum, a postponement circular, a merit list for a notification we
   * never saw. Never null in what a reader sees: when no exam can be matched,
   * one is minted from the notice itself (organisation, name, year) so the
   * notice always has a page to live on, and the next notice from the same
   * recruitment attaches to that row. */
  exam_id        uuid references public.govt_exams(id) on delete set null,
  source_id      uuid references public.govt_sources(id) on delete set null,

  -- Closed on purpose. Each value is a page, a filter and a nav item, so a
  -- seventh is a product decision rather than a row somebody adds.
  kind           text not null
    check (kind in ('job', 'result', 'admit_card', 'answer_key', 'syllabus', 'admission')),

  title          text not null,
  summary        text,
  published_on   date,

  -- The official page or PDF. Unique, because the same notification appearing
  -- twice is the most common thing a monitor does wrong.
  official_url   text not null unique,

  status         text not null default 'published'
    check (status in ('draft', 'published', 'stale', 'withdrawn')),

  -- Refreshed every run the link still resolves. A link that stops resolving
  -- is marked stale on the page rather than silently serving a dead button.
  last_seen_at   timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists govt_notices_kind_idx
  on public.govt_notices (kind, published_on desc) where status = 'published';
create index if not exists govt_notices_exam_idx
  on public.govt_notices (exam_id, published_on desc);
create index if not exists govt_notices_title_idx
  on public.govt_notices using gin (title gin_trgm_ops);

-- --------------------------------------------------------------- candidates

create table if not exists public.govt_notice_candidates (
  id             uuid primary key default gen_random_uuid(),
  source_id      uuid references public.govt_sources(id) on delete cascade,

  -- What was found, before anything was decided about it.
  raw_url        text not null,
  content_hash   text,
  raw_title      text,

  -- The extractor's output, and what it could quote for each field. A field
  -- with no quote never reaches govt_exams; it waits here instead.
  extracted      jsonb not null default '{}'::jsonb,
  evidence       jsonb not null default '{}'::jsonb,

  -- 'published' means it went live on its own. 'held' means something could
  -- not be quoted or failed validation — the notice itself may still be live,
  -- with that one field absent. 'rejected' keeps it from being re-surfaced.
  state          text not null default 'new'
    check (state in ('new', 'published', 'held', 'rejected')),
  note           text,

  notice_id      uuid references public.govt_notices(id) on delete set null,
  created_at     timestamptz not null default now(),

  unique (source_id, raw_url)
);

create index if not exists govt_candidates_state_idx
  on public.govt_notice_candidates (state, created_at desc);

-- -------------------------------------------------------------------- saves

create table if not exists public.govt_saves (
  user_id    uuid not null references auth.users(id) on delete cascade,
  notice_id  uuid not null references public.govt_notices(id) on delete cascade,
  -- The whole application tracker, for now. Nine stages nobody updates is
  -- worse than one checkbox people do.
  applied    boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, notice_id)
);

create index if not exists govt_saves_user_idx
  on public.govt_saves (user_id, created_at desc);

-- ------------------------------------------------------------------ reports

create table if not exists public.govt_error_reports (
  id         uuid primary key default gen_random_uuid(),
  notice_id  uuid references public.govt_notices(id) on delete cascade,
  exam_id    uuid references public.govt_exams(id) on delete cascade,
  -- Which field they say is wrong, when they told us.
  field      text,
  message    text not null check (char_length(message) between 3 and 2000),
  -- Null for a signed-out reader, which is most of them. Deliberately not
  -- requiring an account: the people who spot a wrong date fastest are the
  -- ones who have not signed up.
  user_id    uuid references auth.users(id) on delete set null,
  resolved   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists govt_error_reports_open_idx
  on public.govt_error_reports (created_at desc) where not resolved;

-- ------------------------------------------------------------------- access

alter table public.govt_exams             enable row level security;
alter table public.govt_notices           enable row level security;
alter table public.govt_sources           enable row level security;
alter table public.govt_notice_candidates enable row level security;
alter table public.govt_saves             enable row level security;
alter table public.govt_error_reports     enable row level security;

/* Published rows are readable by anybody, signed out included. That is the
 * point of the public pages, and it is the one place in this app where
 * anon gets a select — the policy is what keeps a draft from being one
 * `?select=*` away from public.
 *
 * A policy filters rows inside a privilege the role already holds; without
 * the grant the policy is never consulted and the query fails on permission
 * instead. Both are needed. */
grant select on public.govt_exams   to anon, authenticated;
grant select on public.govt_notices to anon, authenticated;

drop policy if exists "read published exams" on public.govt_exams;
create policy "read published exams" on public.govt_exams
  for select to anon, authenticated using (status in ('published', 'closed'));

drop policy if exists "read published notices" on public.govt_notices;
create policy "read published notices" on public.govt_notices
  for select to anon, authenticated using (status in ('published', 'stale'));

-- Their own bookmarks, and nobody else's.
grant select, insert, update, delete on public.govt_saves to authenticated;

drop policy if exists "read own saves" on public.govt_saves;
create policy "read own saves" on public.govt_saves
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "insert own saves" on public.govt_saves;
create policy "insert own saves" on public.govt_saves
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update own saves" on public.govt_saves;
create policy "update own saves" on public.govt_saves
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own saves" on public.govt_saves;
create policy "delete own saves" on public.govt_saves
  for delete to authenticated using (auth.uid() = user_id);

-- govt_sources, govt_notice_candidates and govt_error_reports get RLS with no
-- policies at all: they are reached only by the service key, server-side. The
-- error-report form posts through our own route, which is also what keeps it
-- rate-limited and keeps a stranger from writing straight into the table.

-- ------------------------------------------------------------------- sources
--
-- The ten to start with, chosen on vacancies rather than on how many notices
-- they publish. One or two boards carry most of a state: BPSC alone is about
-- 92% of Bihar's live postings and UPESSC about 74% of Uttar Pradesh's, while
-- the long tail of district courts, universities and anganwadi programmes is
-- most of the *notices* and almost none of the *vacancies* — and all of the
-- ingestion work, because every one of them is a different site.
--
-- EVERY ROW IS INACTIVE. `list_url` below is the page each board is believed
-- to publish notifications on, and not one of them has been opened and
-- checked. Confirm the URL, then set active = true, one board at a time. A
-- monitor pointed at an unverified URL either finds nothing and looks broken,
-- or finds the wrong page and publishes it.

insert into public.govt_sources (name, organisation, organisation_type, list_url, kind) values
  ('Staff Selection Commission',        'SSC',      'central',  'https://ssc.gov.in/',                      'html'),
  ('Union Public Service Commission',   'UPSC',     'central',  'https://upsc.gov.in/whats-new',            'html'),
  ('IBPS',                              'IBPS',     'bank',     'https://www.ibps.in/',                     'html'),
  ('Railway Recruitment Boards',        'RRB',      'railway',  'https://indianrailways.gov.in/',           'html'),
  ('India Post',                        'INDIAPOST','central',  'https://www.indiapost.gov.in/',            'html'),
  ('State Bank of India',               'SBI',      'bank',     'https://sbi.co.in/web/careers',            'html'),
  ('Join Indian Army',                  'ARMY',     'defence',  'https://joinindianarmy.nic.in/',           'html'),
  ('Join Indian Navy',                  'NAVY',     'defence',  'https://www.joinindiannavy.gov.in/',       'html'),
  ('Bihar Public Service Commission',   'BPSC',     'state',    'https://www.bpsc.bihar.gov.in/',           'html'),
  ('UP Education Services Commission',  'UPESSC',   'state',    'https://www.upessc.gov.in/',               'html')
on conflict (list_url) do nothing;
