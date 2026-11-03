import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/supabase/app";
import { getProfile } from "@/lib/app/account";
import { hasAtsUnlimited } from "@/lib/jobs/unlocks";
import { analyseResume, type ResumeFacts } from "@/lib/tools/ats";
import { findContact } from "@/lib/tools/contact";
import { decide, hashText, record, type Who } from "@/lib/tools/ats-gate";

export const dynamic = "force-dynamic";

/**
 * The ATS checker's scorer. The file is still read in the browser; what
 * arrives here is the text and the page facts extract.ts recovered, and
 * nothing of it is stored except a hash (lib/tools/ats-gate.ts).
 *
 * The score is computed here, not in the browser, so the daily limit is real:
 * when the check is locked, the response carries no score, no verdict and no
 * findings — there is nothing in the page to inspect. The browser only learns
 * the result once the person has today's free check, or the ₹49 unlock.
 */

const DEVICE_COOKIE = "cc_dev";
const YEAR = 365 * 86_400;

function facts(b: Record<string, unknown>): ResumeFacts | null {
  const text = typeof b.text === "string" ? b.text : "";
  if (text.replace(/\s/g, "").length < 60 || text.length > 120_000) return null;
  const fileType = b.fileType === "pdf" || b.fileType === "docx" || b.fileType === "txt" ? b.fileType : null;
  if (!fileType) return null;
  const pages = Number.isInteger(b.pages) ? Math.max(1, Math.min(50, b.pages as number)) : 1;
  const charsPerPage = Array.isArray(b.charsPerPage)
    ? (b.charsPerPage as unknown[]).slice(0, 50).map((n) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : 0))
    : [text.length];
  const multiColumnPages = Number.isInteger(b.multiColumnPages) ? Math.max(0, Math.min(pages, b.multiColumnPages as number)) : 0;
  return { text, fileType, pages, charsPerPage, multiColumnPages };
}

const str = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const f = facts(b);
  if (!f) return Response.json({ ok: false, error: "That file didn't have enough text to check." }, { status: 400 });

  const jar = await cookies();
  let device = jar.get(DEVICE_COOKIE)?.value ?? null;
  if (!device || !/^[0-9a-f-]{36}$/.test(device)) {
    device = randomUUID();
    jar.set(DEVICE_COOKIE, device, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: YEAR });
  }

  const user = await getSessionUser().catch(() => null);
  const contact = findContact(f.text);
  const who: Who = {
    userId: user?.id ?? null,
    visitor: str(b.visitor, 64),
    device,
    email: contact.email,
    phone: contact.phone,
  };

  const unlimited = user ? await hasAtsUnlimited(user.id, user.email ?? null, await getProfile()) : false;
  const textHash = hashText(f.text);
  const outcome = await decide(who, textHash, unlimited);

  if (outcome === "locked") {
    await record(who, textHash, "locked", null);
    return Response.json({ ok: true, locked: true, signedIn: Boolean(user) });
  }

  const result = analyseResume(f);
  await record(who, textHash, outcome, result.score);
  return Response.json({ ok: true, locked: false, outcome, result });
}
