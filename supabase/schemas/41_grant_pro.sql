-- ============================================================
-- Give one account a Pro plan, by email.
--
-- For testing the paid surfaces without going through Razorpay. Run in the
-- Supabase SQL editor, which runs as the table owner and so is allowed to
-- write plan columns that no client may touch.
--
-- Change the email and re-run to grant somebody else. Re-running for the
-- same address just pushes the expiry out.
-- ============================================================

update public.profiles p
   set plan            = 'pro',
       plan_status     = 'active',
       -- A year out rather than null: an expiry that never arrives is how a
       -- test account quietly becomes a free customer forever.
       plan_expires_at = now() + interval '365 days',
       updated_at      = now()
  from auth.users u
 where u.id = p.id
   and lower(u.email) = lower('anandrajkushwaha4@gmail.com');

-- Confirm it landed. If this returns no rows, that address has not signed in
-- yet — the profile row is created by the trigger on first sign-in, so sign
-- in once and run this again.
select u.email, p.plan, p.plan_status, p.plan_expires_at
  from public.profiles p
  join auth.users u on u.id = p.id
 where lower(u.email) = lower('anandrajkushwaha4@gmail.com');
