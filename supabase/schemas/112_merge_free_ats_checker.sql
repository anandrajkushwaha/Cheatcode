-- free-ats-resume-checker merged into /tools/resume-ats-checker (redirect in
-- lib/seo/merged-guides.ts). The row and its content are kept, archived.
alter table public.posts disable trigger posts_touch_updated_at;
update public.posts set status = 'archived' where slug = 'free-ats-resume-checker' and status = 'published';
alter table public.posts enable trigger posts_touch_updated_at;
