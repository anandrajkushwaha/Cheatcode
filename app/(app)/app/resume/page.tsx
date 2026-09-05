import Link from "next/link";
import { getPrimaryDraft, getResumes } from "@/lib/app/account";
import { ResumeUpload } from "@/components/app/ResumeUpload";
import { TemplateGallery } from "@/components/app/TemplateGallery";
import { Card, Chip, Empty } from "@/components/app/ui";
import { DEFAULT_TEMPLATE, TEMPLATES } from "@/lib/app/resume-templates";

export const dynamic = "force-dynamic";

export default async function ResumePage() {
  const [resumes, draft] = await Promise.all([getResumes(), getPrimaryDraft()]);
  const primary = resumes.find((r) => r.is_primary) ?? resumes[0] ?? null;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">Resume</h1>
      <p className="mt-2.5 max-w-[68ch] text-[0.92rem] leading-relaxed text-ink-50">
        Two things happen when you upload. You get the ATS score — whether the software that opens
        your resume first can actually read it. And we pull out your skills, titles and experience,
        which is what job matching and the agent will use.
      </p>

      <div className="mt-8">
        <ResumeUpload hasExisting={Boolean(primary)} />
      </div>

      {/**
        * The templates, with their own resume in every one.
        *
        * This is the screen, not a side door to it. A gallery of strangers'
        * CVs is what you show somebody who has given you nothing; by the time
        * anybody is here there is a draft seeded from their upload, so each
        * card can show their name and their jobs. Picking one opens the
        * editor on it.
        */}
      {draft && (
        <section className="mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2 className="text-[1.15rem] font-semibold tracking-[-0.02em]">
              Pick a template
            </h2>
            <Link
              href="/app/resume/builder"
              className="text-[0.82rem] text-ink-30 underline-offset-4 hover:text-ink hover:underline"
            >
              Open the editor
            </Link>
          </div>
          <p className="mt-2 max-w-[68ch] text-[0.88rem] leading-relaxed text-ink-50">
            {TEMPLATES.length} layouts, each showing your own resume rather than a stranger&apos;s.
            They differ in type, spacing and colour and in nothing else — one column, real text,
            no icons or tables. The decorative two-column ones are exactly what applicant tracking
            software cannot read.
          </p>

          <div className="mt-7">
            <TemplateGallery
              content={draft.content}
              draftId={draft.id}
              current={draft.template ?? DEFAULT_TEMPLATE}
            />
          </div>
        </section>
      )}

      {/* The way back in for somebody who uploaded weeks ago and is not going
          to upload the same file again just to find the button. */}
      {!draft && primary?.parsed && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-2xl border border-ink-08 p-6">
          <div className="min-w-0">
            <p className="text-[0.98rem] font-medium">
              Rebuild it in a layout the software can read
            </p>
            <p className="mt-1.5 max-w-[52ch] text-[0.85rem] leading-relaxed text-ink-50">
              The same words, arranged so nothing is lost on the way in. Free, and the file you
              uploaded stays exactly as it is.
            </p>
          </div>
          <Link
            href="/app/resume/builder"
            className="shrink-0 rounded-full border border-ink-15 px-4 py-2 text-[0.82rem] font-medium transition-colors hover:border-ink"
          >
            Open the builder
          </Link>
        </div>
      )}

      {primary?.parsed && (
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <Card title="Experience">
            {primary.parsed.roles?.length ? (
              <ol className="space-y-5">
                {primary.parsed.roles.slice(0, 6).map((r, i) => (
                  <li key={i}>
                    <p className="text-[0.95rem] font-medium">{r.title ?? "Role"}</p>
                    <p className="mt-0.5 text-[0.85rem] text-ink-50">
                      {[r.company, [r.start, r.end].filter(Boolean).join(" – ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty>No roles were found in the file.</Empty>
            )}
          </Card>

          <Card title="Skills" note="What job matching will search on.">
            {primary.parsed.skills?.length ? (
              <div className="flex flex-wrap gap-2">
                {primary.parsed.skills.map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
              </div>
            ) : (
              <Empty>No skills were found. A plain, comma-separated skills block helps.</Empty>
            )}
          </Card>
        </div>
      )}

      {resumes.length > 1 && (
        <div className="mt-10">
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            Earlier uploads
          </h2>
          <ul className="mt-4 divide-y divide-ink-08 border-t border-ink-08">
            {resumes.slice(1).map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-4 py-3 text-[0.88rem]">
                <span className="min-w-0 flex-1 truncate">{r.file_name ?? "Resume"}</span>
                <span className="tabular-nums text-ink-50">{r.ats_score ?? "—"}</span>
                <span className="text-[0.78rem] text-ink-30">
                  {new Date(r.created_at).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
