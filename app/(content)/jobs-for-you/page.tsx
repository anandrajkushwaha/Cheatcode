import Link from "next/link";
import type { Metadata } from "next";
import { AtsChecker } from "@/components/tools/AtsChecker";
import { SITE } from "@/lib/seo/constants";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 3600;

/**
 * Where the email campaigns land: "add your resume, see the jobs that fit
 * it". The upload is the existing ATS checker, unchanged — it scores the
 * resume and, when the resume genuinely fits open jobs, opens the same match
 * popup as everywhere else (₹49 / ₹99). This page only frames that step.
 *
 * Not for search: it is a landing page for links we send, so it stays out of
 * the index and the sitemap. Visits arrive with utm_source=email and the
 * campaign name, which Journeys and Traffic already read.
 */
export const metadata: Metadata = {
  title: "Jobs that match your resume | Cheatcode",
  description: "Add your resume and see the open jobs it fits, before everyone else applies.",
  alternates: { canonical: `${SITE.url}/jobs-for-you` },
  robots: { index: false, follow: true },
};

async function openJobs(): Promise<number | null> {
  const db = createPublicClient();
  if (!db) return null;
  const { count } = await db.from("jobs").select("id", { count: "exact", head: true }).eq("is_active", true);
  return count ?? null;
}

export default async function JobsForYou() {
  const jobs = await openJobs();
  return (
    <>
      <div className="container-page pt-10 sm:pt-14">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#fff4ec] px-3 py-1 text-[0.8rem] font-semibold text-[#c2410c]">
          <span className="inline-block h-2 w-2 rounded-full bg-[#22c55e]" />
          Only for you · based on your resume
        </span>
        <h1 className="mt-5 max-w-[18ch] text-[clamp(2rem,4.8vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
          Upload your resume. <span className="text-[#c2410c]">See your best-match jobs instantly.</span>
        </h1>
        <p className="mt-5 max-w-[50ch] text-lg leading-relaxed text-ink-70">
          We read your resume and show the open jobs it fits best, with your match score. Free, in 30 seconds.
        </p>
        <p className="mt-4 text-[0.8rem] text-ink-30">
          {jobs ? `${jobs.toLocaleString("en-IN")} live jobs · ` : ""}Free · No sign-up for the score · File never uploaded
        </p>
      </div>

      <div className="container-page mt-10">
        <AtsChecker />
      </div>

      <div className="container-page mt-16 max-w-[68ch]">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["1", "Add your resume", "PDF or Word, the one you already send."],
            ["2", "See your matches", "Open jobs scored against your skills and experience."],
            ["3", "Apply early", "Unlock the company and apply link while the post is fresh."],
          ].map(([n, t, d]) => (
            <div key={n} className="rounded-2xl border border-ink-08 p-5">
              <p className="text-[0.75rem] font-semibold text-[#c2410c]">Step {n}</p>
              <p className="mt-2 font-semibold">{t}</p>
              <p className="mt-1 text-[0.88rem] leading-relaxed text-ink-50">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-[0.9rem] text-ink-50">
          No resume ready?{" "}
          <Link href="/resume-templates" className="font-medium text-ink underline underline-offset-4">
            Make one free in 10 minutes
          </Link>{" "}
          and come back.
        </p>
      </div>
      <div className="h-24" />
    </>
  );
}
