/**
 * What the ATS checker reads as somebody's contact details.
 *
 * Run with the others: npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { findContact } from "@/lib/tools/contact";

test("a typical Indian resume header", () => {
  const text = [
    "RIYA SHARMA",
    "Lucknow, Uttar Pradesh | +91 98765-43210 | Riya.Sharma@Gmail.com",
    "linkedin.com/in/riya-sharma-01",
    "",
    "PROFESSIONAL SUMMARY",
    "Data analyst with 3 years of experience.",
  ].join("\n");
  assert.deepEqual(findContact(text), {
    name: "Riya Sharma",
    email: "riya.sharma@gmail.com",
    phone: "+919876543210",
    linkedin: "https://linkedin.com/in/riya-sharma-01",
  });
});

test("a heading above the name is skipped", () => {
  const c = findContact("Curriculum Vitae\nAmit Kumar Verma\nMobile: 09123456789\nEmail: amit@x.in");
  assert.equal(c.name, "Amit Kumar Verma");
  assert.equal(c.phone, "+919123456789");
  assert.equal(c.email, "amit@x.in");
});

test("nothing found is null, not a guess", () => {
  const c = findContact("Experience\n2019-2024 Infosys, Pune\nSkills: SQL, Excel 1234567");
  assert.deepEqual(c, { name: null, email: null, phone: null, linkedin: null });
});

test("years and pin codes are not phone numbers", () => {
  assert.equal(findContact("Pune 411001\n2019 2020 2021").phone, null);
});
