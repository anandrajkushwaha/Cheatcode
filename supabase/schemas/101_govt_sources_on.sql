-- ============================================================
-- Switch the government sources on, and let the first run be the check.
--
-- 100_govt_notices.sql seeded all ten inactive, on the reasoning that a
-- monitor pointed at an unverified URL either finds nothing and looks broken,
-- or finds the wrong page and publishes it. The first half of that is still
-- true. The second half is not, and that is what changed:
--
--   * the harvester only ever reads links that are on the page it was given;
--   * the classifier is handed those links and returns the subset that are
--     recruitment notices, checked back against what was actually sent;
--   * a page with no notices on it writes last_status = 'empty' and publishes
--     nothing at all.
--
-- So a wrong URL now costs one quiet row in the admin table rather than bad
-- data on a public page, and waiting for somebody to open ten government
-- websites by hand buys nothing. The run reports what it found; /admin/govt
-- is where that is read.
--
-- Two of these URLs are the ones to suspect first if a board stays empty.
-- RRB recruitment is split across twenty-one regional boards with no single
-- notice page, and rrbapply.gov.in is the closest thing to a central one.
-- UPESSC's domain has moved at least once. Both are best guesses; the other
-- eight are the boards' long-standing official addresses.
--
-- Run after 100_govt_notices.sql. Safe to re-run.
-- ============================================================

update public.govt_sources set list_url = 'https://rrbapply.gov.in/'
  where organisation = 'RRB' and list_url = 'https://indianrailways.gov.in/';

update public.govt_sources set active = true
  where list_url is not null;
