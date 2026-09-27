"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * "Useful tools. Free to use." — Figma 165:1909, with the two cards from
 * 165:1943 and 165:1961.
 *
 * The cards stack as you scroll: each one sticks below the header, and the
 * next slides up over it while the one underneath shrinks slightly and lifts
 * — in the design the card behind sits at 0.905 scale, 44px higher.
 *
 * The sticking is plain CSS `position: sticky`; the only thing JavaScript does
 * is write a 0→1 progress number onto each card as the next one closes in, and
 * the transform is expressed in CSS against that number. So the scroll handler
 * touches one custom property and nothing else — no layout reads per frame
 * beyond the two rects, no React re-render on scroll, and the compositor does
 * the actual animating.
 *
 * Below `lg` the stack is dropped: two 460px cards pinned on top of each other
 * on a phone is a way to hide the second one, so there they simply follow each
 * other down the page.
 */
type Tool = {
  id: string;
  title: string;
  kicker: string;
  body: string;
  cta: string;
  href: string;
  img: string;
  /** Which side the picture sits on at desktop. The design alternates. */
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
 * The card face. Figma has it as a photograph (image 33) behind a #e6e6e6
 * fill; until that asset is exported this is a gradient standing in for it,
 * matched to the render — white at the top, warm through the middle, orange
 * along the bottom edge.
 */
const CARD_FACE =
  "radial-gradient(120% 95% at 86% 118%, #ef8730 0%, #f7b34a 26%, rgba(255,255,255,0) 62%)," +
  "radial-gradient(100% 85% at 10% 120%, #f6c445 0%, rgba(255,255,255,0) 56%)," +
  "linear-gradient(180deg, #ffffff 0%, #fffdf7 42%, #fdf2df 100%)";

export function FreeTools() {
  const cards = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const tops = cards.current.map((el) => el?.getBoundingClientRect().top ?? 0);
      cards.current.forEach((el, i) => {
        if (!el) return;
        const next = tops[i + 1];
        if (next === undefined) return;
        // 0 while the next card is still a screen away, 1 once its top has
        // caught up with this one's.
        const from = window.innerHeight * 0.92;
        const to = tops[i];
        const p = from === to ? 0 : (from - next) / (from - to);
        el.style.setProperty("--p", String(Math.min(1, Math.max(0, p))));
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section className="bg-paper pt-16 pb-20 lg:pt-[6vw] lg:pb-[7vw]">
      <div className="mx-auto w-full max-w-[1200px] px-5">
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

        <div className="mt-10 lg:mt-[4vw]">
          {TOOLS.map((t, i) => (
            <div
              key={t.id}
              ref={(el) => {
                cards.current[i] = el;
              }}
              // 40vh of runway before the second card reaches the first.
              className={`@container lg:sticky lg:top-[6.5rem] ${
                i === 0 ? "mb-8 lg:mb-[40vh]" : ""
              }`}
              style={{
                transform:
                  "translateY(calc(-44px * var(--p, 0))) scale(calc(1 - 0.095 * var(--p, 0)))",
                transformOrigin: "top center",
                willChange: "transform",
              }}
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
    </section>
  );
}
