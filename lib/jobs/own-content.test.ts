/**
 * Matching only reads what the person wrote. Run with the others: npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ownContent } from "@/lib/jobs/own-content";
import { emptyResume, type Resume } from "@/lib/app/resume-schema";

const sample: Resume = {
  ...emptyResume(),
  summary: "Analyst with six years turning data into decisions.",
  skills: ["SQL", "Python", "Looker"],
  roles: [{ title: "Analyst", company: "Meridian", start: null, end: null, is_current: true, highlights: ["Rebuilt the cost model."] }],
};

test("an untouched sample is not theirs", () => {
  const r = ownContent({ ...sample, full_name: "Riya" }, [sample]);
  assert.deepEqual(r.skills, []);
  assert.equal(r.summary, null);
  assert.deepEqual(r.roles, []);
});

test("what they changed is kept", () => {
  const r = ownContent({ ...sample, skills: ["SQL", "Excel"], summary: "Mine.", roles: [{ ...sample.roles[0], company: "Acme", highlights: ["Rebuilt the cost model.", "Ran payroll for 40 staff."] }] }, [sample]);
  assert.deepEqual(r.skills, ["SQL", "Excel"]);
  assert.equal(r.summary, "Mine.");
  assert.deepEqual(r.roles[0].highlights, ["Ran payroll for 40 staff."]);
});
