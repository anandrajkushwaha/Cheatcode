"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Resume } from "@/lib/app/resume-schema";
import { FlowDoc } from "@/components/app/flow/FlowDoc";
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

const SECTIONS: { key: SectionKey; label: string; next?: string }[] = [
  { key: "personal", label: "Personal", next: "Summary" },
  { key: "summary", label: "Summary", next: "Experience" },
  { key: "experience", label: "Experience", next: "Education" },
  { key: "education", label: "Education", next: "Skills" },
  { key: "skills", label: "Skills", next: "Projects" },
  { key: "projects", label: "Projects", next: "More" },
  { key: "extras", label: "More" },
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

export function Builder({
  draftId,
  initial,
  templateId,
  title,
}: {
  draftId: string;
  initial: Resume;
  templateId: string | null;
  title: string;
}) {
  const [resume, setResume] = useState<Resume>(initial);
  const [open, setOpen] = useState<SectionKey>("personal");
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [pages, setPages] = useState(1);

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

  // Nothing is lost to a closed tab in the second and a half we might owe.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const done = useMemo(() => SECTIONS.filter((s) => filled(resume, s.key)).length, [resume]);
  const pct = Math.round((done / SECTIONS.length) * 100);
  const idx = SECTIONS.findIndex((s) => s.key === open);
  const section = SECTIONS[idx];

  const Form = (
    <>
      {open === "personal" && <S.Personal r={resume} patch={patch} />}
      {open === "summary" && <S.Summary r={resume} patch={patch} />}
      {open === "experience" && <S.Experience r={resume} patch={patch} />}
      {open === "education" && <S.Education r={resume} patch={patch} />}
      {open === "skills" && <S.Skills r={resume} patch={patch} />}
      {open === "projects" && <S.Projects r={resume} patch={patch} />}
      {open === "extras" && <S.Extras r={resume} patch={patch} />}

      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" disabled={idx === 0} onClick={() => setOpen(SECTIONS[idx - 1].key)}
          className="rounded-full border border-ink-15 px-4 py-2 text-[0.84rem] transition-colors hover:border-ink disabled:opacity-30">
          Back
        </button>
        {section.next && (
          <button type="button" onClick={() => setOpen(SECTIONS[idx + 1].key)}
            className="rounded-full bg-ink px-5 py-2.5 text-[0.86rem] font-medium text-paper">
            Next: {section.next}
          </button>
        )}
      </div>
    </>
  );

  const Preview = (
    <div className="flex justify-center overflow-x-auto bg-ink-04 p-4">
      <div style={{ zoom: 0.62 }}>
        <FlowDoc resume={resume} templateId={templateId} onPages={setPages} />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      {/* --------------------------------------------------------- top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-ink-08 bg-paper px-4">
        <Link href="/app/resume" aria-label="Back" className="text-ink-50 hover:text-ink">←</Link>
        <p className="min-w-0 flex-1 truncate text-[0.9rem] font-medium">{title}</p>
        <span className="hidden text-[0.78rem] text-ink-30 sm:inline">
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : ""}
        </span>
        <button type="button" onClick={undo}
          className="rounded-lg border border-ink-15 px-2.5 py-1 text-[0.78rem] text-ink-50 transition-colors hover:border-ink hover:text-ink">
          Undo
        </button>
        <Link href={`/app/resume/templates`}
          className="hidden rounded-lg border border-ink-15 px-3 py-1.5 text-[0.78rem] transition-colors hover:border-ink sm:inline">
          Design
        </Link>
      </header>

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

      <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* ------------------------------------------------------ left rail */}
        <nav className="hidden border-r border-ink-08 p-4 lg:block">
          <p className="mb-3 text-[0.72rem] uppercase tracking-[0.12em] text-ink-30">
            {done} of {SECTIONS.length} · {pct}%
          </p>
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
        <div className="min-w-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className={`min-w-0 p-4 sm:p-5 ${tab === "preview" ? "hidden lg:block" : ""}`}>
            <div className="mb-3 lg:hidden">
              <p className="text-[0.74rem] uppercase tracking-[0.12em] text-ink-30">
                {done} of {SECTIONS.length} sections · {pct}%
              </p>
              <h2 className="mt-1 text-[1.05rem] font-semibold">{section.label}</h2>
            </div>
            {Form}
          </div>

          <div className={`min-w-0 lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto ${
            tab === "edit" ? "hidden lg:block" : ""
          }`}>
            {Preview}
            <p className="pb-6 text-center text-[0.76rem] text-ink-30">
              {pages} page{pages === 1 ? "" : "s"}
              {pages > 2 && " · most recruiters read one"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
