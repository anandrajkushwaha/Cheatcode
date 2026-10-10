/**
 * How "Email or phone number" is read.
 *
 * Run with the others: npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { parseIdentifier, phoneLoginEmail } from "@/lib/auth/identifier";

test("an email is lower-cased and kept", () => {
  assert.deepEqual(parseIdentifier("  Riya@Example.com "), {
    kind: "email",
    email: "riya@example.com",
    display: "riya@example.com",
  });
});

test("Indian mobile numbers in the forms people type", () => {
  for (const raw of ["9876543210", "98765 43210", "+91 98765-43210", "919876543210", "09876543210"]) {
    const id = parseIdentifier(raw);
    assert.equal(id?.kind, "phone", raw);
    assert.equal(id?.kind === "phone" && id.phone, "+919876543210", raw);
    assert.equal(id?.email, "919876543210@phone.cheatcodeapp.com", raw);
    assert.equal(id?.display, "+91 98765 43210", raw);
  }
});

test("rubbish and look-alikes are refused", () => {
  for (const raw of ["", "abc", "12345", "1234567890", "riya@", "x@phone.cheatcodeapp.com"]) {
    assert.equal(parseIdentifier(raw), null, raw);
  }
});

test("the login address is stable for a number", () => {
  assert.equal(phoneLoginEmail("+919876543210"), "919876543210@phone.cheatcodeapp.com");
});
