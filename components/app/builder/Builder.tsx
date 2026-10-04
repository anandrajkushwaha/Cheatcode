"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Resume } from "@/lib/app/resume-schema";
import type { DocStyle, Presentation } from "@/lib/app/resume-style";
import { fontStack } from "@/lib/app/resume-style";
import { templateById } from "@/lib/app/resume-templates";
import { FlowDoc } from "@/components/app/flow/FlowDoc";
import { DesignPanel } from "@/components/app/builder/DesignPanel";
import * as S from "@/components/app/builder/sections";

/**
 * The builder: a form on the left, the real document on the right.
 *
 * One copy of the content. The form writes a `Resume`, the preview renders
 * that same object, and the save sends it — nothing anywhere keeps a second
 * version that can drift. That is the rule the old editor broke, and it is
 * why a résumé edited on the canvas stopped matching the résumé the rest of
 * the product thought it had.
 *
 * `design` is never sent. The column is left exactly as it was, so the PDF
 * and every share link behave today the way they behaved yesterday.
 */
type SectionKey = "personal" | "summary" | "experience" | "education" | "skills" | "projects" | "extras";

const SECTIONS: { key: SectionKey; label: string; blurb: string; next?: string }[] = [
  { key: "personal", label: "Personal", blurb: "Your name, and the two ways somebody reaches you.", next: "Summary" },
  { key: "summary", label: "Summary", blurb: "The three lines read before anything else.", next: "Experience" },
  { key: "experience", label: "Experience", blurb: "What you did — and what changed because you did it.", next: "Education" },
  { key: "education", label: "Education", blurb: "Qualifications, newest first.", next: "Skills" },
  { key: "skills", label: "Skills", blurb: "The words a recruiter's search actually matches.", next: "Projects" },
  { key: "projects", label: "Projects", blurb: "Work that is yours to show, not your employer's.", next: "More" },
  { key: "extras", label: "More", blurb: "Certificates, and anything you won." },
];

/** Enough of a section to count as done. Drives the rail ticks and the %. */
function filled(r: Resume, k: SectionKey): boolean {
  switch (k) {
    case "personal": return Boolean(r.full_name && (r.email || r.phone));
    case "summary": return (r.summary ?? "").trim().length > 40;
    case "experience": return r.roles.some((x) => x.title && x.highlights.some((h) => h.trim()));
    case "education": return r.education.some((x) => x.degree || x.institution);
    case "skills": return r.skills.length >= 3;
    case "projects": return r.projects.some((x) => x.name);
    case "extras": return r.certifications.length > 0 || r.achievements.length > 0;
  }
}

/** 210mm at 96dpi. The page's true width in CSS pixels. */
const PAGE_PX = 210 * (96 / 25.4);

export function Builder({
  draftId,
  initial,
  templateId,
  initialStyles,
  initialPhoto,
  title,
}: {
  draftId: string;
  initial: Resume;
  templateId: string;
  initialStyles: Presentation;
  initialPhoto: string | null;
  title: string;
}) {
  const [resume, setResume] = useState<Resume>(initial);
  const [template, setTemplate] = useState(templateId);
  const [doc, setDoc] = useState<DocStyle>(initialStyles.doc ?? {});
  const [photo, setPhoto] = useState<string | null>(initialPhoto);

  const [open, setOpen] = useState<SectionKey>("personal");
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [design, setDesign] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [pages, setPages] = useState(1);
  const [getting, setGetting] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);

  const past = useRef<Resume[]>([]);
  const dirty = useRef(false);

  const patch = useCallback((fn: (r: Resume) => Resume) => {
    setResume((prev) => {
      past.current = [...past.current.slice(-30), prev];
      return fn(prev);
    });
    dirty.current = true;
    setState("idle");
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    setResume(prev);
    dirty.current = true;
  }, []);

  /**
   * Autosave, debounced. The PRD asks for 500–1000ms and an explicit Saved
   * state, which is also what stops the save count tracking the keystroke
   * count on a page somebody types into for twenty minutes.
   */
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(async () => {
      dirty.current = false;
      setState("saving");
      try {
        const res = await fetch("/api/app/resume/draft", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          // No `design` key: absent means "not part of this save".
          body: JSON.stringify({ id: draftId, content: resume }),
        });
        setState(res.ok ? "saved" : "idle");
      } catch {
        setState("idle");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [resume, draftId]);

  /**
   * The design, saved on its own.
   *
   * Separate from the content autosave because a photograph is two hundred
   * kilobytes and the content save fires every eight hundred milliseconds
   * somebody is typing. Sending the picture again on each of those would
   * make the builder slower the moment anybody uploads one — for no reason,
   * since a template and a photo change perhaps five times in a session.
   */
  const designDirty = useRef(false);
  useEffect(() => {
    if (!designDirty.current) return;
    const t = setTimeout(async () => {
      designDirty.current = false;
      setState("saving");
      try {
        const res = await fetch("/api/app/resume/draft", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: draftId,
            content: resume,
            template,
            // Merged, not replaced: `fields` and `hidden` belong to the canvas
            // and a design save must not quietly drop them.
            styles: { ...initialStyles, doc },
            photo,
          }),
        });
        setState(res.ok ? "saved" : "idle");
      } catch {
        setState("idle");
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, doc, photo, draftId]);

  const mark = <T,>(set: (v: T) => void) => (v: T) => {
    designDirty.current = true;
    setState("idle");
    set(v);
  };

  /**
   * Everything on screen, written down, before anything reads it back.
   *
   * The download is printed from the row, not from this tab — so a résumé
   * saved eight hundred milliseconds from now is a résumé that prints
   * without the sentence somebody just typed. The debounce is right for
   * typing and wrong for the moment somebody asks for the file.
   */
  const flush = useCallback(async () => {
    dirty.current = false;
    designDirty.current = false;
    setState("saving");
    const res = await fetch("/api/app/resume/draft", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: draftId,
        content: resume,
        template,
        styles: { ...initialStyles, doc },
        photo,
      }),
    });
    setState(res.ok ? "saved" : "idle");
    return res.ok;
  }, [draftId, resume, template, doc, photo, initialStyles]);

  const download = useCallback(async () => {
    setGetting(true);
    setTrouble(null);
    try {
      await flush();
      const res = await fetch("/api/app/resume/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `flow` is what asks for the document this preview is showing,
        // rather than the canvas design the row may also still hold.
        body: JSON.stringify({ id: draftId, flow: true }),
      });
      if (!res.ok) throw new Error("The PDF could not be built.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(resume.full_name || title || "Resume").replace(/[^\p{L}\p{N} ._-]/gu, "").trim() || "Resume"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoked a beat later: Safari has not finished reading the blob when
      // the click returns, and revoking immediately gives an empty file.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setTrouble(e instanceof Error ? e.message : "That did not work.");
    } finally {
      setGetting(false);
    }
  }, [flush, draftId, resume.full_name, title]);

  // Nothing is lost to a closed tab in the second and a half we might owe.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current || designDirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const overrides = useMemo(
    () => ({
      accent: doc.accent,
      font: fontStack(doc.font),
      scale: doc.scale,
      density: doc.density,
    }),
    [doc],
  );

  /**
   * The preview, scaled to whatever room it has.
   *
   * It was a fixed 62%, which is right on one screen width and wrong on every
   * other — on a laptop the page ran off the right edge of its column, which
   * is what "preview cut off" was. Measured instead, so the sheet is always
   * exactly as wide as the space beside the form.
   */
  const pane = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.62);
  useLayoutEffect(() => {
    const el = pane.current;
    if (!el) return;
    const read = () => setFit(Math.min(1, Math.max(0.28, (el.clientWidth - 40) / PAGE_PX)));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const done = useMemo(() => SECTIONS.filter((s) => filled(resume, s.key)).length, [resume]);
  const pct = Math.round((done / SECTIONS.length) * 100);
  const idx = SECTIONS.findIndex((s) => s.key === open);
  const section = SECTIONS[idx];

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      {/* --------------------------------------------------------- top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-ink-08 bg-paper px-3 sm:px-4">
        <Link href="/app/resume" aria-label="Back" className="px-1 text-ink-50 hover:text-ink">←</Link>
        <p className="min-w-0 flex-1 truncate text-[0.9rem] font-medium">{title}</p>
        <span className="hidden text-[0.78rem] text-ink-30 sm:inline">
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : ""}
        </span>
        <button type="button" onClick={undo} aria-label="Undo" title="Undo"
          className="rounded-lg border border-ink-15 p-1.5 text-ink-50 transition-colors hover:border-ink hover:text-ink">
          <Undo />
        </button>

        {/* The one control that is not obvious from the form, so it says what
            it does rather than only naming itself: the swatch is the colour
            in use, the sliders are the promise that it can be changed. */}
        <button
          type="button"
          onClick={() => setDesign(true)}
          title="Design — pick a template, change the colour, font, size and spacing"
          aria-label="Design — pick a template, change the colour, font, size and spacing"
          className="flex items-center gap-2 rounded-lg border border-ink-15 bg-ink-04 px-2.5 py-1.5 text-[0.78rem] font-medium transition-colors hover:border-ink"
        >
          <Sliders />
          <span>Design</span>
          <span
            aria-hidden="true"
            className="h-3 w-3 rounded-full ring-1 ring-black/10"
            style={{ background: doc.accent ?? templateById(template).theme.accent ?? "#111" }}
          />
        </button>

        <button type="button" onClick={download} disabled={getting}
          className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[0.78rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40">
          <Down />
          <span>{getting ? "Preparing…" : "Download"}</span>
        </button>
      </header>

      {trouble && (
        <p className="border-b border-ink-08 bg-[#fdf2f0] px-4 py-2 text-[0.8rem] text-[#c0392b]">
          {trouble} You can try again, or print the preview from your browser.
        </p>
      )}

      {/* ------------------------------------------------- mobile switcher */}
      <div className="sticky top-14 z-20 grid grid-cols-2 gap-1 border-b border-ink-08 bg-paper p-1.5 lg:hidden">
        {(["edit", "preview"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`rounded-lg py-2 text-[0.84rem] capitalize transition-colors ${
              tab === t ? "bg-ink font-medium text-paper" : "text-ink-50"
            }`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        {/* ------------------------------------------------------ left rail */}
        <nav className="hidden border-r border-ink-08 p-4 lg:block">
          <p className="mb-1.5 text-[0.72rem] uppercase tracking-[0.12em] text-ink-30">
            {done} of {SECTIONS.length} done
          </p>
          <div className="mb-4 h-1 overflow-hidden rounded-full bg-ink-08">
            <div className="h-full rounded-full bg-ink transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <ul className="space-y-0.5">
            {SECTIONS.map((s) => (
              <li key={s.key}>
                <button type="button" onClick={() => setOpen(s.key)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[0.86rem] transition-colors ${
                    open === s.key ? "bg-ink-04 font-medium text-ink" : "text-ink-50 hover:text-ink"
                  }`}>
                  <span className={filled(resume, s.key) ? "text-[#1a7f37]" : "text-ink-30"}>
                    {filled(resume, s.key) ? "✓" : "○"}
                  </span>
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* ------------------------------------------- form + live preview */}
        <div className="min-w-0 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
          <div className={`min-w-0 border-ink-08 p-4 sm:p-6 lg:border-r ${tab === "preview" ? "hidden lg:block" : ""}`}>
            <div className="mb-4">
              <p className="text-[0.72rem] uppercase tracking-[0.12em] text-ink-30 lg:hidden">
                Step {idx + 1} of {SECTIONS.length}
              </p>
              <h2 className="mt-0.5 text-[1.12rem] font-semibold tracking-[-0.02em]">{section.label}</h2>
              <p className="mt-1 text-[0.84rem] leading-relaxed text-ink-50">{section.blurb}</p>
            </div>

            {open === "personal" && <S.Personal r={resume} patch={patch} />}
            {open === "summary" && <S.Summary r={resume} patch={patch} />}
            {open === "experience" && <S.Experience r={resume} patch={patch} />}
            {open === "education" && <S.Education r={resume} patch={patch} />}
            {open === "skills" && <S.Skills r={resume} patch={patch} />}
            {open === "projects" && <S.Projects r={resume} patch={patch} />}
            {open === "extras" && <S.Extras r={resume} patch={patch} />}

            <div className="mt-5 flex items-center justify-between gap-3">
              <button type="button" disabled={idx === 0} onClick={() => setOpen(SECTIONS[idx - 1].key)}
                className="rounded-full border border-ink-15 px-4 py-2 text-[0.84rem] transition-colors hover:border-ink disabled:opacity-30">
                Back
              </button>
              {section.next && (
                <button type="button" onClick={() => setOpen(SECTIONS[idx + 1].key)}
                  className="rounded-full bg-ink px-5 py-2.5 text-[0.86rem] font-medium text-paper transition-opacity hover:opacity-90">
                  Next: {section.next}
                </button>
              )}
            </div>
          </div>

          <div
            ref={pane}
            className={`min-w-0 bg-ink-04 lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto ${
              tab === "edit" ? "hidden lg:block" : ""
            }`}
          >
            <div className="flex justify-center p-5">
              {/* `zoom` rather than a transform: it reflows, so the column is
                  the size of the scaled page and nothing overflows. Safe here
                  only because FlowDoc measures in a layer portalled to the
                  body, outside this scale. */}
              <div style={{ zoom: fit }}>
                <FlowDoc
                  resume={resume}
                  templateId={template}
                  photo={photo}
                  overrides={overrides}
                  onPages={setPages}
                />
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 pb-7">
              {/* The other way in, at the place somebody is actually looking
                  when they decide they want a different one. A caption that
                  names the template and does nothing is a caption that makes
                  people go hunting in the top bar. */}
              <button
                type="button"
                onClick={() => setDesign(true)}
                className="group flex items-center gap-1.5 text-center text-[0.76rem] text-ink-30 transition-colors hover:text-ink"
              >
                <span>
                  {templateById(template).name} · {pages} page{pages === 1 ? "" : "s"}
                  {pages > 2 && " · most recruiters read one"}
                </span>
                <span className="whitespace-nowrap underline underline-offset-2">Change</span>
              </button>
              <button type="button" onClick={download} disabled={getting}
                className="rounded-full bg-ink px-5 py-2.5 text-[0.86rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40">
                {getting ? "Preparing your PDF…" : "Download PDF"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <DesignPanel
        open={design}
        onClose={() => setDesign(false)}
        templateId={template}
        onTemplate={mark(setTemplate)}
        doc={doc}
        onDoc={mark(setDoc)}
        photo={photo}
        onPhoto={mark(setPhoto)}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- icons */

const stroke = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-[15px] w-[15px] shrink-0",
  "aria-hidden": true,
};

function Sliders() {
  return (
    <svg {...stroke}>
      <path d="M3 6h9M15 6h2M3 14h2M8 14h9" />
      <circle cx="13.5" cy="6" r="1.8" />
      <circle cx="6.5" cy="14" r="1.8" />
    </svg>
  );
}

function Down() {
  return (
    <svg {...stroke}>
      <path d="M10 3v9M6.5 8.5 10 12l3.5-3.5M3.5 15.5h13" />
    </svg>
  );
}

function Undo() {
  return (
    <svg {...stroke}>
      <path d="M7 5 3.5 8.5 7 12" />
      <path d="M3.5 8.5H12a4.5 4.5 0 0 1 0 9h-2" />
    </svg>
  );
}
