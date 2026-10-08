-- ============================================================
-- The URLs the first real runs proved wrong.
--
-- Three boards failed with ERR_NAME_NOT_RESOLVED, which is a domain that does
-- not exist rather than a page that was not found — so these were never going
-- to work, however long we waited:
--
--   BPSC    www.bpsc.bihar.gov.in   the www. does not exist; the apex does
--   UPESSC  www.upessc.gov.in       same
--   RRB     rrbapply.gov.in         not a domain at all. RRB recruitment is
--                                   split across twenty-one regional boards
--                                   with no central notice page; rrbcdg.gov.in
--                                   is one of them and it publishes the CEN
--                                   notices, which are national.
--
-- The www. cases are also handled in code now — a DNS failure retries once
-- with the other spelling — but a URL that is known to be wrong should be
-- right in the row as well, rather than relying on a retry every morning.
--
-- Run after 101_govt_sources_on.sql. Safe to re-run.
-- ============================================================

update public.govt_sources set list_url = 'https://bpsc.bihar.gov.in/'
  where organisation = 'BPSC';

update public.govt_sources set list_url = 'https://upessc.gov.in/'
  where organisation = 'UPESSC';

update public.govt_sources set list_url = 'https://www.rrbcdg.gov.in/'
  where organisation = 'RRB';

-- A changed URL is a different page, so the old fingerprint must not make the
-- next run skip it as "unchanged".
update public.govt_sources set last_hash = null, last_error = null
  where organisation in ('BPSC', 'UPESSC', 'RRB');
