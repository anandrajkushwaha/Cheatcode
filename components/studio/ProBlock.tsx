import Link from "next/link";
import { PRO_PERKS, PRO_PRICE_LABEL } from "@/lib/studio/plan";

/**
 * The Pro card, built to the Figma.
 *
 * ------------------------------------------------------------- alignment
 *
 * The three comparison columns — the perks, the "You" dashes, the PRO ticks —
 * are driven by one row height and one header height, declared once below.
 * The first attempt gave each column the spacing its own Figma frame carried
 * (16px gaps between perks, 26px between dashes, 15px between ticks) and the
 * rows drifted apart immediately: by the fifth perk the tick was most of a
 * row too low. Three lists that must read across can only be spaced by the
 * same number.
 *
 * ------------------------------------------------------------- the assets
 *
 * Every asset in that frame — the streaked backdrop, the sparkle bullet, the
 * grey dash, the orange tick, the orb standing in for the O — is a Figma
 * export behind a URL that expires in a week, so none can live in the repo.
 * They are redrawn in CSS and inline SVG at the sizes the design specifies.
 *
 * The backdrop is the one real departure: the design uses a photographic
 * streak texture under a blur and a #1a1a1a wash, this is a repeating
 * gradient tuned to the same rhythm. It scales to any width without a raster,
 * which the card needs — 600px in the frame, fluid in the page.
 *
 * Interaction is deliberately absent; the animation comes later.
 */

/** One row, one header. Every column obeys both. */
const ROW = "h-9";
const HEADER = "h-11";

export function ProBlock({ paid }: { paid: boolean }) {
  if (paid) return null;

  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-[#161616]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0.035) 16px, rgba(255,255,255,0.085) 28px, rgba(255,255,255,0.02) 42px, rgba(255,255,255,0) 60px)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[rgba(26,26,26,0.45)]" />

      <div className="relative flex flex-col gap-6 px-5 py-6 sm:flex-row sm:items-center sm:gap-5 sm:px-6">
        {/* ------------------------------------------------------- the pitch */}
        <div className="w-full shrink-0 sm:w-[150px]">
          <p className="text-[0.95rem] font-bold leading-5 text-white">With</p>

          <p className="mt-1 flex items-center text-[3.25rem] font-black leading-none tracking-[-3px] text-white">
            PR
            <Orb className="ml-px size-[0.86em]" />
          </p>

          <p className="mt-2 whitespace-nowrap text-[0.9rem] font-bold leading-5 text-white">
            you get hired faster
          </p>

          <Link
            href="/studio/upgrade?from=studio-home"
            className="mt-4 flex w-full items-center justify-center whitespace-nowrap rounded-full px-4 py-2.5 text-[0.85rem] font-bold leading-[18px] text-[#1a1a1a] transition-opacity hover:opacity-90"
            style={{
              backgroundImage:
                "linear-gradient(135deg, rgb(180,173,173) 0%, rgb(245,245,245) 50%, rgb(163,163,163) 100%)",
            }}
          >
            {PRO_PRICE_LABEL}
          </Link>
        </div>

        <div aria-hidden className="hidden w-px self-stretch bg-white/20 sm:block" />

        {/* ------------------------------------------------ the comparison */}
        <div className="flex min-w-0 flex-1 items-start gap-4 overflow-x-auto pl-0 sm:gap-5 sm:pl-2">
          {/* the perks */}
          <div className="min-w-0 flex-1">
            <p
              className={`flex items-center whitespace-nowrap text-[0.95rem] font-bold text-white ${HEADER}`}
            >
              What you will get
            </p>
            <ul>
              {PRO_PERKS.map((perk) => (
                <li key={perk.title} className={`flex items-center gap-1.5 ${ROW}`}>
                  <Sparkle className="size-3 shrink-0 text-[#8f9dfb]" />
                  <span className="whitespace-nowrap text-[0.85rem] font-medium text-white">
                    {perk.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* "You" — a dash per row */}
          <div className="shrink-0">
            <p
              className={`flex items-center justify-center whitespace-nowrap text-[0.85rem] font-medium text-white ${HEADER}`}
            >
              You
            </p>
            <div>
              {PRO_PERKS.map((perk) => (
                <div key={perk.title} className={`flex items-center justify-center ${ROW}`}>
                  <span
                    className="block h-0.5 w-4 rounded-full bg-white/35"
                    aria-label="Not included"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* "PRO" — the same rows, ticked, in its own lit panel */}
          <div className="shrink-0 overflow-hidden rounded-xl border border-[#d7d7d7] bg-black">
            <div
              className={`flex items-center justify-center border-b border-white/10 px-3 ${HEADER}`}
            >
              <span className="flex items-center text-[0.95rem] font-extrabold leading-none text-white">
                PR
                <Orb className="ml-px size-[0.95em]" />
              </span>
            </div>

            <div className="w-[55px]">
              {PRO_PERKS.map((perk) => (
                <div key={perk.title} className={`flex items-center justify-center ${ROW}`}>
                  <Tick className="size-[18px] text-[#e8622c]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- the bits */

/** The brand orb, standing in for the O. A gradient, so it stays sharp. */
function Orb({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block rounded-full ${className}`}
      style={{
        background: "radial-gradient(circle at 32% 30%, #ffd9a0, #ff9d4d 45%, #f4703a)",
      }}
    />
  );
}

function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 2.5 13.7 9 20 11.5 13.7 14 12 21.5 10.3 14 4 11.5 10.3 9Z" />
    </svg>
  );
}

function Tick({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="m4.5 12.5 5 5L19.5 7" />
    </svg>
  );
}
