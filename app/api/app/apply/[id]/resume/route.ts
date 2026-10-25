import { getSessionUser } from "@/lib/supabase/app";
import { getApplication, linkDraft } from "@/lib/jobs/applications";
import { getApplicant } from "@/lib/jobs/candidate";
import { tailoredResume } from "@/lib/jobs/apply-pack";
import { createTailoredDraft, getDraftById, makePrimary } from "@/lib/app/resume-store";

export const dynamic = "force-dynamic";

/**
 * The tailored resume as a real draft, so it downloads as a PDF the same
 * way every resume does. Made once per application; `edit` also makes it the
 * resume the builder opens.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { edit?: unknown };

  const application = await getApplication(id);
  if (!application?.pack) return Response.json({ ok: false, error: "Prepare the application first." }, { status: 404 });

  try {
    let draftId = application.draft_id;
    if (!draftId || !(await getDraftById(draftId, user.id))) {
      const applicant = await getApplicant();
      if (!applicant.resume) return Response.json({ ok: false, error: "Add your resume first." }, { status: 409 });
      const draft = await createTailoredDraft(
        user.id,
        applicant.draft,
        tailoredResume(applicant.resume, application.pack),
        `${application.company} — ${application.title}`,
      );
      draftId = draft.id;
      await linkDraft(user.id, application.id, draftId);
    }
    if (body.edit === true) await makePrimary(user.id, draftId);
    return Response.json({ ok: true, draftId });
  } catch (e) {
    console.error("apply/resume:", String(e).slice(0, 300));
    return Response.json({ ok: false, error: "Couldn't make the tailored resume. Try again." }, { status: 500 });
  }
}
