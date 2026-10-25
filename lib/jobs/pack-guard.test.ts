/**
 * The honesty guard on application packs. Run with the others: npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { clean, tailoredResume } from "@/lib/jobs/pack-guard";
import { emptyResume, type Resume } from "@/lib/app/resume-schema";

const resume: Resume = {
  ...emptyResume(),
  summary: "Analyst.",
  skills: ["Excel", "SQL"],
  roles: [{ title: "Analyst", company: "Acme", start: "2022", end: null, is_current: true, highlights: ["Built reports", "Cut cost 10%"] }],
};
const candidate = { skills: resume.skills, text: "built reports in power bi. sql. excel.", years: 2, cities: [], remote: false, targetRole: null };

test("skills the resume doesn't show move to missing", () => {
  const p = clean({ skills: ["SQL", "Power BI", "Tableau"], keywords_missing: ["Python"] }, resume, candidate);
  assert.deepEqual(p.skills, ["SQL", "Power BI"]);
  assert.deepEqual(p.keywords_missing, ["Python", "Tableau"]);
});

test("bullets only for real roles, never more than the role had", () => {
  const p = clean(
    { roles: [{ index: 0, highlights: ["a", "b", "c"] }, { index: 3, highlights: ["x"] }] },
    resume,
    candidate,
  );
  assert.deepEqual(p.roles, [{ index: 0, highlights: ["a", "b"] }]);
});

test("the score is clamped and the tailored resume keeps every fact", () => {
  const p = clean({ fit_score: 140, summary: "New summary", skills: ["SQL"], roles: [{ index: 0, highlights: ["Reports for 3 teams", "Cut cost 10%"] }] }, resume, candidate);
  assert.equal(p.fit_score, 100);
  const t = tailoredResume(resume, p);
  assert.equal(t.summary, "New summary");
  assert.deepEqual(t.skills, ["SQL", "Excel"]);
  assert.equal(t.roles[0].company, "Acme");
  assert.equal(t.roles[0].highlights[0], "Reports for 3 teams");
});
