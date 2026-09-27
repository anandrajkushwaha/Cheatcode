"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * "Useful tools. Free to use." — Figma 165:1909, cards 165:1943 / 165:1961.
 *
 * The section pins. While it is held, the first card rises into place, then
 * the second rises over it and the first settles to 0.905 scale, 44px higher
 * — the arrangement the design shows. Only once that is complete does the
 * page move on.
 *
 * The mechanism is a tall section with a `sticky` screen inside it: the extra
 * height is the scroll budget for the sequence, and how far you are through
 * that budget is the whole animation state. That number is written to the DOM
 * as one custom property per frame, in a rAF-throttled scroll handler, and
 * every transform is expressed in CSS against it. React never re-renders on
 * scroll and the compositor does the moving.
 *
 * None of it runs below `lg`. Pinning a screen and stacking two 460px cards on
 * a phone is how you hide the second card; there they follow each other down
 * the page as ordinary blocks.
 */
type Tool = {
  id: string;
  title: string;
  kicker: string;
  body: string;
  cta: string;
  href: string;
  img: string;
  side: "left" | "right";
  imgBg: string;
};

const TOOLS: Tool[] = [
  {
    id: "ats",
    title: "ATS Resume Checker",
    kicker: "Is your resume ATS-ready?",
    body: "Upload your resume and see how well it performs against ATS-friendly standards — with actionable suggestions to improve it.",
    cta: "Check my resume",
    href: "/tools/resume-ats-checker",
    img: "/home/tool-ats.png",
    side: "left",
    imgBg: "#f3f3f3",
  },
  {
    id: "salary",
    title: "Salary Calculator",
    kicker: "Know what your next move is worth.",
    body: "Calculate your expected take-home, CTC, deductions, and compare different salary offers before you make a move.",
    cta: "Calculate salary",
    href: "/tools/in-hand-salary-calculator",
    img: "/home/tool-salary.png",
    side: "right",
    imgBg: "#dbd3d3",
  },
];

/**
 * Standing in for Figma's image 33 until that asset is exported: white at the
 * top, warm through the middle, orange along the bottom edge.
 */
const CARD_FACE =
  "radial-gradient(120% 95% at 86% 118%, #ef8730 0%, #f7b34a 26%, rgba(255,255,255,0) 62%)," +
  "radial-gradient(100% 85% at 10% 120%, #f6c445 0%, rgba(255,255,255,0) 56%)," +
  "linear-gradient(180deg, #ffffff 0%, #fffdf7 42%, #fdf2df 100%)";

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
/** Fast at first, settling at the end — a card arriving, not a card sliding. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function FreeTools() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sec = section.current;
    const st = stage.current;
    if (!sec || !st) return;

    const desktop = window.matchMedia("(min-width: 1024px)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");

    let frame = 0;
    const update = () => {
      frame = 0;
      if (!desktop.matches || still.matches) {
        // Everything at its resting position; CSS handles the rest.
        st.style.setProperty("--in1", "1");
        st.style.setProperty("--in2", "1");
        st.style.setProperty("--shrink", "1");
        return;
      }
      // Matches the sticky box: it is the viewport minus the header, so the
      // travel available to the pin is shorter by that much too.
      const NAV = 72;
      const budget = sec.offsetHeight - (window.innerHeight - NAV);
      const p = budget <= 0 ? 1 : clamp01((NAV - sec.getBoundingClientRect().top) / budget);

      // The first card arrives, then the second — with a short overlap, so the
      // sequence reads as one movement rather than two.
      st.style.setProperty("--in1", String(easeOut(clamp01(p / 0.4))));
      st.style.setProperty("--in2", String(easeOut(clamp01((p - 0.45) / 0.55))));
      st.style.setProperty("--shrink", String(clamp01((p - 0.45) / 0.55)));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    desktop.addEventListener("change", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      desktop.removeEventListener("change", onScroll);
    };
  }, []);

  return (
    <section ref={section} className="relative bg-paper lg:h-[290vh]">
      {/* The header is 4.5rem of sticky white, so pinning at top-0 parks the
          heading behind it. The pin starts below the header and the screen it
          occupies is short by the same amount. */}
      <div className="flex flex-col items-center px-5 pt-16 pb-20 lg:sticky lg:top-[4.5rem] lg:h-[calc(100svh-4.5rem)] lg:justify-center lg:gap-[3vh] lg:py-0">
        <div className="w-full max-w-[1200px] shrink-0">
          <h2
            className="text-center font-display font-medium tracking-[-0.02em] text-black"
            style={{ fontSize: "clamp(1.9rem, 3.785vw, 3.41rem)", lineHeight: 1.15 }}
          >
            Useful tools. Free to use.
          </h2>
          <p
            className="mx-auto mt-4 max-w-[31.8rem] text-center font-display text-[#7e7e7e]"
            style={{ fontSize: "clamp(1rem, 1.667vw, 1.5rem)", lineHeight: 1.3 }}
          >
            Little tools for the little things that matter in your career.
          </p>
        </div>

        {/* The stage. 505 tall rather than 461 so the card behind has the 44px
            of headroom the design gives it. Clipped, so the cards rise into
            it from below instead of appearing over the heading. */}
        <div
          ref={stage}
          className="mt-10 w-full max-w-[1200px] lg:mt-0 lg:flex lg:min-h-0 lg:flex-1 lg:items-center lg:justify-center"
        >
          <div className="lg:relative lg:h-full lg:max-h-[505px] lg:w-full lg:overflow-hidden lg:[aspect-ratio:1200/505]">
            {TOOLS.map((t, i) => (
              <div
                key={t.id}
                className={`@container ${
                  i === 0 ? "mb-8 lg:mb-0" : ""
                } lg:absolute lg:inset-x-0 lg:bottom-0`}
                style={
                  i === 0
                    ? {
                        // Rises in, then settles back and smaller as the
                        // second card takes the front.
                        transform:
                          "translateY(calc((1 - var(--in1, 1)) * 115% - 44px * var(--shrink, 1))) scale(calc(1 - 0.095 * var(--shrink, 1)))",
                        transformOrigin: "top center",
                        willChange: "transform",
                      }
                    : {
                        transform: "translateY(calc((1 - var(--in2, 1)) * 115%))",
                        willChange: "transform",
                      }
                }
              >
                <div
                  className="overflow-hidden rounded-[16px] border-2 border-[#e4c073] lg:aspect-[1200/461]"
                  style={{ background: CARD_FACE }}
                >
                  <div
                    className={`flex h-full flex-col gap-6 p-6 lg:flex-row lg:items-center lg:gap-[7.08cqw] lg:p-0 lg:pl-[7.17cqw] lg:pt-[4cqw] ${
                      t.side === "right" ? "lg:flex-row-reverse lg:pl-0 lg:pr-[7.17cqw]" : ""
                    }`}
                  >
                    <div
                      className="shrink-0 overflow-hidden rounded-t-[29px] lg:w-[35.58cqw]"
                      style={{ background: t.imgBg }}
                    >
                      <Image
                        src={t.img}
                        alt=""
                        width={427}
                        height={411}
                        sizes="(min-width: 1240px) 427px, 100vw"
                        className="h-auto w-full"
                      />
                    </div>

                    <div className="lg:w-[42cqw]">
                      <h3
                        className="font-display text-black"
                        style={{ fontSize: "clamp(1.6rem, 4cqw, 3rem)", lineHeight: 1.12 }}
                      >
                        {t.title}
                      </h3>
                      <p
                        className="mt-2 font-display text-black lg:mt-[0.92cqw]"
                        style={{ fontSize: "clamp(1.05rem, 2.44cqw, 1.83rem)", lineHeight: 1.2 }}
                      >
                        {t.kicker}
                      </p>
                      <p
                        className="mt-4 font-display text-black lg:mt-[1.58cqw]"
                        style={{ fontSize: "clamp(0.9rem, 1.667cqw, 1.25rem)", lineHeight: 1.35 }}
                      >
                        {t.body}
                      </p>
                      <Link
                        href={t.href}
                        data-ev="cta_click"
                        data-ev-location="free-tools"
                        data-ev-label={t.cta}
                        className="mt-5 inline-flex items-center rounded-[4px] bg-black font-display font-medium tracking-[-0.025em] text-white transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] active:scale-[0.97] lg:mt-[1.58cqw]"
                        style={{
                          fontSize: "clamp(0.85rem, 1.348cqw, 1.01rem)",
                          paddingInline: "clamp(1rem, 2cqw, 1.5rem)",
                          paddingBlock: "clamp(0.5rem, 0.75cqw, 0.5625rem)",
                        }}
                      >
                        {t.cta}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
