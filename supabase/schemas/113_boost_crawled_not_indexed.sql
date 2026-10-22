-- ============================================================
-- Search Console, 22 Oct: "Crawled – currently not indexed" for three
-- guides that had only 2–4 internal links in. A paragraph with descriptive
-- anchors is appended to the closest related guides, so each gets links
-- from the pages Google already crawls in the same topic. Runs once: a post
-- that already has its paragraph is skipped.
-- ============================================================

update public.posts p set content_html = p.content_html || v.para
from (values
  -- IT companies in Bangalore: from the other city guides and the fresher job guides
  ('it-companies-in-pune-for-freshers', 'data-boost="cities-pune"',
   $p$<p data-boost="cities-pune">Comparing cities before you apply? See the <a href="/blog/it-companies-in-bangalore-for-freshers">IT companies in Bangalore for freshers</a> and the <a href="/blog/it-companies-in-hyderabad-for-freshers">IT companies in Hyderabad for freshers</a>, and check <a href="/blog/highest-paying-cities-in-india-for-freshers">which cities pay freshers the most</a> once rent is counted.</p>$p$),
  ('it-companies-in-hyderabad-for-freshers', 'data-boost="cities-hyd"',
   $p$<p data-boost="cities-hyd">Weighing Hyderabad against the other hubs? Read the <a href="/blog/it-companies-in-bangalore-for-freshers">IT companies in Bangalore for freshers</a> and the <a href="/blog/it-companies-in-pune-for-freshers">IT companies in Pune for freshers</a> side by side.</p>$p$),
  ('highest-paying-cities-in-india-for-freshers', 'data-boost="cities-pay"',
   $p$<p data-boost="cities-pay">Once you have picked a city, the employers are the next question: the <a href="/blog/it-companies-in-bangalore-for-freshers">IT companies in Bangalore for freshers</a>, in <a href="/blog/it-companies-in-hyderabad-for-freshers">Hyderabad</a> and in <a href="/blog/it-companies-in-pune-for-freshers">Pune</a>, mapped by who actually hires at entry level.</p>$p$),
  ('jobs-for-freshers', 'data-boost="jobs-cities"',
   $p$<p data-boost="jobs-cities">Most fresher tech hiring is concentrated in a few cities. Start with the <a href="/blog/it-companies-in-bangalore-for-freshers">IT companies in Bangalore for freshers</a>, then <a href="/blog/it-companies-in-pune-for-freshers">Pune</a> and <a href="/blog/it-companies-in-hyderabad-for-freshers">Hyderabad</a>, and prepare for the round that follows the test with these <a href="/blog/technical-interview-questions-freshers">technical interview questions for freshers</a>.</p>$p$),
  ('off-campus-drive', 'data-boost="offcampus"',
   $p$<p data-boost="offcampus">Applying off campus means choosing employers yourself: the <a href="/blog/it-companies-in-bangalore-for-freshers">IT companies in Bangalore for freshers</a> is a good map to start from, and these <a href="/blog/technical-interview-questions-freshers">technical interview questions for freshers</a> cover the round most drives end with.</p>$p$),

  -- Technical interview questions: from the subject-wise question banks
  ('java-interview-questions-for-freshers', 'data-boost="tech-java"',
   $p$<p data-boost="tech-java">Java is one part of the technical round. For the rest — DBMS, OOPs, operating systems, networks and the coding question — see the full list of <a href="/blog/technical-interview-questions-freshers">technical interview questions for freshers</a>.</p>$p$),
  ('python-interview-questions-for-freshers', 'data-boost="tech-python"',
   $p$<p data-boost="tech-python">Python questions rarely come alone. The <a href="/blog/technical-interview-questions-freshers">technical interview questions for freshers</a> cover the CS fundamentals asked in the same round.</p>$p$),
  ('dbms-interview-questions', 'data-boost="tech-dbms"',
   $p$<p data-boost="tech-dbms">DBMS is usually asked together with OOPs, operating systems and a coding problem — all of them are in these <a href="/blog/technical-interview-questions-freshers">technical interview questions for freshers</a>.</p>$p$),
  ('oops-interview-questions', 'data-boost="tech-oops"',
   $p$<p data-boost="tech-oops">For the other subjects a fresher's technical round covers, work through the <a href="/blog/technical-interview-questions-freshers">technical interview questions for freshers</a>.</p>$p$),
  ('campus-placement-preparation', 'data-boost="tech-campus"',
   $p$<p data-boost="tech-campus">After the aptitude test comes the technical interview: practise with these <a href="/blog/technical-interview-questions-freshers">technical interview questions for freshers</a>, subject by subject.</p>$p$),

  -- Google Docs resume template: from the ATS and template guides
  ('ats-friendly-resume-template', 'data-boost="gdocs-ats"',
   $p$<p data-boost="gdocs-ats">Building it in Google Docs? Not every built-in design survives a parser — see the <a href="/blog/google-docs-resume-template">Google Docs resume templates ranked by ATS safety</a>, or start from one of the <a href="/resume-templates">free resume templates</a> here.</p>$p$),
  ('canva-resume-ats-friendly', 'data-boost="gdocs-canva"',
   $p$<p data-boost="gdocs-canva">If you are moving off Canva, Google Docs is the usual next stop. These are the <a href="/blog/google-docs-resume-template">Google Docs resume templates ranked by ATS safety</a>.</p>$p$),
  ('two-column-resume-ats', 'data-boost="gdocs-2col"',
   $p$<p data-boost="gdocs-2col">Google Docs has its own built-in resume templates, and not all of them parse cleanly. Here is <a href="/blog/google-docs-resume-template">which Google Docs resume template to use</a> and which to avoid.</p>$p$),
  ('resume-format-for-freshers', 'data-boost="gdocs-fresher"',
   $p$<p data-boost="gdocs-fresher">Writing it in Google Docs? Pick from the <a href="/blog/google-docs-resume-template">Google Docs resume templates ranked by ATS safety</a>, or use one of the <a href="/resume-templates">free resume templates</a> with a live preview.</p>$p$)
) as v(slug, marker, para)
where p.slug = v.slug and p.status = 'published' and position(v.marker in p.content_html) = 0;
