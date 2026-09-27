"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * "Nobody gives you the rulebook" — Figma 174:4221, with the three panels
 * from 174:4238 / 174:4245 / 174:4253.
 *
 * Three things are worth knowing about how this is built.
 *
 * The aurora behind it is a video, and it only runs while somebody is looking
 * at it. An IntersectionObserver starts it when a quarter of the section is on
 * screen and pauses it the moment it leaves, so it is not burning a decode
 * loop at the bottom of the page. The file has had its audio track stripped
 * out rather than relying on `muted` — the sound is never wanted, and a track
 * that does not exist cannot be turned on. It also sits behind a poster frame
 * so the section never flashes black.
 *
 * The panels slide as one track rather than cross-fading. All three are in the
 * DOM and the track is moved by a transform, which the compositor handles on
 * its own thread — no layout, no repaint, no stutter on a mid-range phone. The
 * two hidden panels are marked `inert`, so their buttons stay out of the tab
 * order and out of a screen reader's way.
 *
 * The green underline is measured from whichever tab is active instead of
 * being a fixed width, so it keeps matching the word above it after a font
 * loads or the viewport changes.
 */

type Panel = {
  id: string;
  tab: string;
  /** The headline, split where the design turns green. */
  head: [string, string];
  body: string;
  cta: string;
  href: string;
  img: string;
};

const PANELS: Panel[] = [
  {
    id: "build",
    tab: "Build better",
    head: ["Your resume is your first impression. ", "Make it count."],
    body: "Build an ATS-ready resume that puts your best work forward - with smarter guidance, better structure, and templates that actually look good.",
    cta: "Build your resume",
    href: "/signin?next=/app/resume",
    img: "/home/panel-build.png",
  },
  {
    id: "practice",
    tab: "Practice smarter",
    head: ["The interview shouldn't be ", "your first practice."],
    body: "Simulate the real thing with AI-powered mock interviews, get instant feedback, and sharpen your answers before it matters.",
    cta: "Practice now",
    href: "/signin?next=/app/interviews",
    img: "/home/panel-practice.png",
  },
  {
    id: "move",
    tab: "Move faster",
    head: ["You don't need another tab. You need a ", "next move."],
    body: "Cheatcode brings together the tools and insights to help you figure out what comes next - and get there faster.",
    cta: "See what's next",
    href: "/signin?next=/app/agent",
    img: "/home/panel-move.png",
  },
];

export function Rulebook() {
  const [active, setActive] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [bar, setBar] = useState({ left: 0, width: 0 });

  // ------------------------------------------------------------ the video
  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video) return;

    // Somebody who has asked their system not to animate things should not be
    // handed a looping video; they keep the poster frame.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Autoplay can still be refused (low power mode, for one). There is
          // nothing to recover from — the poster stays.
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(section);
    return () => io.disconnect();
  }, []);

  // ------------------------------------------------------- the underline
  const measure = useCallback(() => {
    const el = tabsRef.current[active];
    if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const ro = new ResizeObserver(measure);
    const row = tabsRef.current[0]?.parentElement;
    if (row) ro.observe(row);
    // A late-loading font changes the width of every tab.
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <section
      ref={sectionRef}
      className="relative isolate overflow-hidden bg-[#fff9f2] py-16 lg:py-[6.5vw]"
    >
      <video
        ref={videoRef}
        className="absolute inset-0 -z-20 size-full object-cover"
        poster="/home/aurora-poster.jpg"
        preload="auto"
        muted
        loop
        playsInline
        aria-hidden="true"
        tabIndex={-1}
      >
        <source src="/home/aurora.mp4" type="video/mp4" />
      </video>

      {/* Darkens the top so the white headline holds against a bright aurora. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-[44%] bg-gradient-to-b from-[#07302f] to-transparent"
      />

      <div className="mx-auto w-full max-w-[1200px] px-5">
        <h2
          className="max-w-[56ch] font-display font-medium tracking-[-0.02em] text-white"
          style={{ fontSize: "clamp(1.9rem, 3.785vw, 3.41rem)", lineHeight: 1.12 }}
        >
          Nobody gives you the rulebook
        </h2>
        <p
          className="mt-3 font-display text-white"
          style={{ fontSize: "clamp(1.15rem, 2.273vw, 2.05rem)", lineHeight: 1.25 }}
        >
          So we&rsquo;re building the Cheatcode.
        </p>

        {/* ------------------------------------------------------- tabs */}
        <div className="relative mt-8 lg:mt-[4vw]">
          <div
            role="tablist"
            aria-label="What Cheatcode does"
            className="relative flex gap-7 overflow-x-auto pb-[0.36vw] sm:gap-10 lg:gap-[3.4vw] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {PANELS.map((p, i) => (
              <button
                key={p.id}
                ref={(el) => {
                  tabsRef.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`rulebook-tab-${p.id}`}
                aria-selected={active === i}
                aria-controls={`rulebook-panel-${p.id}`}
                onClick={() => setActive(i)}
                className={`shrink-0 whitespace-nowrap font-display transition-colors duration-300 ${
                  active === i ? "font-medium text-white" : "text-[#b9baba] hover:text-white"
                }`}
                style={{ fontSize: "clamp(0.95rem, 1.667vw, 1.5rem)" }}
              >
                {p.tab}
              </button>
            ))}

            <span
              aria-hidden="true"
              className="absolute bottom-0 h-[5px] rounded-full bg-[#14c896] transition-[left,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ left: bar.left, width: bar.width }}
            />
          </div>
          <div aria-hidden="true" className="h-px w-full bg-white/25" />
        </div>

        {/* ----------------------------------------------------- panels */}
        <div className="mt-6 overflow-hidden rounded-[8px] lg:mt-[2.15vw]">
          <div
            className="flex transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translateX(-${active * 100}%)` }}
          >
            {PANELS.map((p, i) => (
              <div
                key={p.id}
                id={`rulebook-panel-${p.id}`}
                role="tabpanel"
                aria-labelledby={`rulebook-tab-${p.id}`}
                // Keeps the off-screen CTAs out of the tab order and out of
                // the accessibility tree without unmounting them.
                inert={active !== i ? true : undefined}
                className="@container w-full shrink-0"
              >
                <div className="relative overflow-hidden rounded-[8px] border border-white bg-black lg:aspect-[1200/477]">
                  <Image
                    src={p.img}
                    alt=""
                    width={1200}
                    height={478}
                    sizes="(min-width: 1240px) 1200px, 100vw"
                    className="h-auto w-full lg:absolute lg:inset-0 lg:size-full lg:object-cover"
                    priority={i === 0}
                  />

                  <div className="bg-white p-6 lg:absolute lg:left-[3.75%] lg:top-[12.58%] lg:h-[74.4%] lg:w-[46.17%] lg:rounded-[4px] lg:p-0">
                    <div className="lg:absolute lg:inset-x-[7.1%] lg:top-[8%]">
                      <h3
                        className="font-display font-medium text-black"
                        style={{
                          fontSize: "clamp(1.25rem, 3.07cqw, 2.31rem)",
                          lineHeight: 1.15,
                        }}
                      >
                        {p.head[0]}
                        <span className="font-semibold text-[#0aa314]">{p.head[1]}</span>
                      </h3>
                      <p
                        className="mt-4 font-display text-[#7e7e7e] lg:mt-[4.2%]"
                        style={{ fontSize: "clamp(0.9rem, 1.667cqw, 1.25rem)", lineHeight: 1.35 }}
                      >
                        {p.body}
                      </p>
                      <Link
                        href={p.href}
                        data-ev="cta_click"
                        data-ev-location="rulebook"
                        data-ev-label={p.cta}
                        className="mt-6 inline-flex items-center rounded-[4px] bg-black font-display font-medium tracking-[-0.025em] text-white transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] active:scale-[0.97] lg:mt-[7%]"
                        style={{
                          fontSize: "clamp(0.85rem, 1.348cqw, 1.01rem)",
                          paddingInline: "clamp(1rem, 2cqw, 1.5rem)",
                          paddingBlock: "clamp(0.5rem, 0.75cqw, 0.5625rem)",
                        }}
                      >
                        {p.cta}
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
