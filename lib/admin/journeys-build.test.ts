/**
 * How visits become the Journeys funnel and timelines.
 *
 * Run with the others: npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildJourneys, type Event, type View } from "@/lib/admin/journeys-build";

const view = (session: string, path: string, at: string, over: Partial<View> = {}): View => ({
  path,
  session_id: session,
  source: "meta ads",
  medium: "paid",
  campaign: "free-ats",
  city: "Lucknow",
  os: "Android",
  browser: "Instagram app",
  device: "mobile",
  created_at: `2026-10-12T10:${at}:00Z`,
  ...over,
});

const ev = (session: string, event: string, label: string, at: string, extra: Partial<Event> = {}): Event => ({
  event,
  path: null,
  label,
  value: null,
  params: {},
  session_id: session,
  created_at: `2026-10-12T10:${at}:30Z`,
  ...extra,
});

const views = [
  // a: the whole way — sign-up, account, ATS score
  view("a", "/signup", "00"),
  view("a", "/app/tools/ats", "02"),
  // b: saw sign-up, entered a number, left
  view("b", "/signup", "05", { city: "Pune", browser: "Facebook app", os: "iOS" }),
  // c: Google search visitor — not Meta
  view("c", "/blog/x", "06", { source: "google", medium: "organic" }),
  // d: free ATS page, score with no sign-up
  view("d", "/tools/resume-ats-checker", "07"),
];
const events = [
  ev("a", "signup_step", "identify", "00", { params: { method: "phone" } }),
  ev("a", "signup_step", "account_created", "01", { params: { method: "phone" } }),
  ev("a", "tool_compute", "resume-ats-checker", "03", { value: 72 }),
  ev("a", "scroll_depth", "50", "03"),
  ev("b", "signup_step", "identify", "05", { params: { method: "phone" } }),
  ev("d", "tool_compute", "resume-ats-checker", "08", { value: 55 }),
];

test("funnel counts each step on its own, for the chosen source", () => {
  const r = buildJourneys(views, events, "meta");
  assert.equal(r.total, 3);
  assert.deepEqual(
    r.funnel.map((f) => f.visits),
    [3, 2, 2, 1, 2],
  );
  assert.equal(buildJourneys(views, events, "all").total, 4);
});

test("a visit carries where it was seen and how far it got", () => {
  const r = buildJourneys(views, events, "meta");
  const b = r.journeys.find((j) => j.session === "b")!;
  assert.equal(b.city, "Pune");
  assert.equal(b.os, "iOS");
  assert.equal(b.browser, "Facebook app");
  assert.equal(b.furthest, 2);
  const a = r.journeys.find((j) => j.session === "a")!;
  assert.deepEqual(a.reached, [0, 1, 2, 3, 4]);
  assert.deepEqual(
    a.timeline.map((t) => t.text),
    ["/signup", "Entered number", "Created account (number)", "/app/tools/ats", "Got ATS score 72"],
  );
});

test("breakdowns count sign-ins per browser", () => {
  const r = buildJourneys(views, events, "meta");
  assert.deepEqual(r.byBrowser.find((x) => x.key === "Instagram app"), { key: "Instagram app", visits: 2, signedIn: 1 });
  // Newest visit first.
  assert.equal(r.journeys[0].session, "d");
});

test("Meta's ad-review data centres are hidden and counted", () => {
  const r = buildJourneys([...views, view("z", "/signup", "09", { city: "Prineville", os: "Linux" })], events, "meta");
  assert.equal(r.total, 3);
  assert.equal(r.crawlers, 1);
});

test("the template-first page fills the same funnel", () => {
  const v = [view("t", "/build-resume", "10")];
  const e = [
    ev("t", "builder_step", "template_click", "10", { params: { template: "aurora" } }),
    ev("t", "builder_step", "details_submit", "11"),
    ev("t", "builder_step", "account_created", "12"),
    ev("t", "builder_step", "draft_created", "13"),
  ];
  const j = buildJourneys(v, e, "meta").journeys[0];
  assert.deepEqual(j.reached, [0, 1, 2, 3, 4]);
  assert.match(j.timeline[1].text, /aurora/);
});
