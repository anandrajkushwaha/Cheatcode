/**
 * The match score on job cards. Run with the others: npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { hasSkill, matchJob, type Candidate } from "@/lib/jobs/match";

const me: Candidate = {
  skills: ["React", "JS", "Excel"],
  text: "built dashboards in power bi and wrote sql queries. node.js apis.",
  years: 2,
  cities: ["Bengaluru"],
  remote: false,
  targetRole: "Frontend Developer",
};

test("skills count from the list, aliases, or the resume's text", () => {
  assert.equal(hasSkill(me, "JavaScript"), true);
  assert.equal(hasSkill(me, "Power BI"), true);
  assert.equal(hasSkill(me, "Node.js"), true);
  assert.equal(hasSkill(me, "SQL"), true);
  assert.equal(hasSkill(me, "Python"), false);
  // Whole words only: "go" is not in "google".
  assert.equal(hasSkill({ ...me, text: "used google sheets" }, "Go"), false);
});

test("a close fit scores high and names what is missing", () => {
  const m = matchJob(me, {
    title: "Frontend Developer",
    skills: ["React", "JavaScript", "TypeScript"],
    years_min: 1,
    years_max: 3,
    cities: ["Bengaluru"],
    is_remote: false,
  });
  assert.deepEqual(m.missing, ["TypeScript"]);
  assert.ok(m.score >= 80 && m.score < 100, String(m.score));
});

test("a poor fit scores low; no data scores zero", () => {
  const m = matchJob(me, {
    title: "Data Scientist",
    skills: ["Python", "TensorFlow", "Statistics"],
    years_min: 6,
    years_max: 9,
    cities: ["Pune"],
    is_remote: false,
  });
  assert.ok(m.score < 20, String(m.score));
  const none = matchJob({ skills: [], text: "", years: null, cities: [], remote: false, targetRole: null }, {
    title: "X", skills: [], years_min: null, years_max: null, cities: [], is_remote: false,
  });
  assert.equal(none.score, 0);
});
