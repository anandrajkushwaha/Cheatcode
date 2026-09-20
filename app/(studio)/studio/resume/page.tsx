import Link from "next/link";
import { getPrimaryDraft, getPrimaryResume, getProfile, isPaid } from "@/lib/app/account";
import { getMyReview } from "@/lib/app/resume-review";
import { ResumeActions } from "@/components/studio/ResumeActions";
import { ProTeaser } from "@/components/studio/ProTeaser";
import { getSessionUser } from "@/lib/supabase/app";
import { listSharedWithMe } from "@/lib/app/resume-store";
import { TemplateGallery } from "@/components/app/TemplateGallery";
import { BuildDraftButton } from "@/components/app/ResumeBuilderActions";
import { DEFAULT_TEMPLATE } from "@/lib/app/resume-templates";

/**
 * Resume, as one screen instead of three.
 *
 * The audit's loudest UI finding was that a single job — get a resume that
 * works — was split across Resume, Builder and Templates in the top nav, so
 * the person had to know which of the three held the thing they wanted. Here
 * the gallery is the page, the editor is a link beside the heading, and the
 * upload sits at the bottom as the door you use once.
 *
 * The gallery, the upload and the build button are /app's own components,
 * reused rather than rebuilt. They already talk to the right endpoints, and a
 * second implementation of the template picker is two things to keep in step
 * for the rest of the product's life.
 */
export default async function StudioResumePage() {
  const user = await getSessionUser();
  const [draft, resume, shared, profile] = await Promise.all([
    getPrimaryDraft(),
    getPrimaryResume(),
    listSharedWithMe(user?.email ?? null),
    getProfile(),
  ]);

  const paid = isPaid(profile);
  // Only fetched for somebody who can actually have one — a free account has
  // no review to report on, and asking is a query for nothing.
  const review = paid && user ? await getMyReview(user.id) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="text-[1.38rem] font-semibold tracking-[-0.03em]">Resume</h1>
          {/* The two actions, at the top, where somebody arriving with a file
              can see them. Both open a dialog — see ResumeActions. */}
          <div className="mt-3">
            <ResumeActions
              paid={paid}
              review={review}
              defaultRole={profile?.interview_role ?? profile?.target_roles?.[0] ?? null}
              email={profile?.email ?? user?.email ?? null}
              hasDocument={Boolean(resume || draft)}
            />
          </div>
        </div>

        {draft && (
          <Link
            href="/studio/resume/builder"
            className="shrink-0 rounded-full border border-ink-15 bg-paper px-4 py-2 text-[0.82rem] font-medium transition-colors hover:border-ink"
          >
            Open the editor
          </Link>
        )}
      </div>

      <section className="rounded-2xl border border-ink-08 bg-paper p-5 sm:p-6">
        {draft ? (
          <TemplateGallery
            content={draft.content}
            current={draft.template ?? DEFAULT_TEMPLATE}
            basePath="/studio"
          />
        ) : (
          <>
            <p className="max-w-[58ch] text-[0.87rem] leading-relaxed text-ink-50">
              {resume
                ? "Build your document first, and every template will show your own resume in it — your name, your jobs, your bullets — rather than a stranger's."
                : "Upload a resume to start. Every template shows your own document, so there has to be one."}
            </p>
            {resume && (
              <div className="mt-6">
                <BuildDraftButton label="Build it from my resume" basePath="/studio" />
              </div>
            )}
          </>
        )}
      </section>

      {/* Free accounts get the offer instead of the button. Paid accounts get
          the button, which lives in the header above. */}
      {!paid && (
        <ProTeaser
          from="resume-review"
          eyebrow="Pro"
          title="Have a person read your resume"
          detail="Not a score and not a checklist — someone reads it against the job you are applying for and writes back."
          points={[
            "A real person reads it, not a parser",
            "Written against the exact role you are applying for",
            "Emailed back to you, usually within two working days",
          ]}
        />
      )}

      {/* Documents somebody else shared. Kept below their own work rather than
          mixed into it — a list where "my resume" and "a resume I was shown"
          look alike is how somebody edits the wrong document. */}
      {shared.length > 0 && (
        <section className="rounded-2xl border border-ink-08 bg-paper p-5 sm:p-6">
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            Shared with you
          </h2>
          <ul className="mt-4 space-y-2">
            {shared.map((s) => (
              <li key={s.shareId}>
                <Link
                  href={s.role === "edit" ? `/r/${s.shareId}/edit` : `/r/${s.shareId}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-ink-08 px-4 py-3 transition-colors hover:border-ink-30"
                >
                  <span className="min-w-0 truncate text-[0.9rem] font-medium">{s.title}</span>
                  <span className="shrink-0 text-[0.78rem] text-ink-30">
                    {s.role === "edit" ? "You can edit" : "You can view"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}
