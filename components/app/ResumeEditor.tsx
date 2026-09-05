"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ResumeDocument, type Edit } from "@/components/app/ResumeDocument";
import { TEMPLATES } from "@/lib/app/resume-templates";
import type { Resume } from "@/lib/app/resume-schema";

/**
 * The editor: the document, typed into directly.
 *
 * The shape of this was a real decision. The usual resume builder is a form on
 * the left and a preview on the right, which is easier to build and easier to
 * validate — and it puts a translation step between what somebody types and
 * what they see, so every change costs a glance across the screen to confirm
 * it landed where they meant. Editing the page itself removes that step
 * entirely: the thing you click is the thing that prints.
 *
 * What it costs is this file. Every field has to be addressable by a path, the
 * paths have to survive rows being added and removed, and a few fields on the
 * page are not fields in the data — the skills line is a list joined by
 * commas, and a job's dates are two values with a dash between them. Those
 * conversions live in `apply` below, in one place, so the document can stay
 * ignorant of them.
 *
 * Saving is explicit rather than on every keystroke. A resume is a document
 * somebody is composing, not a settings screen, and autosave on a document
 * means a half-written sentence becoming the saved version the moment they get
 * up to make tea. What is automatic is the warning if they try to leave with
 * work unsaved.
 */

type Props = {
  draftId: string;
  initial: Resume;
  initialTemplate: string;
};

export function ResumeEditor({ draftId, initial, initialTemplate }: Props) {
  const [content, setContent] = useState<Resume>(initial);
  const [template, setTemplate] = useState(initialTemplate);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Warn before losing edits.
   *
   * Only while there is something to lose — an unconditional handler turns
   * every navigation into a dialog and trains people to dismiss it.
   */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = useCallback((next: Resume) => {
    setContent(next);
    setDirty(true);
    setSaved(null);
  }, []);

  const edit: Edit = useMemo(
    () => ({
      set: (path, value) => change(apply(content, path, value)),
      addBullet: (row) => change(addBullet(content, row)),
      removeRow: (row) => change(removeRow(content, row)),
    }),
    // `content` is read inside every handler, so the object has to be rebuilt
    // when it changes or the handlers close over a stale document.
    [content, change],
  );

  async function save(nextTemplate = template) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/app/resume/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draftId, content, template: nextTemplate }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; score?: number };
      if (!json.ok) throw new Error(json.error ?? "That didn't save.");
      setDirty(false);
      setSaved(typeof json.score === "number" ? `Saved · ATS ${json.score}` : "Saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)] lg:items-start">
      <aside className="no-print lg:sticky lg:top-6">
        <p className="text-[0.72rem] font-medium uppercase tracking-[0.12em] text-ink-50">
          Template
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 lg:grid-cols-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.name}
              onClick={() => {
                setTemplate(t.id);
                setDirty(true);
                setSaved(null);
              }}
              aria-pressed={t.id === template}
              className={[
                "overflow-hidden rounded-md border bg-white transition-colors",
                t.id === template ? "border-ink ring-1 ring-ink" : "border-ink-15 hover:border-ink-30",
              ].join(" ")}
              style={{ aspectRatio: "210 / 297" }}
            >
              <Thumb content={content} template={t.id} />
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-2">
          <AddButton label="Add a job" onClick={() => change(addRow(content, "roles"))} />
          <AddButton label="Add education" onClick={() => change(addRow(content, "education"))} />
          <AddButton label="Add a project" onClick={() => change(addRow(content, "projects"))} />
          <AddButton
            label="Add an achievement"
            onClick={() => change(addRow(content, "achievements"))}
          />
        </div>

        <div className="mt-7 border-t border-ink-08 pt-5">
          <button
            type="button"
            onClick={() => save()}
            disabled={saving || !dirty}
            className="w-full rounded-full bg-ink px-4 py-2.5 text-[0.85rem] font-semibold text-paper transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="mt-2 w-full rounded-full border border-ink-15 px-4 py-2.5 text-[0.82rem] font-medium transition-colors hover:border-ink"
          >
            Download PDF
          </button>

          <p className="mt-3 min-h-[1.2rem] text-[0.78rem] text-ink-50">
            {error ? <span className="text-ink">{error}</span> : (saved ?? "")}
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        <p className="no-print mb-3 text-[0.82rem] text-ink-50">
          Click any line to change it. Hover a job to add a bullet or remove it.
        </p>
        <div className="overflow-x-auto rounded-xl border border-ink-08 bg-ink-04 p-4 lg:p-8 print:overflow-visible print:rounded-none print:border-0 print:bg-transparent print:p-0">
          <div className="mx-auto w-fit bg-white shadow-sm print:shadow-none">
            <ResumeDocument content={content} template={template} edit={edit} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-dashed border-ink-15 px-3 py-2 text-left text-[0.8rem] text-ink-50 transition-colors hover:border-ink-30 hover:text-ink"
    >
      {label}
    </button>
  );
}

/** A template thumbnail, small enough that five fit in a rail. */
function Thumb({ content, template }: { content: Resume; template: string }) {
  const WIDTH = 92;
  const PAGE = 794;
  return (
    <div
      aria-hidden
      className="pointer-events-none origin-top-left"
      style={{ width: PAGE, transform: `scale(${WIDTH / PAGE})` }}
    >
      <ResumeDocument content={content} template={template} />
    </div>
  );
}

/* ------------------------------------------------------------------ paths */

/**
 * Write one value into the document at `path`.
 *
 * Three fields on the page are not fields in the data, and they are handled
 * here rather than in the document so that the markup does not have to know
 * about the data shape:
 *
 * - `skills` and `certifications` are lists shown as one comma-separated line,
 *   because chips are boxes and boxes are what a parser loses. Typing a comma
 *   is how anybody writes a list, so the line is split back on commas.
 * - A job's `end` doubles as the "Present" flag. Somebody typing "Present"
 *   into the end date means they still work there, and having them find a
 *   checkbox for it would be worse.
 *
 * Everything else is a walk down the tree. Missing objects along the way are
 * created, so a path into a row that does not exist yet cannot throw.
 */
function apply(content: Resume, path: string, raw: string): Resume {
  const value = raw.replace(/\s+/g, " ").trim();

  if (path === "skills" || path === "certifications") {
    return {
      ...content,
      [path]: value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  const parts = path.split(".");

  if (parts[0] === "roles" && parts[2] === "end") {
    const i = Number(parts[1]);
    const roles = [...(content.roles ?? [])];
    if (!roles[i]) return content;
    const present = /^present$/i.test(value);
    roles[i] = { ...roles[i], end: present ? null : value || null, is_current: present };
    return { ...content, roles };
  }

  return write(content, parts, value || null) as Resume;
}

/** Immutable set down a path of object keys and array indices. */
function write(node: unknown, parts: string[], value: string | null): unknown {
  const [head, ...rest] = parts;
  if (head === undefined) return value;

  if (Array.isArray(node)) {
    const i = Number(head);
    if (!Number.isInteger(i) || i < 0) return node;
    const next = [...node];
    next[i] = write(next[i] ?? {}, rest, value);
    return next;
  }

  const obj = (node ?? {}) as Record<string, unknown>;
  // A leaf on an array-valued key — `achievements.2` — writes the string
  // itself rather than an object with a key on it.
  return { ...obj, [head]: write(obj[head] ?? (rest.length ? {} : null), rest, value) };
}

/* ------------------------------------------------------------------- rows */

type ListKey = "roles" | "education" | "projects" | "achievements";

function addRow(content: Resume, key: ListKey): Resume {
  if (key === "achievements") {
    return { ...content, achievements: [...(content.achievements ?? []), ""] };
  }
  if (key === "roles") {
    // A job with one empty bullet rather than none: an empty job with nowhere
    // to type is a dead end, and "+ line" is only discoverable on hover.
    return {
      ...content,
      roles: [
        ...(content.roles ?? []),
        { title: null, company: null, start: null, end: null, is_current: false, highlights: [""] },
      ],
    };
  }
  if (key === "projects") {
    return {
      ...content,
      projects: [
        ...(content.projects ?? []),
        { name: null, link: null, description: null, highlights: [""] },
      ],
    };
  }
  return {
    ...content,
    education: [...(content.education ?? []), { degree: null, institution: null, year: null }],
  };
}

function addBullet(content: Resume, row: string): Resume {
  const [key, index] = row.split(".");
  const i = Number(index);

  if (key === "roles") {
    const roles = [...(content.roles ?? [])];
    if (!roles[i]) return content;
    roles[i] = { ...roles[i], highlights: [...(roles[i].highlights ?? []), ""] };
    return { ...content, roles };
  }
  if (key === "projects") {
    const projects = [...(content.projects ?? [])];
    if (!projects[i]) return content;
    projects[i] = { ...projects[i], highlights: [...(projects[i].highlights ?? []), ""] };
    return { ...content, projects };
  }
  return content;
}

function removeRow(content: Resume, row: string): Resume {
  const [key, index] = row.split(".");
  const i = Number(index);
  const list = (content as unknown as Record<string, unknown[]>)[key];
  if (!Array.isArray(list) || !list[i]) return content;
  return { ...content, [key]: list.filter((_, at) => at !== i) };
}
