import Link from "next/link";
import { PRO_PERKS, PRO_PRICE_LABEL } from "@/lib/studio/plan";

/**
 * The Pro card, built to the Figma.
 *
 * Every asset in that frame — the streaked backdrop, the sparkle bullet, the
 * grey dash, the orange tick, the orb standing in for the O — is a Figma
 * export behind a URL that expires in a week, so none of them can live in the
 * repository. They are redrawn here in CSS and inline SVG at the sizes the
 * design specifies: 12px bullets, 16×2 dashes, 20px ticks, a 56px wordmark on
 * -3px tracking.
 *
 * The backdrop is the one real departure. The design uses a photographic
 * streak texture behind a blur and a 63% #1a1a1a wash; this is a repeating
 * gradient tuned to the same rhythm. It scales to any width without a raster,
 * which the card needs — it is 600px in the frame and full-width in the page.
 *
 * Interaction is deliberately absent. The brief was to match the design as it
 * stands; the animation comes later.
 */
export function ProBlock({ paid }: { paid: boolean }) {
  if (paid) return null;

  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-[#161616]">
      {/* The backdrop: soft vertical bands, then a wash to sink them. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0.035) 16px, rgba(255,255,255,0.085) 28px, rgba(255,255,255,0.02) 42px, rgba(255,255,255,0) 60px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[rgba(26,26,26,0.45)]"
      />

      <div className="relative flex flex-col gap-7 px-6 py-7 sm:px-8 lg:flex-row lg:items-center lg:gap-7">
        {/* ------------------------------------------------------- the pitch */}
        <div className="w-full shrink-0 lg:w-[150px]">
          <p className="text-[0.95rem] font-bold leading-5 text-white">With</p>

          <p className="mt-1.5 flex items-center text-[3.25rem] font-black leading-none tracking-[-3px] text-white">
            PR
            <Orb className="ml-[1px] size-[0.86em]" />
          </p>

          <p className="mt-1.5 text-[0.9rem] font-bold leading-5 text-white">
            you get hired faster
          </p>

          <Link
            href="/studio/upgrade?from=studio-home"
            className="mt-4 flex w-full items-center justify-center rounded-full px-[18px] py-2.5 text-[0.85rem] font-bold leading-[18px] text-[#1a1a1a] transition-opacity hover:opacity-90"
            style={{
              backgroundImage:
                "linear-gradient(135deg, rgb(180,173,173) 0%, rgb(245,245,245) 50%, rgb(163,163,163) 100%)",
            }}
          >
            {PRO_PRICE_LABEL}
          </Link>
        </div>

        <div aria-hidden className="hidden w-px self-stretch bg-white/20 lg:block" />

        {/* ------------------------------------------------ the comparison */}
        <div className="flex min-w-0 flex-1 gap-5 sm:gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-[0.95rem] font-bold leading-5 text-white">
              What you will get
            </p>

            <ul className="mt-5 space-y-4">
              {PRO_PERKS.map((perk) => (
                <li key={perk.title} className="flex items-center gap-1.5">
                  <Sparkle className="size-3 shrink-0 text-[#8f9dfb]" />
                  <span className="truncate text-[0.85rem] font-medium leading-[18px] text-white">
                    {perk.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* "You" — a dash per row, aligned to the list beside it. */}
          <div className="flex shrink-0 flex-col items-center">
            <p className="text-[0.85rem] font-medium leading-[18px] text-white">You</p>
            <div className="mt-[34px] flex flex-col items-center gap-[26px]">
              {PRO_PERKS.map((perk) => (
                <span
                  key={perk.title}
                  className="block h-0.5 w-4 rounded-full bg-white/35"
                  aria-label="Not included"
                />
              ))}
            </div>
          </div>

          {/* "PRO" — the same rows, ticked, inside its own lit panel. */}
          <div className="flex shrink-0 flex-col items-center self-stretch rounded-xl border border-[#d7d7d7] bg-black">
            <div className="flex h-[42px] w-full items-center justify-center rounded-t-xl border-b border-white/10 px-3">
              <span className="flex items-center text-[0.95rem] font-extrabold leading-none text-white">
                PR
                <Orb className="ml-[1px] size-[0.95em]" />
              </span>
            </div>

            <div className="flex w-[55px] flex-1 flex-col items-center gap-[15px] px-2.5 pb-3 pt-4">
              {PRO_PERKS.map((perk) => (
                <Tick key={perk.title} className="size-5 shrink-0 text-[#e8622c]" />
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
        background:
          "radial-gradient(circle at 32% 30%, #ffd9a0, #ff9d4d 45%, #f4703a)",
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
