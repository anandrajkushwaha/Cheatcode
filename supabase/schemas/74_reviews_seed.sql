-- ============================================================
-- Four starter rows for the testimonial carousel.
--
-- READ THIS BEFORE PUBLISHING ANY OF THEM.
--
-- These are placeholders. The names and the words are invented — they are
-- here so the carousel, the ordering buttons and the admin preview have
-- something to work with, not because four people said these things.
--
-- So every row below is inserted with published = false. They will not appear
-- on the Pro page. Open /admin/reviews, replace each one with something a
-- real customer actually wrote and agreed to have published, and tick
-- Publish then.
--
-- Putting invented quotes attributed to invented people on a page that takes
-- ₹99 is a false endorsement. It is also exactly the kind of thing a payment
-- gateway looks for when it reviews a merchant site, so it is a commercial
-- risk on top of being wrong.
--
-- Run after 73_reviews.sql. Safe to re-run — it does nothing if the table
-- already has rows.
-- ============================================================

do $$
begin
  if exists (select 1 from public.reviews limit 1) then
    raise notice 'reviews already has rows — seed skipped.';
    return;
  end if;

  insert into public.reviews (name, role, quote, position, published) values
    (
      'Rohit Menon',
      'Software Engineer',
      'The career agent is the part I did not expect to use and now use every day. It knows what is on my resume, so when a role comes up it tells me which two lines to change instead of making me guess. I have had two interviews from roles it surfaced first.',
      0,
      false
    ),
    (
      'Priya Sharma',
      'Marketing Executive',
      'I had been applying for months and rarely heard back. After moving to Cheatcode Pro I rebuilt my resume with the AI builder and the difference in replies was obvious within a fortnight. The suggestions on my summary were the thing that changed it.',
      10,
      false
    ),
    (
      'Aditya Nair',
      'Data Analyst',
      'What sold me was not having to start over for every application. I keep two versions of my resume for two kinds of role and switch between them in a click, and the templates actually get through the screening software.',
      20,
      false
    ),
    (
      'Sneha Iyer',
      'Operations Manager',
      'Ninety-nine rupees a month is less than one coffee and it replaced three tools I was paying nothing for and getting nothing from. The resume builder alone saved me an entire weekend.',
      30,
      false
    );

  raise notice 'Seeded 4 placeholder reviews, all unpublished. Replace them in /admin/reviews.';
end $$;
