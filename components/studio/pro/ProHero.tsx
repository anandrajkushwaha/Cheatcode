import { OrbMark } from "@/components/studio/OrbMark";
import { PayButton } from "@/components/studio/PayButton";

/**
 * The hero.
 *
 * Two images, both supplied rather than drawn: pro-hero-bg.png is the dark
 * curtain (1512x378, opaque) and pro-hero-people.png is the cut-out pair
 * (634x378, transparent). The three feature chips — Career Agent, Mock
 * Interview, AI Resume Builder — are baked into that second file, so they are
 * deliberately not re-drawn here. Redrawing them would put two versions of
 * the same label on the page, one of which would drift.
 *
 * In the design the pair sits at x=670 of 1512 with the text column starting
 * at x=196, which is the left edge of the 1120 content container. That is why
 * the inner container below is 1120 and the figure is pinned to its right.
 *
 * Below lg the pair drops under the text rather than shrinking into it: a
 * 4:1 band is a decoration on a laptop and an unreadable sliver on a phone.
 */

export function ProHero({
  live,
  name,
  email,
  contact,
}: {
  live: boolean;
  name: string | null;
  email: string | null;
  contact: string | null;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-[#0a0a0d]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/pro-hero-bg.png"
        alt=""
        aria-hidden
        width={3024}
        height={756}
        className="absolute inset-0 size-full object-cover"
      />

      <div className="relative mx-auto w-full max-w-[1120px] px-4 sm:px-6 lg:h-[378px] lg:px-0">
        <div className="pb-8 pt-10 sm:pt-12 lg:absolute lg:left-0 lg:top-[84px] lg:pb-0 lg:pt-0">
          <h1 className="flex flex-wrap items-center gap-x-[19px] gap-y-1 text-white">
            <span className="text-[2.4rem] font-bold leading-[1.1] tracking-[-1px] sm:text-[3rem] lg:text-[3.5rem]">
              Cheatcode
            </span>
            {/* The O is the product's own orb, the same one the agent button
                plays — not a circle that resembles it. */}
            <span className="flex items-center text-[2.4rem] font-bold leading-none tracking-[-3px] sm:text-[3rem] lg:text-[3.5rem]">
              PR
              <OrbMark className="ml-[2px] size-[0.84em]" />
            </span>
          </h1>

          <p className="mt-2 text-[1.15rem] font-medium leading-[1.4] text-white sm:text-[1.4rem] lg:mt-[10px] lg:text-[1.72rem]">
            Build. Apply. Prepare.
          </p>

          <div className="mt-6 lg:mt-[46px]">
            {live ? (
              <PayButton label="Unlock Pro ₹99" name={name} email={email} contact={contact} />
            ) : (
              <p className="max-w-[40ch] text-[0.85rem] leading-relaxed text-white/70">
                Payments are not switched on yet.
              </p>
            )}
          </div>
        </div>

        {/* The supplied art is 2x the layout size (1268x756 into a 634x378 slot),
            which is what keeps it sharp on a retina screen. The declared width
            and height are the file's real ones, so the box is reserved at the
            right ratio before the image arrives. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/pro-hero-people.png"
          alt="Two Cheatcode members"
          width={1268}
          height={756}
          className="mx-auto block w-full max-w-[520px] lg:absolute lg:bottom-0 lg:right-[12px] lg:mx-0 lg:h-[378px] lg:w-auto lg:max-w-none"
        />
      </div>
    </section>
  );
}
