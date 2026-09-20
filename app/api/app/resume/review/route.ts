import { getSessionUser } from "@/lib/supabase/app";
import { getProfile, getPrimaryResume, getPrimaryDraft, isPaid } from "@/lib/app/account";
import { requestReview } from "@/lib/app/resume-review";

export const dynamic = "force-dynamic";

/**
 * Ask a person to read your resume.
 *
 * Pro only, checked here rather than only on the screen — the screen decides
 * what to show, this decides what is allowed, and those have to be two
 * different sentences or a crafted POST is a free review.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });

  const profile = await getProfile();
  if (!isPaid(profile)) {
    return Response.json(
      { ok: false, error: "Resume review is part of Pro.", upgrade: true },
      { status: 402 },
    );
  }

  let body: { targetRole?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Could not read that." }, { status: 400 });
  }

  const targetRole = (body.targetRole ?? "").trim();
  const note = (body.note ?? "").trim();

  if (targetRole.length < 2) {
    return Response.json(
      { ok: false, error: "Tell us the role you are aiming at — the review is written against it." },
      { status: 400 },
    );
  }

  const [resume, draft] = await Promise.all([getPrimaryResume(), getPrimaryDraft()]);

  // Nothing to read is the one failure worth catching before it reaches a
  // reviewer, who would otherwise open an empty queue item.
  if (!resume && !draft) {
    return Response.json(
      { ok: false, error: "Upload a resume or build one first — there is nothing to review yet." },
      { status: 400 },
    );
  }

  const created = await requestReview({
    userId: user.id,
    email: profile?.email ?? user.email ?? null,
    fullName: profile?.full_name ?? null,
    resumeId: resume?.id ?? null,
    draftId: draft?.id ?? null,
    targetRole,
    note,
  });

  if (!created.ok) return Response.json({ ok: false, error: created.error }, { status: 400 });
  return Response.json({ ok: true });
}
