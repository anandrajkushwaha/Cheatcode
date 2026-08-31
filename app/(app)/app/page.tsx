import Link from "next/link";
import { getProfile, getPrimaryResume, isPaid, profileGaps } from "@/lib/app/account";
import { Card, Empty, ScoreRing, Stat } from "@/components/app/ui";

export default async function AppHome() {
  const [profile, resume] = await Promise.all([getProfile(), getPrimaryResume()]);
  const paid = isPaid(profile);
  const gaps = profileGaps(profile, resume);
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">
        {firstName ? `Hello, ${firstName}` : "Hello"}
      </h1>
      <p className="mt-2.5 max-w-[64ch] text-[0.92rem] leading-relaxed text-ink-50">
        {resume
          ? "Your resume is in. Jobs and the agent are being built next — they will read from it."
          : "Start with your resume. Everything else here is built on top of it."}
      </p>

      {/* -------------------------------------------------- what to do next */}
      {gaps.length > 0 && (
        <div className="mt-7 rounded-2xl border border-ink-15 p-6">
          <p className="text-[0.72rem] uppercase tracking-[0.16em] text-ink-30">Next</p>
          <ul className="mt-4 space-y-3">
            {gaps.map((g) => (
              <li key={g.key}>
                <Link
                  href={g.href}
                  className="text-[0.95rem] underline underline-offset-4 hover:text-ink"
                >
                  {g.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="ATS score"
          value={resume?.ats_score ?? "—"}
          hint={resume ? resume.file_name ?? "your resume" : "no resume yet"}
        />
        <Stat
          label="Skills found"
          value={resume?.skills?.length ?? "—"}
          hint={resume?.parsed ? "used for matching" : "upload to see"}
        />
        <Stat
          label="Experience"
          value={
            resume?.years_experience !== null && resume?.years_experience !== undefined
              ? `${resume.years_experience} yr`
              : "—"
          }
          hint={resume?.latest_title ?? "from your resume"}
        />
        <Stat
          label="Plan"
          value={paid ? "Pro" : "Free"}
          hint={paid ? "all features on" : "agent and matching are paid"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Your resume"
          action={{ label: resume ? "Open" : "Add", href: "/app/resume" }}
        >
          {resume ? (
            <div className="flex flex-wrap items-center gap-6">
              <ScoreRing score={resume.ats_score ?? 0} />
              <div className="min-w-0 flex-1">
                <p className="text-[1rem] font-medium">
                  {resume.parsed?.headline ?? resume.file_name ?? "Resume"}
                </p>
                <p className="mt-1.5 text-[0.88rem] text-ink-50">
                  {[resume.latest_title, resume.latest_company].filter(Boolean).join(" at ") ||
                    "Details still being read"}
                </p>
                {resume.parse_error && (
                  <p className="mt-2 text-[0.8rem] text-ink-30">
                    We saved it but could not read the details.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <Empty>
              Nothing here yet. Upload a resume and you will get an ATS score plus the structured
              profile that job matching runs on.
            </Empty>
          )}
        </Card>

        <Card title="Coming next">
          <ul className="space-y-3.5 text-[0.88rem]">
            <li className="flex items-baseline justify-between gap-3">
              <span>Jobs across boards</span>
              <span className="shrink-0 text-[0.75rem] text-ink-30">in build</span>
            </li>
            <li className="flex items-baseline justify-between gap-3">
              <span>Match scoring</span>
              <span className="shrink-0 text-[0.75rem] text-ink-30">after jobs</span>
            </li>
            <li className="flex items-baseline justify-between gap-3">
              <span>Voice agent</span>
              <span className="shrink-0 text-[0.75rem] text-ink-30">after matching</span>
            </li>
          </ul>
          <p className="mt-5 border-t border-ink-08 pt-4 text-[0.8rem] leading-relaxed text-ink-30">
            Each one reads the resume above, which is why it comes first.
          </p>
        </Card>
      </div>
    </>
  );
}
