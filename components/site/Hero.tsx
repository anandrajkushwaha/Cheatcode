import Image from "next/image";
import Link from "next/link";

/**
 * The hero, as drawn in Figma (node 165:3910).
 *
 * Three lines over a photograph, one button, nothing else — the phone
 * cluster and the second "I already have an account" link are not in the
 * design and have been removed rather than tucked somewhere.
 *
 * Everything is sized in vw against the 1440px frame and then clamped, so
 * the composition holds its proportions at any width instead of snapping
 * between breakpoints: 74.822px of a 1440px frame is 5.196vw, 34.334px is
 * 2.384vw, and the type keeps that ratio to the photograph all the way up.
 * The clamps are what stop it becoming unreadable on a phone and absurd on
 * a 27-inch monitor.
 */
export function Hero() {
  return (
    <section id="top" className="relative isolate overflow-hidden bg-black">
      {/* The frame's own proportions on desktop; taller on a phone so the
          desk and the horizon both survive the crop. */}
      <div className="relative min-h-[34rem] w-full sm:min-h-0 sm:aspect-[1440/861]">
        <Image
          src="/hero-bg.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-[50%_60%] sm:object-center"
        />

        <div className="absolute inset-x-0 top-[22%] flex flex-col items-center px-5 text-center sm:top-[24%]">
          <p
            className="font-display font-medium leading-[normal] text-white"
            style={{ fontSize: "clamp(1.15rem, 2.384vw, 2.15rem)" }}
          >
            You have a
          </p>

          <p
            className="font-display font-medium leading-[normal] tracking-[-0.02em] text-white"
            style={{ fontSize: "clamp(2.6rem, 5.196vw, 4.68rem)" }}
          >
            Cheatcode
          </p>

          <p
            className="font-display font-medium leading-[normal] tracking-[-0.025em] text-white"
            style={{ fontSize: "clamp(2.6rem, 5.196vw, 4.68rem)" }}
          >
            for your <span className="font-serif font-bold italic">career.</span>
          </p>

          <Link
            href="/signin"
            data-ev="cta_click"
            data-ev-location="hero"
            data-ev-label="Get Started"
            className="mt-[3vw] inline-flex items-center justify-center rounded-full bg-black font-display font-medium tracking-[-0.025em] text-white transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] active:scale-[0.97]"
            style={{
              fontSize: "clamp(1rem, 1.478vw, 1.33rem)",
              paddingInline: "clamp(1.75rem, 3.2vw, 2.9rem)",
              paddingBlock: "clamp(0.65rem, 1.05vw, 0.95rem)",
            }}
          >
            Get Started
          </Link>
        </div>
      </div>
    </section>
  );
}
