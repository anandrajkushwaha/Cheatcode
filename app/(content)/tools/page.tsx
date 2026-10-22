import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { Breadcrumbs } from "@/components/content/bits";
import { TemplateFan } from "@/components/site/TemplateFan";

export const metadata: Metadata = buildMetadata({
  title: "Free Career Tools for Indian Job Seekers | Cheatcode",
  description:
    "Free tools for Indian job seekers — 60 free resume templates, a resume ATS checker and an in-hand salary calculator.",
  path: "/tools",
});

type Tool = {
  href: string;
  kicker: string;
  name: string;
  body: string;
  points: string[];
  cta: string;
  /** A picture from the home page's tool cards, or the live template fan. */
  img: string | null;
};

const TOOLS: Tool[] = [
  {
    href: "/resume-templates",
    kicker: "Resume builder",
    name: "Free resume templates",
    body: "Pick one of 60 ATS-friendly designs and start typing. Your resume builds as you go.",
    points: ["60 templates", "Live preview", "PDF download"],
    cta: "Browse templates",
    img: null,
  },
  {
    href: "/tools/resume-ats-checker",
    kicker: "Is your resume ATS-ready?",
    name: "Resume ATS checker",
    body: "See what the software reads in the resume you're already sending — and the exact lines costing you interviews.",
    points: ["ATS score", "Parse check", "Weak points"],
    cta: "Check my resume",
    img: "/home/tool-ats.png",
  },
  {
    href: "/tools/in-hand-salary-calculator",
    kicker: "Know what your offer is worth",
    name: "In-hand salary calculator",
    body: "Turn the CTC on your offer letter into the number that reaches your bank account every month.",
    points: ["PF & gratuity", "Old vs new regime", "Monthly in-hand"],
    cta: "Calculate salary",
    img: "/home/tool-salary.png",
  },
];

export default function ToolsHub() {
  return (
    <div className="container-page py-12 sm:py-16">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Free tools" }]} />

      <h1 className="mt-6 max-w-[16ch] text-[length:var(--text-display)] font-semibold leading-[1.02]">
        Free tools.
        <span className="text-ink-30"> For every step of the job hunt.</span>
      </h1>
      <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-ink-70">
        Build the resume, check it before you send it, and know what the offer is really worth.
      </p>

      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            data-ev="cta_click"
            data-ev-location="tools-hub"
            className="group flex flex-col overflow-hidden rounded-[1.5rem] border border-ink-08 bg-paper transition-all duration-300 hover:-translate-y-1 hover:border-ink-15 hover:shadow-[0_24px_50px_-24px_rgba(0,0,0,0.25)]"
          >
            <div className="relative aspect-[427/411] overflow-hidden bg-[#1d2a3a]">
              {t.img ? (
                <Image
                  src={t.img}
                  alt=""
                  fill
                  quality={90}
                  sizes="(min-width: 1024px) 380px, (min-width: 768px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <>
                  <Image
                    src="/signin-bg.webp"
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 380px, (min-width: 768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <TemplateFan />
                </>
              )}
            </div>

            <div className="flex flex-1 flex-col p-6 sm:p-7">
              <p className="text-[0.78rem] font-medium text-ink-30">{t.kicker}</p>
              <h2 className="mt-1.5 text-[1.35rem] font-semibold leading-tight tracking-[-0.02em]">{t.name}</h2>
              <p className="mt-2.5 text-[0.93rem] leading-relaxed text-ink-50">{t.body}</p>

              <ul className="mt-5 flex flex-wrap gap-1.5">
                {t.points.map((p) => (
                  <li key={p} className="rounded-full bg-ink-04 px-2.5 py-1 text-[0.74rem] text-ink-70">
                    {p}
                  </li>
                ))}
              </ul>

              <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-[0.9rem] font-medium">
                {t.cta}
                <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
