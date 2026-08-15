import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { Breadcrumbs } from "@/components/content/bits";

export const metadata: Metadata = buildMetadata({
  title: "Free Career Tools for Indian Job Seekers | Cheatcode",
  description:
    "Free tools for Indian job seekers — a resume ATS checker and an in-hand salary calculator. Everything runs in your browser. No signup, nothing stored.",
  path: "/tools",
});

const TOOLS = [
  {
    slug: "resume-ats-checker",
    name: "Resume ATS checker",
    tagline:
      "Upload the resume you're already sending and see what the software reads — with the exact weak points costing you interviews.",
    meta: "score · parse check · weak points",
  },
  {
    slug: "in-hand-salary-calculator",
    name: "In-hand salary calculator",
    tagline:
      "Turn the CTC on your offer letter into the number that reaches your bank account.",
    meta: "PF · gratuity · professional tax · income tax",
  },
];

export default function ToolsHub() {
  return (
    <div className="container-page py-12 sm:py-16">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Free tools" }]} />

      <h1 className="mt-6 max-w-[16ch] text-[length:var(--text-display)] font-semibold leading-[1.02]">
        Free tools.
        <span className="text-ink-30"> No login, no catch.</span>
      </h1>
      <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-ink-70">
        Everything runs in your browser. Nothing you type is sent anywhere or stored.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <Link
            key={t.slug}
            href={`/tools/${t.slug}`}
            className="group rounded-3xl border border-ink-08 p-8 transition-colors hover:border-ink-30"
          >
            <p className="text-[1.2rem] font-medium tracking-[-0.02em]">{t.name}</p>
            <p className="mt-2.5 text-[0.95rem] leading-relaxed text-ink-50">{t.tagline}</p>
            <p className="mt-5 text-[0.75rem] uppercase tracking-wider text-ink-30">{t.meta}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
