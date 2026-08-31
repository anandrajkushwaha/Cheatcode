import { getProfile, getPrimaryResume, isPaid } from "@/lib/app/account";
import { Card, Empty, PaidOnly } from "@/components/app/ui";

export default async function JobsPage() {
  const [profile, resume] = await Promise.all([getProfile(), getPrimaryResume()]);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">Jobs</h1>
      <p className="mt-2.5 max-w-[68ch] text-[0.92rem] leading-relaxed text-ink-50">
        Not built yet. This will pull openings from company job boards — Greenhouse, Lever, Ashby —
        and Adzuna India, then rank them against your resume rather than just listing them.
      </p>

      <div className="mt-8">
        <PaidOnly
          paid={isPaid(profile)}
          feature="Jobs ranked by where you actually have a chance, with the reason spelled out."
        >
          <Card>
            <Empty>
              {resume
                ? "Your resume is ready, so matching has something to work with. This screen is next in the build."
                : "Add your resume first — matching reads from it."}
            </Empty>
          </Card>
        </PaidOnly>
      </div>
    </>
  );
}
