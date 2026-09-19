import Link from "next/link";
import { getPrimaryDraft, getPrimaryResume } from "@/lib/app/account";
import { getSessionUser } from "@/lib/supabase/app";
import { listSharedWithMe } from "@/lib/app/resume-store";
import { TemplateGallery } from "@/components/app/TemplateGallery";
import { ResumeUpload } from "@/components/app/ResumeUpload";
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
  const [draft, resume, shared] = await Promise.all([
    getPrimaryDraft(),
    getPrimaryResume(),
    listSharedWithMe(user?.email ?? null),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <h1 className="text-[1.38rem] font-semibold tracking-[-0.03em]">Resume</h1>
        <div className="flex items-center gap-4">
          {draft && (
            <Link
              href="/app/resume/builder"
              className="text-[0.85rem] text-ink-50 underline-offset-4 hover:text-ink hover:underline"
            >
              Open the editor
            </Link>
          )}
          <Link
            href="#upload"
            className="rounded-full border border-ink-15 bg-paper px-4 py-2 text-[0.82rem] font-medium transition-colors hover:border-ink"
          >
            Upload resume
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-ink-08 bg-paper p-5 sm:p-6">
        {draft ? (
          <TemplateGallery
            content={draft.content}
            current={draft.template ?? DEFAULT_TEMPLATE}
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
                <BuildDraftButton label="Build it from my resume" />
              </div>
            )}
          </>
        )}
      </section>

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

      <section id="upload" className="rounded-2xl border border-ink-08 bg-paper p-5 sm:p-6">
        <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
          Start from a file
        </h2>
        <p className="mt-2.5 max-w-[62ch] text-[0.88rem] leading-relaxed text-ink-50">
          We read it in your browser, score it, and pull out your skills, titles
          and experience — which is what the templates fill themselves in with.
        </p>
        <div className="mt-5">
          <ResumeUpload hasExisting={Boolean(resume)} />
        </div>
      </section>
    </div>
  );
}
