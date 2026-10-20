-- ============================================================
-- Category hubs: three new categories, 53 posts re-filed, and an intro on
-- every category page (the SEO PRD, section B).
--
-- Post slugs do not change; only category_id. The updated_at trigger is
-- switched off for the move so re-filing does not read as a content update
-- in the sitemap's lastmod.
-- Safe to re-run.
-- ============================================================

insert into public.categories (slug, name, short_name, description, seo_title, seo_description, sort_order)
values
  ('pf-tax', 'PF, Tax & CTC', 'PF & Tax',
   'EPF, EPS, gratuity, Form 16, HRA and the tax regimes — what comes out of your CTC and why.',
   'PF, Tax & CTC Guides for Salaried Employees in India | Cheatcode',
   'EPF and EPS rules, Form 16, HRA exemption, gratuity and old vs new tax regime — explained for salaried employees in India, with worked numbers.',
   11),
  ('letters-formats', 'Letters & Formats', 'Letters',
   'Ready formats for the letters and emails a job needs — offer, relieving, resignation, leave and more.',
   'Letter Formats for Jobs in India — Offer, Relieving, Resignation | Cheatcode',
   'Free formats and samples for offer letters, experience and relieving letters, resignation and leave applications, bonafide and internship certificates.',
   12),
  ('career-growth', 'Career Growth', 'Growth',
   'Raises, appraisals, notice periods, counter-offers and switching careers — the decisions after the first job.',
   'Career Growth Guides — Raises, Notice Period, Job Switch | Cheatcode',
   'How to ask for a raise, what appraisal hike is normal, notice period and probation rules, counter-offers and switching careers in India.',
   13)
on conflict (slug) do nothing;

alter table public.posts disable trigger posts_touch_updated_at;

update public.posts p set category_id = c.id
from public.categories c
where c.slug = 'letters-formats' and p.slug in (
  'bonafide-certificate-format', 'experience-letter-format-india', 'internship-certificate-format',
  'leave-application-format', 'offer-letter-format-india', 'offer-letter-vs-appointment-letter',
  'relieving-letter', 'relieving-letter-format-india', 'resignation-letter-format',
  'salary-slip-format', 'job-application-follow-up-email', 'referral-request-message');

update public.posts p set category_id = c.id
from public.categories c
where c.slug = 'pf-tax' and p.slug in (
  'basic-salary-percentage-in-ctc', 'ctc-vs-in-hand-salary', 'epf-grievance-portal',
  'epf-interest-rate-2026', 'epf-nomination-online', 'epf-wage-ceiling-25000', 'epf-withdrawal-rules',
  'eps-higher-pension-option', 'eps-pension-calculation', 'form-16-explained', 'gratuity-calculation',
  'gratuity-calculation-india', 'how-to-check-epf-balance', 'how-to-file-itr-for-salaried-employees',
  'hra-exemption-calculation', 'leave-encashment-calculation', 'new-tax-regime-vs-old-regime',
  'pf-advance-rules', 'pf-deduction-explained', 'pf-transfer-job-change',
  'salary-slip-components-explained', 'standard-deduction', 'uan-activation-kyc-guide',
  'variable-pay-in-ctc');

update public.posts p set category_id = c.id
from public.categories c
where c.slug = 'career-growth' and p.slug in (
  'appraisal-hike-percentage-india', 'how-to-ask-for-a-raise', 'counter-offer-accept-or-not',
  'how-long-to-stay-in-first-job', 'notice-period-negotiation', 'notice-period-buyout',
  'notice-period-rules-india', 'probation-period-rules-india', 'should-i-switch-jobs',
  'career-switch-from-non-it-to-it', 'career-switch-to-data-analytics',
  'career-switch-to-product-management', 'startup-vs-mnc', 'service-based-vs-product-based-company',
  'bond-in-it-companies');

-- Misfiled: a resume format sitting in Job Search.
update public.posts p set category_id = c.id
from public.categories c
where c.slug = 'resume-format' and p.slug = '12th-pass-resume-format';

alter table public.posts enable trigger posts_touch_updated_at;
