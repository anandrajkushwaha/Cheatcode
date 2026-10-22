/**
 * The resume somebody builds before they have an account (/resume-builder).
 *
 * It opens on the template's sample with the header left blank, so the first
 * thing they type is their own name and number — which is also what the
 * account needs when the sign-up sheet asks for it. The sheet appears once
 * they have filled a few fields: enough to have something worth saving.
 *
 * Pure: npm test runs it.
 */
import type { Resume } from "@/lib/app/resume-schema";

/** Fields filled before the sign-up sheet first opens on its own. */
export const GATE_AT = 3;

export function guestStart(sample: Resume): Resume {
  return { ...sample, full_name: "", email: "", phone: "", location: "" };
}

function leaves(v: unknown, path: string, out: Map<string, string>) {
  if (typeof v === "string") out.set(path, v.trim());
  else if (Array.isArray(v)) v.forEach((x, i) => leaves(x, `${path}.${i}`, out));
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) leaves(x, `${path}.${k}`, out);
  }
}

/** How many text fields now hold something of theirs: changed from the start and not empty. */
export function filledCount(start: Resume, now: Resume): number {
  const a = new Map<string, string>();
  const b = new Map<string, string>();
  leaves(start, "", a);
  leaves(now, "", b);
  let n = 0;
  for (const [k, v] of b) if (v && a.get(k) !== v) n += 1;
  return n;
}
