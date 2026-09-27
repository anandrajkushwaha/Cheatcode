import Image from "next/image";
import Link from "next/link";

/**
 * The hero, as drawn in Figma (node 165:3910).
 *
 * The frame is 1440×861 in total and the navigation sits *inside* it: the
 * photograph starts at the very top of the page and the opaque white bar
 * covers its first 72px. Rendering the bar above the photograph instead made
 * the section 933px tall, which pushed the desk out of the fold — hence the
 * negative top margin, which pulls the photograph back up behind the bar.
 *
 * Positions are percentages of that 861px frame and type is sized in vw
 * against its 1440px width, so the whole composition keeps its proportions
 * at any viewport instead of snapping between breakpoints. The numbers:
 *
 *   "You have a"        34.334px, centred at y=230.61   →  2.384vw
 *   "Cheatcode"         74.822px, centred at y=291.11   →  5.196vw
 *   "for your career."  74.822px, centred at y=365.76   →  5.196vw
 *   button              200×50,   top y=427.6
 *
 * Two of those gaps tell you the leading: the display lines' centres are
 * 74.65px apart at a 74.822px size, so their line-height is 1, not "normal".
 * Stacking them at normal leading is what makes the block look loose.
 */
const NAV_H = "4.5rem";

export function Hero() {
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden bg-black"
      style={{ marginTop: `calc(-1 * ${NAV_H})` }}
    >
      <div className="relative min-h-[36rem] w-full sm:min-h-0 sm:aspect-[1440/861]">
        <Image
          src="/hero-bg.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-[50%_58%] sm:object-center"
        />

        {/* 207.4 / 861 — the top of the first line's box, so its centre lands
            on the 230.61 the design puts it at. */}
        <div className="absolute inset-x-0 top-[28%] flex flex-col items-center px-5 text-center sm:top-[24.09%]">
          <p
            className="font-display font-medium text-white"
            style={{ fontSize: "clamp(1.15rem, 2.384vw, 2.15rem)", lineHeight: 1.35 }}
          >
            You have a
          </p>

          <p
            className="font-display font-medium tracking-[-0.02em] text-white"
            style={{ fontSize: "clamp(2.4rem, 5.196vw, 4.68rem)", lineHeight: 1 }}
          >
            Cheatcode
          </p>

          <p
            className="font-display font-medium tracking-[-0.025em] text-white"
            style={{ fontSize: "clamp(2.4rem, 5.196vw, 4.68rem)", lineHeight: 1 }}
          >
            for your <span className="font-serif font-bold italic">career.</span>
          </p>

          <Link
            href="/signin"
            data-ev="cta_click"
            data-ev-location="hero"
            data-ev-label="Get Started"
            className="inline-flex items-center justify-center rounded-full bg-black font-display font-medium tracking-[-0.025em] text-white transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] active:scale-[0.97]"
            style={{
              marginTop: "clamp(1rem, 1.68vw, 1.5rem)",
              width: "clamp(11rem, 13.89vw, 12.5rem)",
              height: "clamp(3rem, 3.47vw, 3.125rem)",
              fontSize: "clamp(1rem, 1.478vw, 1.33rem)",
            }}
          >
            Get Started
          </Link>
        </div>
      </div>
    </section>
  );
}
