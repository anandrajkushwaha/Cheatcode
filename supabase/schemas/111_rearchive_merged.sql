-- ============================================================
-- The guides in lib/seo/merged-guides.ts 308 to the page that kept their
-- topic, but seven had been set back to published (and edited) after the
-- merge, which put redirecting URLs in the sitemap, category pages and
-- related lists. Archived again; updated_at left as the editor left it.
-- ============================================================
alter table public.posts disable trigger posts_touch_updated_at;
update public.posts set status = 'archived'
where status = 'published' and slug in ('tell-me-about-yourself-interview-answer','hr-interview-questions-freshers','software-engineer-resume-format-freshers','gratuity-calculation','group-discussion-topics-tips','what-are-your-salary-expectations','why-should-we-hire-you-answer');
alter table public.posts enable trigger posts_touch_updated_at;
