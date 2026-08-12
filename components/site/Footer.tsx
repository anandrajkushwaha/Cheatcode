import { SITE } from "@/lib/seo/constants";

export function Footer() {
  return (
    <footer className="border-t border-ink-08 py-14">
      <div className="container-page">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.95rem] font-semibold tracking-[-0.04em]">
              {SITE.name}
            </p>
            <p className="mt-2 max-w-[34ch] text-[0.85rem] leading-relaxed text-ink-50">
              Mentorship for people at the start of it all. Built in India.
            </p>
          </div>

          <div className="text-[0.85rem] text-ink-50">
            <a
              href="mailto:hello@cheatcodeapp.com"
              className="transition-colors hover:text-ink"
            >
              hello@cheatcodeapp.com
            </a>
          </div>
        </div>

        <p className="mt-12 text-[0.8rem] text-ink-30">
          © {new Date().getFullYear()} {SITE.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
