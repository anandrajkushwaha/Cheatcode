import { getResumes } from "@/lib/app/account";
import { ResumeUpload } from "@/components/app/ResumeUpload";
import { Card, Chip, Empty } from "@/components/app/ui";

export default async function ResumePage() {
  const resumes = await getResumes();
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
