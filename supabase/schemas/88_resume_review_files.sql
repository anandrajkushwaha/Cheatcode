-- ============================================================
-- The actual file a reviewer opens.
--
-- resume_reviews pointed at public.resumes, which stores the extracted text
-- and the parsed fields — but never the document. So a reviewer got the words
-- and not the thing: no layout, no spacing, no idea whether page two is half
-- empty. Half of what is wrong with a resume is visible only in the PDF.
--
-- So a request can carry a file, stored in a PRIVATE bucket. Not public:
-- these are people's phone numbers and addresses, and a public bucket means a
-- guessable URL is the only thing between a stranger and all of them. The
-- admin screen mints a short-lived signed link instead.
--
-- Run after 87_resume_reviews.sql. Safe to re-run.
-- ============================================================

alter table public.resume_reviews
  add column if not exists file_path text;

alter table public.resume_reviews
  add column if not exists file_name text;

comment on column public.resume_reviews.file_path is
  'Object path inside the private resume-files bucket. Never a URL — the '
  'admin screen signs one on demand so nothing long-lived exists.';

-- ------------------------------------------------------------------ bucket
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'buckets') then

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'resume-files', 'resume-files', false, 10485760,
      array[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain'
      ]
    )
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    -- No storage policies are created on purpose. Nothing signed-in reads or
    -- writes this bucket directly: the upload goes through our own route with
    -- the service key, and the download is a signed URL minted for one admin.
    -- A policy here would be a second, wider door to the same files.
    raise notice 'Private bucket resume-files is ready.';
  else
    raise notice 'No storage schema here — review attachments will be skipped.';
  end if;
end $$;
