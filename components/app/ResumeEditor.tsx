"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ResumeDocument, type Edit } from "@/components/app/ResumeDocument";
import { EditorToolbar } from "@/components/app/EditorToolbar";
import { ShareDialog } from "@/components/app/ShareDialog";
import {
  EMPTY_PRESENTATION,
  PHOTO_PATH,
  type FieldStyle,
  type PhotoFit,
  type Presentation,
} from "@/lib/app/resume-style";
import { sectionOrder, showsPhoto, templateById } from "@/lib/app/resume-templates";
import type { Resume } from "@/lib/app/resume-schema";

/**
 * The editor: the document, typed into directly.
 *
 * The usual resume builder is a form on the left and a preview on the right,
 * which is easier to build and puts a translation step between what somebody
 * types and what they see. Editing the page itself removes that step: the
 * thing you click is the thing that prints.
 *
 * What this file owns is the *state* of that editing — the undo stack, the
 * paths, the list operations, saving. What the document owns is where things
 * are on the page. The seam between them is `Edit`, which is a handful of
 * functions taking a path string; that is deliberately the narrowest join
 * that works, because the alternative is an editor that knows the layout and
 * a layout that knows the editor.
 *
 * It has a styling toolbar, and this file argued against one for a while. The
 * argument was that a font size picker on a resume produces resumes with six
 * font sizes on them, and that every one of those choices is a choice the
 * template already made better. That is still true and it is still the reason
 * the toolbar has no gradients, no letter spacing and twenty fonts rather than
 * a thousand. It was not a reason to withhold the control: people want their
 * name in their own colour, and refusing on their behalf is not a design
 * position, it is an opinion enforced by omission.
 *
 * The safety rail that survived is that none of it can touch the words. Styles
 * live in their own blob keyed by path, never inside `content`, so nothing
 * here can change the text a parser extracts — and therefore nothing here can
 * change the ATS score.
 */

type Props = {
  draftId: string;
  initial: Resume;
  template: string;
  title: string;
  shareId: string | null;
  isPublic: boolean;
  /** What the public link grants. Only the owner can change it. */
  linkRole?: "view" | "edit";
  /** Shown as "you" in the share sheet's list of people. */
  ownerEmail?: string | null;
  initialStyles: Presentation;
  initialPhoto: string | null;
  /**
   * Set when this is somebody else's resume, opened through a link that
   * granted editing.
   *
   * It changes two things and deliberately nothing else. Saves go to the
   * shared route, which re-checks the grant server-side rather than trusting
   * this flag; and Share is hidden, because deciding who else may read a
   * document is the owner's call, not a guest's. Everything about editing —
   * the toolbar, undo, zoom, pages — is identical, because a guest who was
   * given a pen was given the whole pen.
   */
  sharedAs?: string | null;
};

/** What the section switcher lists, in the order the page shows them. */
const SECTION_LABELS: Record<string, string> = {
  summary: "Summary",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  achievements: "Achievements",
};

/** What the "+ Add section" menu offers, in the order the page shows them. */
const ADDABLE: { key: ListKey; label: string }[] = [
  { key: "roles", label: "A job" },
  { key: "education", label: "Education" },
  { key: "projects", label: "A project" },
  { key: "achievements", label: "An achievement" },
];

/** How many steps back Ctrl-Z can go. Deep enough to undo a bad paste. */
const HISTORY = 60;

export function ResumeEditor({
  draftId,
  initial,
  template,
  title,
  shareId,
  isPublic,
  linkRole = "view",
  ownerEmail = null,
  initialStyles,
  initialPhoto,
  sharedAs = null,
}: Props) {
  const [content, setContent] = useState<Resume>(initial);
  const [styles, setStyles] = useState<Presentation>(initialStyles ?? EMPTY_PRESENTATION);
  const [photo, setPhoto] = useState<string | null>(initialPhoto);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState(false);

  /**
   * Zoom, and how many pages there turned out to be.
   *
   * The zoom is a CSS transform on the page rather than a font-size change,
   * for the same reason the gallery thumbnails are: at 50% the document has to
   * be the *same* document, laid out identically, or the line breaks move and
   * what somebody is judging is no longer what prints.
   *
   * The page count is measured rather than estimated. An estimate from
   * character counts is what the ATS length check uses and it is fine for a
   * score; it is not fine for a number on screen that somebody will trust.
   */
  const [zoom, setZoom] = useState(1);
  const [adding, setAdding] = useState(false);
  const [pages, setPages] = useState(1);
  const page = useRef<HTMLDivElement>(null);

  /**
   * Undo, as two stacks.
   *
   * Refs rather than state: pushing a history entry must not itself cause a
   * render, or every keystroke that commits would re-render the document
   * twice. Nothing on screen reads these except the two buttons, which take
   * their disabled state from a counter that does render.
   */
  const past = useRef<Resume[]>([]);
  const future = useRef<Resume[]>([]);
  const [depth, setDepth] = useState({ back: 0, forward: 0 });

  const change = useCallback((next: Resume) => {
    setContent((current) => {
      past.current = [...past.current, current].slice(-HISTORY);
      future.current = [];
      setDepth({ back: past.current.length, forward: 0 });
      return next;
    });
    setDirty(true);
    setSaved(null);
  }, []);

  const undo = useCallback(() => {
    setContent((current) => {
      const previous = past.current[past.current.length - 1];
      if (!previous) return current;
      past.current = past.current.slice(0, -1);
      future.current = [current, ...future.current].slice(0, HISTORY);
      setDepth({ back: past.current.length, forward: future.current.length });
      setDirty(true);
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setContent((current) => {
      const next = future.current[0];
      if (!next) return current;
      future.current = future.current.slice(1);
      past.current = [...past.current, current].slice(-HISTORY);
      setDepth({ back: past.current.length, forward: future.current.length });
      setDirty(true);
      return next;
    });
  }, []);

  /** Remeasure whenever the document changes shape. */
  useEffect(() => {
    const node = page.current;
    if (!node) return;

    const measure = () => {
      // 297mm at 96dpi, less the 12mm margin top and bottom that @page adds.
      const perPage = (273 / 25.4) * 96;
      setPages(Math.max(1, Math.ceil((node.scrollHeight - 1) / perPage)));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [content, styles, template, photo]);

  /** Warn before losing edits — only while there are some, or it is noise. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** The shortcuts everybody's hands already know. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "s") {
        e.preventDefault();
        void save();
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10));
      } else if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 10) / 10));
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, content]);

  /** Styling and content share one dirty flag; both go in the same save. */
  const restyle = useCallback((next: Presentation) => {
    setStyles(next);
    setDirty(true);
    setSaved(null);
  }, []);

  const onStyle = useCallback(
    (patch: FieldStyle | null) => {
      if (!selected) return;
      const fields = { ...styles.fields };
      // An override that is entirely empty is removed rather than stored as
      // `{}` — otherwise the blob fills with a key per field ever clicked.
      const merged = patch && Object.values(patch).some((v) => v !== undefined && v !== false);
      if (merged) fields[selected] = patch;
      else delete fields[selected];
      restyle({ ...styles, fields });
    },
    [selected, styles, restyle],
  );

  const sections = useMemo(() => {
    const { aside, main } = sectionOrder(templateById(template).layout);
    return [...aside, ...main].map((key) => ({
      key,
      label: SECTION_LABELS[key] ?? key,
      hidden: styles.hidden.includes(key),
    }));
  }, [template, styles.hidden]);

  const onSection = useCallback(
    (key: string, hidden: boolean) => {
      const next = hidden
        ? [...styles.hidden, key]
        : styles.hidden.filter((k) => k !== key);
      restyle({ ...styles, hidden: [...new Set(next)] });
    },
    [styles, restyle],
  );

  const edit: Edit = useMemo(
    () => ({
      set: (path, value) => {
        const next = apply(content, path, value);
        // A blur that changed nothing is not an undo step. Without this, every
        // click into and out of a field fills the history with duplicates and
        // Ctrl-Z appears to do nothing several times in a row.
        if (next !== content) change(next);
      },
      splitBullet: (path) => {
        const next = afterBullet(content, path);
        if (!next) return null;
        change(next.content);
        return next.focus;
      },
      removeBullet: (path) => {
        const next = withoutBullet(content, path);
        if (!next) return null;
        change(next.content);
        return next.focus;
      },
      addBlock: (row) => {
        const next = duplicateBlock(content, row);
        if (!next) return null;
        change(next.content);
        return next.focus;
      },
      removeBlock: (row) => change(removeBlock(content, row)),
      moveBlock: (row, by) => change(moveBlock(content, row, by)),
      select: setSelected,
      removePhoto: () => {
        // The fit goes with it — keeping a zoom for a photograph that is no
        // longer there means the next one arrives mysteriously cropped — and
        // the slot is marked off so the monogram does not step into the hole.
        setPhoto(null);
        setSelected(null);
        restyle({
          ...styles,
          photoFit: undefined,
          hidden: [...new Set([...styles.hidden, PHOTO_PATH])],
        });
      },
    }),
    // Every handler reads `content`, so the object is rebuilt when it changes
    // or the handlers close over a stale document.
    [content, change, styles, restyle],
  );

  /** The page-controls duplicate button, which acts on whatever is selected. */
  function duplicateSelectedBlock() {
    const row = selected?.match(/^(roles|projects|education|achievements)\.\d+/)?.[0];
    if (!row) return;
    const next = duplicateBlock(content, row);
    if (next) change(next.content);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      // A guest's save goes somewhere else entirely: no draft id, because the
      // share id is the only handle they hold and the server decides from it
      // which row — if any — they are allowed to write.
      const res = sharedAs
        ? await fetch("/api/app/resume/shared", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shareId: sharedAs, content, styles, photo }),
          })
        : await fetch("/api/app/resume/draft", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: draftId, content, template, styles, photo }),
          });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "That didn't save.");
      setDirty(false);
      setSaved("Saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    // z-50, because the app's own header is sticky at z-40 and was painting
    // over this bar — which is why the Share button could not be seen.
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f2f2f4] print:static print:z-auto print:bg-white">
      {/* ------------------------------------------------------------ bar */}
      <header className="no-print flex shrink-0 items-center gap-2 border-b border-ink-08 bg-paper px-4 py-2.5">
        <a
          href="/app/resume"
          className="rounded-full px-3 py-1.5 text-[0.82rem] font-medium text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink"
        >
          {sharedAs ? "← Your resumes" : "← Templates"}
        </a>

        <span className="mx-1 h-5 w-px bg-ink-08" />

        <IconButton label="Undo" onClick={undo} disabled={!depth.back}>
          <path d="M4 8h7a4 4 0 1 1 0 8H7" />
          <path d="M7 5 4 8l3 3" />
        </IconButton>
        <IconButton label="Redo" onClick={redo} disabled={!depth.forward}>
          <path d="M16 8H9a4 4 0 1 0 0 8h4" />
          <path d="M13 5l3 3-3 3" />
        </IconButton>

        <p className="ml-3 min-w-0 flex-1 truncate text-[0.85rem] text-ink-50">{title}</p>

        <span className="text-[0.78rem] text-ink-30">
          {error ? <span className="text-ink">{error}</span> : saving ? "Saving…" : dirty ? "Unsaved" : (saved ?? "")}
        </span>

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty}
          className="rounded-full border border-ink-15 px-4 py-1.5 text-[0.82rem] font-medium transition-colors hover:border-ink disabled:opacity-40"
        >
          Save
        </button>

        {sharedAs ? (
          // Whose document this is, said plainly. A guest editing somebody
          // else's resume with no sign of it on screen is how somebody
          // rewrites a friend's work believing it is their own copy.
          <span className="rounded-full bg-ink-04 px-3.5 py-1.5 text-[0.78rem] font-medium text-ink-50">
            Shared with you
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setShare(true)}
            className="rounded-full bg-ink px-4 py-1.5 text-[0.82rem] font-semibold text-paper transition-transform hover:scale-[1.03]"
          >
            Share
          </button>
        )}
      </header>

      <EditorToolbar
        selected={selected}
        styles={styles}
        onStyle={onStyle}
        photo={photo}
        onPhoto={(next) => {
          setPhoto(next);
          setDirty(true);
          setSaved(null);
          if (!next) setSelected(null);
          restyle({
            ...styles,
            // Adding one un-hides the slot; removing one hides it, so the
            // monogram never reappears as a consolation prize.
            hidden: next
              ? styles.hidden.filter((k) => k !== PHOTO_PATH)
              : [...new Set([...styles.hidden, PHOTO_PATH])],
            ...(next ? {} : { photoFit: undefined }),
          });
        }}
        sections={sections}
        onSection={onSection}
        photoSlot={showsPhoto(templateById(template).layout)}
        onPhotoFit={(photoFit: PhotoFit) => restyle({ ...styles, photoFit })}
        onSelect={setSelected}
      />

      {/* ------------------------------------------------------ the canvas

          A grey field with the page floating on it, page controls above and
          the way to add more below — the shape every design editor has settled
          on, because it makes the paper the subject and everything else the
          frame around it. */}
      <div
        className="relative min-h-0 flex-1 overflow-auto print:overflow-visible print:p-0"
        onMouseDown={(e) => {
          // Only the canvas itself, never a click that landed on the page.
          if (e.target === e.currentTarget) setSelected(null);
        }}
      >
        <div className="flex min-h-full w-fit min-w-full flex-col items-center px-8 py-8 print:p-0">
          {/* Page controls, above the sheet, right-aligned — where Canva puts
              them and where the eye already looks for them. */}
          <div
            className="no-print mb-2 flex items-center gap-1"
            style={{ width: `calc(210mm * ${zoom})` }}
          >
            <span className="flex-1" />
            <PageButton label="Duplicate this section" onClick={() => duplicateSelectedBlock()}>
              <rect x="6" y="6" width="9" height="9" rx="1.5" />
              <path d="M12 6V4.5A1.5 1.5 0 0 0 10.5 3h-6A1.5 1.5 0 0 0 3 4.5v6A1.5 1.5 0 0 0 4.5 12H6" />
            </PageButton>
            <PageButton label="Add a section" onClick={() => setAdding((v) => !v)}>
              <path d="M10 4v12M4 10h12" />
            </PageButton>
          </div>

          {/* The sheet. Scaled with a transform so the layout inside it is
              byte-identical at every zoom — a font-size change would move the
              line breaks and the thing being judged would stop being the thing
              that prints. */}
          <div
            style={{
              width: `calc(210mm * ${zoom})`,
              height: page.current ? page.current.offsetHeight * zoom : undefined,
            }}
            className="print:!h-auto print:!w-auto"
          >
            <div
              ref={page}
              style={{ transform: zoom === 1 ? undefined : `scale(${zoom})`, transformOrigin: "top left" }}
              className="w-fit bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_16px_48px_-16px_rgba(0,0,0,0.25)] print:!transform-none print:shadow-none"
            >
              <ResumeDocument
                content={content}
                template={template}
                edit={edit}
                selected={selected}
                styles={styles}
                photo={photo}
              />
            </div>
          </div>

          {/* Canva's "+ Add page" lives here. A resume is a document that
              flows rather than a stack of canvases, so a blank page is not a
              thing somebody can want — pages appear as the writing grows. The
              equivalent action, and the one people are actually reaching for,
              is another section. */}
          <div className="no-print relative mt-4" style={{ width: `calc(210mm * ${zoom})` }}>
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-ink-15 bg-paper py-3 text-[0.88rem] font-medium transition-colors hover:border-ink-30"
            >
              <span className="text-[1.05rem] leading-none">+</span> Add section
            </button>

            {adding && (
              <div className="absolute bottom-[calc(100%+6px)] left-1/2 z-20 w-[220px] -translate-x-1/2 overflow-hidden rounded-xl border border-ink-08 bg-paper p-1 shadow-xl">
                {ADDABLE.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => {
                      change(addRow(content, a.key));
                      setAdding(false);
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-[0.85rem] transition-colors hover:bg-ink-04"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------- bottom bar */}
      <footer className="no-print flex shrink-0 items-center gap-4 border-t border-ink-08 bg-paper px-4 py-2">
        <p className="min-w-0 flex-1 truncate text-[0.78rem] text-ink-30">
          Click a line to change it. Enter starts the next bullet; Backspace on an empty one
          removes it.
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 10) / 10))}
            className="grid h-6 w-6 place-items-center rounded-full text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink"
          >
            −
          </button>
          <input
            type="range"
            min={0.25}
            max={2}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="w-28 accent-black"
          />
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
            className="grid h-6 w-6 place-items-center rounded-full text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="w-12 rounded-md py-0.5 text-[0.78rem] tabular-nums text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink"
          >
            {Math.round(zoom * 100)}%
          </button>
        </div>

        <span className="h-4 w-px bg-ink-08" />

        <span className="text-[0.78rem] tabular-nums text-ink-50">
          {pages === 1 ? "1 page" : `${pages} pages`}
        </span>
      </footer>

      {share && (
        <ShareDialog
          draftId={draftId}
          shareId={shareId}
          isPublic={isPublic}
          linkRole={linkRole}
          ownerEmail={ownerEmail}
          dirty={dirty}
          onSave={save}
          onClose={() => setShare(false)}
        />
      )}
    </div>
  );
}

function PageButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-md text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink"
    >
      <svg viewBox="0 0 20 20" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="rounded-full p-2 text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}

/* ------------------------------------------------------------------ paths */

/**
 * Write one value into the document at `path`.
 *
 * Three fields on the page are not fields in the data, and they are converted
 * here rather than in the document so the markup does not have to know about
 * the data shape:
 *
 * - `skills` and `certifications` are lists shown as one comma-separated line,
 *   because chips are boxes and boxes are what a parser loses. Typing a comma
 *   is how anybody writes a list, so the line is split back on commas.
 * - A job's `end` doubles as the "still working there" flag. Typing "Present"
 *   into the end date means exactly that, and making somebody find a checkbox
 *   for it would be worse.
 *
 * Returns the original object when nothing changed, so the caller can skip
 * pushing a pointless undo step.
 */
function apply(content: Resume, path: string, raw: string): Resume {
  const value = raw.replace(/\s+/g, " ").trim();

  if (path === "skills" || path === "certifications") {
    const next = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const before = content[path] ?? [];
    if (next.length === before.length && next.every((v, i) => v === before[i])) return content;
    return { ...content, [path]: next };
  }

  const parts = path.split(".");

  if (parts[0] === "roles" && parts[2] === "end") {
    const i = Number(parts[1]);
    const roles = [...(content.roles ?? [])];
    if (!roles[i]) return content;
    const present = /^present$/i.test(value);
    const end = present ? null : value || null;
    if (roles[i].end === end && roles[i].is_current === present) return content;
    roles[i] = { ...roles[i], end, is_current: present };
    return { ...content, roles };
  }

  if (read(content, parts) === (value || null)) return content;
  return write(content, parts, value || null) as Resume;
}

/** Follow a path, for the "did this actually change" check. */
function read(node: unknown, parts: string[]): unknown {
  return parts.reduce<unknown>((at, key) => {
    if (at === null || at === undefined) return undefined;
    if (Array.isArray(at)) return at[Number(key)];
    return (at as Record<string, unknown>)[key];
  }, node);
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

/* ---------------------------------------------------------------- bullets */

/**
 * Where the bullets live, given the path of one of them.
 *
 * Three shapes share the behaviour — a job's highlights, a project's, and the
 * flat achievements list — and reading them out here keeps the callers below
 * from each growing their own copy of the same three-way branch.
 */
function bulletsAt(
  content: Resume,
  path: string,
): { list: string[]; index: number; put: (next: string[]) => Resume; base: string } | null {
  const parts = path.split(".");

  if (parts[0] === "achievements" && parts.length === 2) {
    const index = Number(parts[1]);
    if (!Number.isInteger(index)) return null;
    return {
      list: [...(content.achievements ?? [])],
      index,
      base: "achievements",
      put: (next) => ({ ...content, achievements: next }),
    };
  }

  const [key, at, field, index] = parts;
  if ((key !== "roles" && key !== "projects") || field !== "highlights") return null;

  const row = Number(at);
  const i = Number(index);
  if (!Number.isInteger(row) || !Number.isInteger(i)) return null;

  const rows = [...((content[key] ?? []) as { highlights?: (string | null)[] }[])];
  if (!rows[row]) return null;

  return {
    list: (rows[row].highlights ?? []).map((h) => h ?? ""),
    index: i,
    base: `${key}.${row}.highlights`,
    put: (next) => {
      const copy = [...rows];
      copy[row] = { ...copy[row], highlights: next };
      return { ...content, [key]: copy };
    },
  };
}

/** Enter: a new empty line after this one, and the caret goes to it. */
function afterBullet(content: Resume, path: string): { content: Resume; focus: string } | null {
  const at = bulletsAt(content, path);
  if (!at) return null;
  const next = [...at.list];
  next.splice(at.index + 1, 0, "");
  return { content: at.put(next), focus: `${at.base}.${at.index + 1}` };
}

/**
 * Backspace on an empty line: remove it, caret to the end of the one above.
 *
 * The last remaining bullet is kept. Deleting it would take the whole list —
 * and with it the only place to type — leaving somebody who pressed Backspace
 * once too often with no way back except adding the job again.
 */
function withoutBullet(content: Resume, path: string): { content: Resume; focus: string } | null {
  const at = bulletsAt(content, path);
  if (!at || at.list.length <= 1 || at.index < 1) return null;
  const next = at.list.filter((_, i) => i !== at.index);
  return { content: at.put(next), focus: `${at.base}.${at.index - 1}` };
}

/* ----------------------------------------------------------------- blocks */

type ListKey = "roles" | "education" | "projects" | "achievements";

const BLANK: Record<ListKey, unknown> = {
  // A job arrives with one empty bullet rather than none: an empty job with
  // nowhere to type is a dead end.
  roles: { title: null, company: null, start: null, end: null, is_current: false, highlights: [""] },
  projects: { name: null, link: null, description: null, highlights: [""] },
  education: { degree: null, institution: null, year: null },
  achievements: "",
};

/**
 * Append an empty block of a kind, for the "+ Add section" menu.
 *
 * Empty rather than a copy. Duplicating the last job sounds friendlier and
 * produces a resume with the same role listed twice, which somebody then has
 * to edit into shape — more work than typing it, and it looks careless if they
 * forget.
 */
function addRow(content: Resume, key: ListKey): Resume {
  const list = listOf(content, key) ?? [];
  return { ...content, [key]: [...list, structuredClone(BLANK[key])] };
}

function listOf(content: Resume, key: string): unknown[] | null {
  if (!["roles", "education", "projects", "achievements"].includes(key)) return null;
  const list = (content as unknown as Record<string, unknown>)[key];
  return Array.isArray(list) ? list : [];
}

/**
 * The "+" on a block: a new empty one directly after it.
 *
 * Empty rather than a copy of what is there. Duplicating a job sounds
 * friendlier and produces a resume with the same role listed twice, which
 * somebody then has to edit into shape — more work than typing it, and it
 * looks careless if they forget.
 */
function duplicateBlock(content: Resume, row: string): { content: Resume; focus: string } | null {
  const [key, index] = row.split(".");
  const list = listOf(content, key);
  if (!list) return null;

  const i = Number(index);
  const next = [...list];
  next.splice(i + 1, 0, structuredClone(BLANK[key as ListKey]));

  const focus =
    key === "achievements"
      ? `achievements.${i + 1}`
      : key === "education"
        ? `education.${i + 1}.degree`
        : `${key}.${i + 1}.${key === "roles" ? "title" : "name"}`;

  return { content: { ...content, [key]: next }, focus };
}

function removeBlock(content: Resume, row: string): Resume {
  const [key, index] = row.split(".");
  const list = listOf(content, key);
  const i = Number(index);
  if (!list || !list.length || !Number.isInteger(i)) return content;
  return { ...content, [key]: list.filter((_, at) => at !== i) };
}

/** Move a block up or down among its siblings. Ends of the list do nothing. */
function moveBlock(content: Resume, row: string, by: number): Resume {
  const [key, index] = row.split(".");
  const list = listOf(content, key);
  const i = Number(index);
  const to = i + by;
  if (!list || !Number.isInteger(i) || to < 0 || to >= list.length) return content;

  const next = [...list];
  const [moved] = next.splice(i, 1);
  next.splice(to, 0, moved);
  return { ...content, [key]: next };
}
