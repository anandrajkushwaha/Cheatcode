"use client";

import Link from "next/link";
import { TemplateGallery } from "@/components/app/TemplateGallery";
import { EVENTS, track } from "@/lib/analytics/events";

/**
 * The ad's way in: templates first, then the builder — with no account in
 * the way. A tap opens the guest builder (/resume-builder, GuestBuilder.tsx)
 * in that template; the whole resume is written there, kept in the browser,
 * and sign-in is asked for only at Download, after which the PDF downloads
 * on its own and the matching jobs follow.
 *
 * This used to ask for name, number, email, city and a password before the
 * editor opened — most people who tapped a template left at that form.
 */
export function BuildResume() {
  function pick(template: string) {
    track(EVENTS.BUILDER_STEP, { label: "template_click", template, where: "build-resume" });
    window.location.assign(`/resume-builder?template=${encodeURIComponent(template)}`);
  }

  return (
    <div className="min-h-dvh bg-paper">
      <header className="container-page flex items-center justify-between py-5">
        <Link href="/" className="text-[0.95rem] font-semibold tracking-[-0.04em]">
          Cheatcode
        </Link>
        <Link href="/signin?next=/app/resume" className="text-[0.82rem] text-ink-50 hover:text-ink">
          <span className="hidden sm:inline">Already have an account? </span>Sign in
        </Link>
      </header>

      <main className="container-page pb-20">
        <div className="max-w-[44rem] pt-4 sm:pt-8">
          <h1 className="text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.04em] sm:text-[2.5rem]">
            Pick a template.
            <span className="text-ink-30"> Your resume is ready in 10 minutes.</span>
          </h1>
          <p className="mt-4 text-[0.98rem] leading-relaxed text-ink-50">
            Free, ATS-friendly designs. Tap one to start — you can switch any time.
          </p>
          <ol className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8rem] text-ink-50">
            <li>
              <span className="font-semibold text-ink">1</span> Choose a template
            </li>
            <li>
              <span className="font-semibold text-ink">2</span> Fill it in — no sign-up
            </li>
            <li>
              <span className="font-semibold text-ink">3</span> Download
            </li>
          </ol>
        </div>

        <section className="mt-8">
          <TemplateGallery current={null} onPick={pick} />
        </section>
      </main>
    </div>
  );
}
