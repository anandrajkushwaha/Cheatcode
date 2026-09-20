import { getSessionUser, createAppAdminClient } from "@/lib/supabase/app";
import { getProfile, getPrimaryResume, getPrimaryDraft, isPaid } from "@/lib/app/account";
import { requestReview } from "@/lib/app/resume-review";
import { checkRole } from "@/lib/app/role-check";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Ask a person to read your resume.
 *
 * Pro only, checked here rather than only on the screen — the screen decides
 * what to show, this decides what is allowed, and those have to be two
 * different sentences or a crafted POST is a free review.
 *
 * Multipart, because the request can carry the document itself. The earlier
 * version pointed at the stored resume, which is only ever text: a reviewer
 * got the words and none of the layout, and half of what is wrong with a
 * resume is only visible in the PDF.
 */

const BUCKET = "resume-files";
const MAX_BYTES = 10 * 1024 * 1024;

// Deliberately not a general file list. These four are what a resume arrives
// as; anything else is either a mistake or somebody testing what we accept.
const ALLOWED = new Map([
  ["application/pdf", "pdf"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/msword", "doc"],
  ["text/plain", "txt"],
]);

const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  Response.json({ ok: false, error, ...extra }, { status });

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return bad("Sign in first.", 401);

  const profile = await getProfile();
  if (!isPaid(profile)) {
    return bad("Resume review is part of Pro.", 402, { upgrade: true });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("Could not read that request.");
  }

  const targetRole = String(form.get("targetRole") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();

  if (targetRole.length < 2) {
    return bad("Tell us the role you are aiming at — the review is written against it.");
  }

  const verdict = await checkRole(targetRole, user.id);
  if (!verdict.ok) return bad(verdict.error, 422);

  const [resume, draft] = await Promise.all([getPrimaryResume(), getPrimaryDraft()]);
  const file = form.get("file");
  const hasFile = file instanceof File && file.size > 0;

  /**
   * The file is required. It used to be optional, falling back to whatever
   * was saved on the account — and that fallback was the bug: somebody with
   * an old, half-parsed row could send a request with nothing attached, and
   * a reviewer opened a queue item with no document in it.
   *
   * Asking for the file makes the request unambiguous. It is also the thing
   * being reviewed: the PDF they actually send, not our reconstruction of it.
   */
  if (!hasFile) {
    return bad("Attach the resume you want reviewed — we review the file, not a saved copy.");
  }

  let filePath: string | null = null;
  let fileName: string | null = null;

  {
    if (file.size > MAX_BYTES) {
      return bad(`That file is ${(file.size / 1048576).toFixed(1)}MB. Keep it under 10MB.`);
    }

    const ext = ALLOWED.get(file.type);
    if (!ext) {
      return bad(`${file.type || "That file type"} isn't allowed. Send a PDF, DOCX or TXT.`);
    }

    const db = createAppAdminClient();
    if (!db) return bad("Not configured.", 503);

    // Foldered by user id so a listing of the bucket is grouped by person,
    // and stamped so a second request never overwrites the first one's file.
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await db.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) {
      const missing = /bucket/i.test(error.message) && /not found|does not exist/i.test(error.message);
      return bad(
        missing
          ? "File uploads aren't set up yet. Send it without the attachment and we'll read your saved resume."
          : "Could not upload that file. Try again.",
        502,
      );
    }

    filePath = path;
    fileName = file.name.slice(0, 200);
  }

  const created = await requestReview({
    userId: user.id,
    email: profile?.email ?? user.email ?? null,
    fullName: profile?.full_name ?? null,
    resumeId: resume?.id ?? null,
    draftId: draft?.id ?? null,
    targetRole,
    note,
    filePath,
    fileName,
  });

  if (!created.ok) return bad(created.error);
  return Response.json({ ok: true });
}
