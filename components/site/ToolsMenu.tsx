"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

export const TOOLS = [
  {
    href: "/tools/resume-ats-checker",
    name: "Resume ATS checker",
    blurb: "Upload your resume and see the score — and what's costing you it.",
  },
  {
    href: "/tools/in-hand-salary-calculator",
    name: "In-hand salary calculator",
    blurb: "What the CTC on your offer letter actually pays you each month.",
  },
];

/**
 * The free-tools menu.
 *
 * Opens on hover for a mouse and on click for touch, which is the pair of
 * behaviours people actually expect. Hover-only would strand every phone user;
 * click-only would feel sticky on a desktop. A short close delay keeps the
 * panel from vanishing while the pointer crosses the gap to reach it.
 */
export function ToolsMenu({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  // Close on outside click and on Escape — both expected of any menu.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => cancelClose, []);

  const trigger =
    variant === "dark"
      ? "text-white/60 hover:text-white"
      : "text-ink-50 hover:text-ink";

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 whitespace-nowrap text-[0.8rem] transition-colors ${trigger}`}
      >
        Free tools
        <svg
          aria-hidden="true"
          viewBox="0 0 10 6"
          className={`size-2 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>

      <div
        id={panelId}
        // Kept mounted so the fade works in both directions; pointer-events are
        // dropped while hidden so it can never swallow a click.
        className={`absolute left-1/2 top-full z-50 w-[330px] -translate-x-1/2 pt-3 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0"
        }`}
      >
        <div className="overflow-hidden rounded-2xl border border-ink-08 bg-paper/95 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              onClick={() => setOpen(false)}
              data-ev="nav_click"
              data-ev-location="tools-menu"
              data-ev-label={t.name}
              className="block border-b border-ink-08 p-4 transition-colors last:border-b-0 hover:bg-ink-04"
            >
              <p className="text-[0.9rem] font-medium tracking-[-0.01em] text-ink">
                {t.name}
              </p>
              <p className="mt-1 text-[0.8rem] leading-relaxed text-ink-50">{t.blurb}</p>
            </Link>
          ))}

          <Link
            href="/tools"
            onClick={() => setOpen(false)}
            data-ev="nav_click"
            data-ev-location="tools-menu"
            data-ev-label="All free tools"
            className="block bg-ink-04 px-4 py-3 text-[0.8rem] text-ink-50 transition-colors hover:text-ink"
          >
            All free tools →
          </Link>
        </div>
      </div>
    </div>
  );
}
