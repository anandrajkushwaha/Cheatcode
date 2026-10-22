"use client";

import Link from "next/link";
import { DesignPage, DesignStyles } from "@/components/app/DesignPage";
import { A4 } from "@/lib/app/design";
import { previewDesign } from "@/lib/app/design-sample";
import { TEMPLATES } from "@/lib/app/resume-templates";
import { EVENTS, track } from "@/lib/analytics/events";

/**
 * Free resume templates, on the home page.
 *
 * One of each layout, as the real document (the same DesignPage the builder
 * and the PDF use). A tap opens the builder in that template without an
 * account — the sign-up comes later, once there is a resume worth saving
 * (components/app/builder/GuestBuilder.tsx).
 */

const CARD = 196;
const PAGE_PX = A4.w * (96 / 25.4);

const PICKS = (() => {
  const seen = new Set<string>();
  return TEMPLATES.filter((t) => !seen.has(t.layout) && seen.add(t.layout)).slice(0, 8);
})();

export function ResumeTemplates() {
  return (
    <section className="py-20 sm:py-28" aria-labelledby="free-templates">
      <DesignStyles />
      <div className="container-page">
        <h2 id="free-templates" className="max-w-[22ch] text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.04em]">
          Free resume templates.
          <span className="text-ink-30"> Pick one, start typing.</span>
        </h2>
        <p className="mt-4 max-w-[52ch] text-[1rem] leading-relaxed text-ink-50">
          {TEMPLATES.length} ATS-friendly designs. No sign-up to start — your resume builds as you type, and you
          download it as a PDF.
        </p>
      </div>

      <div className="mt-10 overflow-x-auto pb-4 [scrollbar-width:none]">
        <ul className="container-page flex w-max gap-4">
          {PICKS.map((t) => (
            <li key={t.id} style={{ width: CARD }}>
              <Link
                href={`/resume-builder?template=${t.id}`}
                rel="nofollow"
                onClick={() => track(EVENTS.BUILDER_STEP, { label: "template_click", template: t.id, where: "home" })}
                className="group block"
              >
                <span
                  className="block overflow-hidden rounded-xl border border-ink-08 bg-white transition-all group-hover:-translate-y-1 group-hover:shadow-lg"
                  style={{ height: CARD * (A4.h / A4.w) }}
                >
                  <span className="block origin-top-left" style={{ transform: `scale(${CARD / PAGE_PX})` }}>
                    <DesignPage page={previewDesign(t.id).pages[0]} />
                  </span>
                </span>
                <span className="mt-2 block truncate text-[0.82rem] font-medium">{t.name}</span>
                <span className="block text-[0.74rem] text-ink-30">
                  {t.style} · <span className="text-ink-50 group-hover:text-ink">Use this →</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="container-page mt-6">
        <Link
          href="/resume-templates"
          className="inline-flex rounded-full border border-ink-15 px-5 py-2.5 text-[0.88rem] font-medium transition-colors hover:border-ink"
        >
          See all {TEMPLATES.length} free resume templates →
        </Link>
      </div>
    </section>
  );
}
