/**
 * The resume built before an account. Run with the others: npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { filledCount, guestStart } from "@/lib/app/guest-resume";
import type { Resume } from "@/lib/app/resume-schema";

const sample = {
  full_name: "Aarav Mehta",
  email: "aarav@example.com",
  phone: "9876543210",
  location: "Pune",
  headline: "Analyst",
  summary: "Sample summary",
  roles: [{ title: "Analyst", company: "Acme", highlights: ["Did a thing"] }],
  skills: ["Excel"],
} as unknown as Resume;

test("the header starts blank, the body is the sample", () => {
  const r = guestStart(sample);
  assert.equal(r.full_name, "");
  assert.equal(r.phone, "");
  assert.equal(r.headline, "Analyst");
});

test("counts fields that are theirs: changed and not empty", () => {
  const start = guestStart(sample);
  assert.equal(filledCount(start, start), 0);
  const now = { ...start, full_name: "Riya", phone: "98765", summary: "Mine", headline: "" } as Resume;
  assert.equal(filledCount(start, now), 3);
  const deeper = { ...start, roles: [{ ...start.roles[0], highlights: ["Mine", "Two"] }] } as Resume;
  assert.equal(filledCount(start, deeper), 2);
});
