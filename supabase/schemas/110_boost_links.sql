-- ============================================================
-- Links from the guides that already get search impressions to related
-- guides in the same topic that had the fewest links in (SEO PRD, C.6).
-- One paragraph appended to each, with descriptive anchors. Runs once:
-- a post that already has the paragraph is skipped.
-- ============================================================

update public.posts p set content_html = p.content_html || v.para
from (values
  ('amazon-india-interview-questions', 'data-boost="amazon"',
   $p$<p data-boost="amazon">Preparing for more than one company this season? Compare the process with the <a href="/blog/accenture-interview-questions">Accenture interview questions</a>, the <a href="/blog/capgemini-interview-questions">Capgemini interview questions</a> and the <a href="/blog/deloitte-india-interview-questions">Deloitte India interview questions</a>, and rehearse the <a href="/blog/hr-interview-questions-freshers">HR interview questions for freshers</a> that close almost every one of these rounds.</p>$p$),
  ('cognizant-interview-questions', 'data-boost="cognizant"',
   $p$<p data-boost="cognizant">Applying to other service companies at the same time? See the <a href="/blog/hcltech-interview-questions">HCLTech interview questions</a>, the <a href="/blog/wipro-interview-questions">Wipro interview questions</a> and <a href="/blog/infosys-hackwithinfy">HackWithInfy</a>, Infosys's route to its higher pay bands, and get ready for the first round with <a href="/blog/aptitude-test-preparation">aptitude test preparation</a>.</p>$p$),
  ('cv-maker-online-free', 'data-boost="cv-maker"',
   $p$<p data-boost="cv-maker">Whichever CV maker you use, the sections still have to be right. Check <a href="/blog/declaration-in-resume">whether your resume needs a declaration</a>, or start from a format written for your role: the <a href="/blog/accountant-resume-format">accountant resume format</a>, the <a href="/blog/data-entry-resume-format">data entry resume format</a> or the <a href="/blog/hr-manager-resume-format">HR manager resume format</a>.</p>$p$),
  ('expected-ctc-question', 'data-boost="expected-ctc"',
   $p$<p data-boost="expected-ctc">Before you name a number, work out what it becomes each month: how <a href="/blog/variable-pay-in-ctc">variable pay in your CTC</a> is actually paid, the <a href="/blog/hra-exemption-calculation">HRA exemption calculation</a>, what a <a href="/blog/salary-hike-on-job-change">salary hike on a job change</a> usually is, and the <a href="/blog/60-lpa-in-hand-salary">60 LPA in-hand salary</a> breakdown if you are aiming high.</p>$p$),
  ('pre-placement-offer', 'data-boost="ppo"',
   $p$<p data-boost="ppo">If the PPO does not come through, the same preparation carries over: these <a href="/blog/naukri-profile-tips">Naukri profile tips</a> get recruiter calls started, <a href="/blog/gate-or-placement">GATE or placement</a> helps if you are weighing a master's, and <a href="/blog/internship-vs-full-time-job">internship vs full-time job</a> covers choosing between offers. Once you have joined, this is how <a href="/blog/appraisal-hike-percentage-india">appraisal hikes</a> work in Indian companies.</p>$p$)
) as v(slug, marker, para)
where p.slug = v.slug and position(v.marker in p.content_html) = 0;
