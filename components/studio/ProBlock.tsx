import Link from "next/link";
import { OrbMark } from "@/components/studio/OrbMark";
import { ProReveal } from "@/components/studio/ProReveal";
import { PRO_PERKS, PRO_PRICE_LABEL } from "@/lib/studio/plan";

/**
 * The Pro card, built to the design.
 *
 * ------------------------------------------------------------- the ground
 *
 * public/pro-bg.png is the artwork from the design, 600x263. It is stretched
 * rather than cropped: the texture is vertical streaks, so widening it just
 * widens the bands, while bg-cover would slice the top and bottom off a card
 * that is nowhere near 600px wide in the page.
 *
 * ------------------------------------------------------------- alignment
 *
 * The three comparison columns — perks, "You" dashes, PRO ticks — are driven
 * by one row height and one header height, declared once below. Giving each
 * column the spacing its own Figma frame carried (16px between perks, 26px
 * between dashes, 15px between ticks) drifted them apart immediately: by the
 * fifth row the tick sat most of a row below its perk. Three lists that read
 * across can only be spaced by one number.
 *
 * The PRO panel is self-stretch, so it runs the full height of those rows and
 * its own header and ticks land on the same lines as the columns beside it —
 * by construction rather than by matched padding.
 *
 * ------------------------------------------------------------- the letter
 *
 * The O is the real orb: the same ai-orb.json the agent plays. See OrbMark.
 * The small one in the panel badge stays a flat gradient — at fifteen pixels
 * the animation is invisible and a second player is not worth its frame.
 *
 * ------------------------------------------------------------- the opening
 *
 * The card greets the person by name before it shows any of this, on every
 * load. That lives in ProReveal; everything below is what it reveals.
 */

/**
 * One row, one header. Every column obeys both.
 *
 * 34px pitch, which is what the design measures: header centre at y39, rows
 * at 84, 118, 152, 186, 220 on a 263px card. Growing these to 40 gave the
 * card breathing room and fifty extra pixels of height, and the height was
 * not the problem — the crowding was horizontal. Air goes sideways from here:
 * padding, column gaps, the space either side of the divider.
 */
const ROW = "h-[34px]";
const HEADER = "h-[38px]";

export function ProBlock({
  paid,
  firstName,
}: {
  paid: boolean;
  /** Just the first name. Null when we have not been told one. */
  firstName: string | null;
}) {
  if (paid) return null;

  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-[#161616]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/pro-bg.png')] bg-[length:100%_100%] bg-no-repeat"
      />

      <ProReveal greeting={firstName ? `Hi ${firstName}` : "Hi there"}>
      <div className="relative flex flex-col gap-7 px-7 py-7 sm:flex-row sm:items-stretch sm:gap-0 sm:px-9 sm:py-7">
        {/* ------------------------------------------------------- the pitch */}
        <div className="flex w-full shrink-0 flex-col justify-center sm:w-[176px]">
          <p className="text-[0.95rem] font-bold leading-5 text-white">With</p>

          {/* The four lines were stacked almost touching. The design puts real
              gaps between them — 15px, 16px, then 32px before the button —
              and that spacing is most of why the block reads as confident. */}
          <p className="mt-3 flex items-center text-[3.4rem] font-black leading-[1.05] tracking-[-3px] text-white">
            PR
            <OrbMark className="ml-px size-[0.72em]" />
          </p>

          <p className="mt-3.5 whitespace-nowrap text-[0.92rem] font-bold leading-5 text-white">
            you get hired faster
          </p>

          <Link
            href="/studio/upgrade?from=studio-home"
            className="mt-7 flex w-full max-w-[184px] items-center justify-center whitespace-nowrap rounded-full px-4 py-2.5 text-[0.88rem] font-bold leading-[18px] text-[#1a1a1a] transition-opacity hover:opacity-90"
            style={{
              backgroundImage:
                "linear-gradient(135deg, rgb(180,173,173) 0%, rgb(245,245,245) 50%, rgb(163,163,163) 100%)",
            }}
          >
            {PRO_PRICE_LABEL}
          </Link>
        </div>

        {/* The divider runs the height of the card and fades at both ends,
            which is what stops it reading as a table rule. */}
        <div
          aria-hidden
          className="mx-7 hidden w-px shrink-0 self-stretch sm:mx-9 sm:block"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(196,164,132,0) 0%, rgba(214,186,156,0.85) 22%, rgba(214,186,156,0.85) 78%, rgba(196,164,132,0) 100%)",
          }}
        />

        {/* ------------------------------------------------ the comparison */}
        <div className="flex min-w-0 flex-1 items-stretch gap-5 overflow-x-auto sm:gap-7">
          <div className="min-w-0 flex-1">
            <p
              className={`flex items-center whitespace-nowrap text-[1rem] font-bold text-white ${HEADER}`}
            >
              What you will get
            </p>
            <ul>
              {PRO_PERKS.map((perk) => (
                <li key={perk.title} className={`flex items-center gap-2.5 ${ROW}`}>
                  <Sparkle className="size-3.5 shrink-0 text-[#8f9dfb]" />
                  <span className="whitespace-nowrap text-[0.9rem] font-medium text-white">
                    {perk.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="shrink-0">
            <p
              className={`flex items-center justify-center whitespace-nowrap text-[0.9rem] font-medium text-white/90 ${HEADER}`}
            >
              You
            </p>
            {PRO_PERKS.map((perk) => (
              <div key={perk.title} className={`flex items-center justify-center ${ROW}`}>
                <span
                  className="block h-0.5 w-[18px] rounded-full bg-[#9aa0c4]"
                  aria-label="Not included"
                />
              </div>
            ))}
          </div>

          {/* One continuous panel — no rule under the badge, and an amber edge
              rather than a grey one, as drawn. */}
          <div className="flex shrink-0 flex-col self-stretch rounded-[18px] border border-[#c8822f] bg-black">
            <div className={`flex items-center justify-center px-3 ${HEADER}`}>
              <span className="flex items-center text-[1rem] font-extrabold leading-none text-white">
                PR
                <SolidOrb className="ml-px size-[0.9em]" />
              </span>
            </div>

            <div className="w-[58px]">
              {PRO_PERKS.map((perk) => (
                <div key={perk.title} className={`flex items-center justify-center ${ROW}`}>
                  <Tick className="size-[19px] text-[#d2662a]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      </ProReveal>
    </section>
  );
}

/* --------------------------------------------------------------- the bits */

/** The badge-sized orb. Flat on purpose — see the note at the top. */
function SolidOrb({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full ${className}`}
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
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="m4.5 12.5 5 5L19.5 7" />
    </svg>
  );
}
