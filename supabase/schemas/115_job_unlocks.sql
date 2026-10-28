-- ============================================================
-- Paid unlocks for matched jobs: ₹49 for one job, ₹99 for every match for
-- 7 days. One row per Razorpay order; written only by the server (order
-- creation, checkout verification, and the order.paid webhook).
-- ============================================================

create table if not exists public.job_unlocks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  kind            text not null check (kind in ('job', 'pass')),
  job_id          uuid references public.jobs(id) on delete set null,
  amount_paise    int not null,
  rzp_order_id    text not null unique,
  rzp_payment_id  text,
  status          text not null default 'created' check (status in ('created', 'paid')),
  expires_at      timestamptz,
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists job_unlocks_user_idx on public.job_unlocks (user_id, status);

alter table public.job_unlocks enable row level security;
grant select on public.job_unlocks to authenticated;

drop policy if exists "read own unlocks" on public.job_unlocks;
create policy "read own unlocks" on public.job_unlocks
  for select to authenticated using (user_id = auth.uid());
