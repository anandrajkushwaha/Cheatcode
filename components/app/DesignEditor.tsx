"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DesignCanvas } from "@/components/app/DesignCanvas";
import { DesignStyles } from "@/components/app/DesignPage";
import { DesignToolbar } from "@/components/app/DesignToolbar";
import { LeftRail, SidePanel, type PanelId } from "@/components/app/DesignPanels";
import { ShareDialog } from "@/components/app/ShareDialog";
import { A4, newId, type Design, type Element } from "@/lib/app/design";
import {
  addPage,
  duplicateElements,
  duplicatePage,
  group,
  layer,
  removeElements,
  removePage,
  replaceImage,
  ungroup,
} from "@/lib/app/design-ops";
import type { Resume } from "@/lib/app/resume-schema";

/**
 * The editor, as one screen.
 *
 * Rail, panel, contextual toolbar, canvas, page and zoom controls — the five
 * areas the PRD opens with (§2), in that arrangement, because it is the
 * arrangement people already know from every tool of this kind.
 *
 * What this file owns and nothing else does: the document, the selection, the
 * history, and the keyboard. Everything else is handed down. That is on
 * purpose — undo only works if there is exactly one place a change can happen,
 * and the fastest way to lose that is to let a panel keep its own copy of the
 * design "just for a moment".
 */

type Props = {
  draftId: string;
  title: string;
  /** What the design was seeded from. Kept for the template previews. */
  content: Resume;
  template: string;
  initialDesign: Design;
  shareId: string | null;
  isPublic: boolean;
  linkRole?: "view" | "edit";
  ownerEmail?: string | null;
  /** Set when this is somebody else's document, opened through a share link. */
  sharedAs?: string | null;
};

/** How many steps back Ctrl-Z can go. Deep enough to undo a bad paste. */
const HISTORY = 80;

export function DesignEditor({
  draftId,
  title,
  content,
  template,
  initialDesign,
  shareId,
  isPublic,
  linkRole = "view",
  ownerEmail = null,
  sharedAs = null,
}: Props) {
  const [design, setDesign] = useState(initialDesign);
  const [page, setPage] = useState(0);
  const [selection, setSelection] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  /**
   * The picture open for adjustment.
   *
   * Only ever one, and only ever an image. Held here rather than in the canvas
   * because the toolbar needs it too — the controls that appear while a photo
   * is open are a different row from the ones for a selected frame.
   */
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.72);
  const [panel, setPanel] = useState<PanelId | null>("templates");
  const [share, setShare] = useState(false);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * History, as two stacks of whole documents.
   *
   * Whole documents rather than diffs: a design is a few hundred small objects
   * and eighty of them is nothing, while a diff system is a second model that
   * has to stay correct through grouping, z-order and page moves. Refs rather
   * than state, because pushing a history entry must not itself re-render —
   * only the two buttons care, and they read the counter below.
   */
  const past = useRef<Design[]>([]);
  const future = useRef<Design[]>([]);
  const [depth, setDepth] = useState({ back: 0, forward: 0 });
  const clipboard = useRef<Element[]>([]);

  const begin = useCallback(() => {
    setDesign((d) => {
      past.current = [...past.current, d].slice(-HISTORY);
      future.current = [];
      setDepth({ back: past.current.length, forward: 0 });
      return d;
    });
  }, []);

  const change = useCallback((next: Design) => {
    setDesign(next);
    setDirty(true);
    setSaved(null);
  }, []);

  /** Measurement, not an edit — never enters history and never marks dirty. */
  const measured = useCallback((next: Design) => setDesign(next), []);

  const undo = useCallback(() => {
    setDesign((d) => {
      const prev = past.current.pop();
      if (!prev) return d;
      future.current = [...future.current, d].slice(-HISTORY);
      setDepth({ back: past.current.length, forward: future.current.length });
      setDirty(true);
      return prev;
    });
    setEditing(null);
  }, []);

  const redo = useCallback(() => {
    setDesign((d) => {
      const next = future.current.pop();
      if (!next) return d;
      past.current = [...past.current, d].slice(-HISTORY);
      setDepth({ back: past.current.length, forward: future.current.length });
      setDirty(true);
      return next;
    });
    setEditing(null);
  }, []);

  /* ------------------------------------------------------------- saving */

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(sharedAs ? "/api/app/resume/shared" : "/api/app/resume/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          sharedAs
            ? { shareId: sharedAs, content, design }
            : { id: draftId, content, template, design },
        ),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "That didn't save.");
      setDirty(false);
      setSaved("All changes saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save.");
    } finally {
      setSaving(false);
    }
  }, [design, content, draftId, template, sharedAs]);

  /**
   * Autosave, debounced.
   *
   * The PRD asks for it (§56) and it is the right default for a canvas: there
   * is no "document" moment somebody would think to press Save at, and losing
   * a dragged element to a closed tab is the kind of thing people do not
   * forgive. A second and a half after the last change, so a drag saves once
   * rather than sixty times.
   */
  useEffect(() => {
    if (!dirty || saving) return;
    const t = setTimeout(() => void save(), 1500);
    return () => clearTimeout(t);
  }, [dirty, saving, save]);

  /** The browser's own warning, for the second and a half we might lose. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /* ---------------------------------------------------------- shortcuts */

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (!selection.length) return;
      begin();
      const ids = new Set(selection);
      setDesign((d) => ({
        ...d,
        pages: d.pages.map((p, i) =>
          i === page
            ? {
                ...p,
                elements: p.elements.map((el) =>
                  ids.has(el.id) && !el.locked ? { ...el, x: el.x + dx, y: el.y + dy } : el,
                ),
              }
            : p,
        ),
      }));
      setDirty(true);
    },
    [selection, page, begin],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (e.key === "Escape") {
        // Innermost mode first: adjusting a photo, then editing text, then
        // the selection itself. Escape should close one thing at a time.
        if (adjusting) setAdjusting(null);
        else if (editing) setEditing(null);
        else setSelection([]);
        return;
      }

      // Everything below moves or deletes something, so none of it may fire
      // while somebody is typing a letter into a text box or a search field.
      if (typing) return;

      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if (meta && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
        return;
      }
      if (meta && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelection(design.pages[page]?.elements.map((el) => el.id) ?? []);
        return;
      }
      if (meta && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (!selection.length) return;
        begin();
        const r = duplicateElements(design, page, selection);
        change(r.design);
        setSelection(r.ids);
        return;
      }
      if (meta && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (selection.length < 2 && !e.shiftKey) return;
        begin();
        change(e.shiftKey ? ungroup(design, page, selection) : group(design, page, selection));
        return;
      }
      if (meta && (e.key === "c" || e.key === "x")) {
        clipboard.current = (design.pages[page]?.elements ?? []).filter((el) =>
          selection.includes(el.id),
        );
        if (e.key === "x" && selection.length) {
          begin();
          change(removeElements(design, page, selection));
          setSelection([]);
        }
        return;
      }
      if (meta && e.key === "v") {
        if (!clipboard.current.length) return;
        e.preventDefault();
        begin();
        // New ids, and offset, so a paste is visibly a new thing rather than
        // something that looks like nothing happened.
        const copies = clipboard.current.map((el) => ({ ...el, id: newId(), x: el.x + 5, y: el.y + 5 }));
        const pages = design.pages.slice();
        pages[page] = { ...pages[page], elements: [...pages[page].elements, ...copies] };
        change({ ...design, pages });
        setSelection(copies.map((c) => c.id));
        return;
      }
      if (meta && e.key === "]") {
        e.preventDefault();
        begin();
        change(layer(design, page, selection, e.shiftKey ? "front" : "forward"));
        return;
      }
      if (meta && e.key === "[") {
        e.preventDefault();
        begin();
        change(layer(design, page, selection, e.shiftKey ? "back" : "backward"));
        return;
      }
      if (meta && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoom((z) => Math.min(3, Math.round((z + 0.1) * 100) / 100));
        return;
      }
      if (meta && e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(0.15, Math.round((z - 0.1) * 100) / 100));
        return;
      }
      if (meta && e.key === "0") {
        e.preventDefault();
        setZoom(1);
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (!selection.length) return;
        e.preventDefault();
        begin();
        change(removeElements(design, page, selection));
        setSelection([]);
        return;
      }

      const step = e.shiftKey ? 5 : 0.5;
      if (e.key === "ArrowLeft") return e.preventDefault(), nudge(-step, 0);
      if (e.key === "ArrowRight") return e.preventDefault(), nudge(step, 0);
      if (e.key === "ArrowUp") return e.preventDefault(), nudge(0, -step);
      if (e.key === "ArrowDown") return e.preventDefault(), nudge(0, step);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [design, page, selection, editing, undo, redo, save, begin, change, nudge]);

  /* ------------------------------------------------------------- pages */

  const pageOps = useMemo(
    () => ({
      add: () => {
        begin();
        change(addPage(design, page));
        setPage(page + 1);
        setSelection([]);
      },
      duplicate: () => {
        begin();
        change(duplicatePage(design, page));
        setPage(page + 1);
        setSelection([]);
      },
      remove: () => {
        if (design.pages.length < 2) return;
        begin();
        change(removePage(design, page));
        setPage(Math.max(0, page - 1));
        setSelection([]);
      },
    }),
    [design, page, begin, change],
  );

  /* ---------------------------------------------------------- download */

  /**
   * A PDF, not a print dialog.
   *
   * The server renders this exact design through a headless browser and sends
   * back a file named after the résumé. If that route is unavailable — an
   * older deployment, a cold start that timed out — the print dialog is the
   * fallback rather than a dead button, and the message says which happened.
   */
  async function download() {
    setBusy(true);
    setError(null);
    try {
      if (dirty) await save();
      const res = await fetch("/api/app/resume/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draftId, shareId: sharedAs }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "PDF failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(title || "Resume").replace(/[^\w\s.-]+/g, " ").trim() || "Resume"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoked on the next tick: revoking immediately races the download in
      // Safari and produces an empty file.
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      setError("Couldn't build the PDF here — opening your browser's print dialog instead.");
      window.print();
    } finally {
      setBusy(false);
    }
  }

  /* -------------------------------------------------------------- draw */

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#edeef1] print:static print:z-auto print:bg-white">
      <DesignStyles />

      {/* ------------------------------------------------------------ bar */}
      <header className="no-print flex shrink-0 items-center gap-2 border-b border-ink-08 bg-paper px-3 py-2">
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

        <span className="text-[0.76rem] text-ink-30">
          {error ? (
            <span className="text-ink">{error}</span>
          ) : saving ? (
            "Saving…"
          ) : dirty ? (
            "Unsaved"
          ) : (
            (saved ?? "")
          )}
        </span>

        <button
          type="button"
          onClick={() => void download()}
          disabled={busy}
          className="rounded-full border border-ink-15 px-4 py-1.5 text-[0.82rem] font-medium transition-colors hover:border-ink disabled:opacity-40"
        >
          {busy ? "Building…" : "Download"}
        </button>

        {sharedAs ? (
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

      {/* ------------------------------------------------------- toolbar */}
      <DesignToolbar
        design={design}
        page={page}
        selection={selection}
        onSelect={setSelection}
        begin={begin}
        onChange={change}
        adjusting={adjusting}
        onAdjust={setAdjusting}
        onAddPage={pageOps.add}
        onDuplicatePage={pageOps.duplicate}
        onDeletePage={pageOps.remove}
      />

      {/* ---------------------------------------------------- the middle */}
      <div className="flex min-h-0 flex-1">
        <LeftRail open={panel} onOpen={setPanel} />

        {panel && (
          <SidePanel
            selection={selection}
            onFill={(id, src) => {
              begin();
              setDesign((d) => replaceImage(d, page, id, src));
              setSelection([id]);
            }}
            id={panel}
            onClose={() => setPanel(null)}
            content={content}
            design={design}
            page={page}
            begin={begin}
            onChange={change}
            onSelect={setSelection}
            onReplacePage={(elements, background) => {
              begin();
              const pages = design.pages.slice();
              pages[page] = { ...pages[page], elements, background };
              change({ ...design, pages });
              setSelection([]);
            }}
          />
        )}

        <main className="min-h-0 flex-1 overflow-auto bg-[#edeef1] p-8 print:overflow-visible print:bg-white print:p-0">
          <DesignCanvas
            design={design}
            page={page}
            onPage={setPage}
            selection={selection}
            onSelect={setSelection}
            zoom={zoom}
            editing={editing}
            onEditing={setEditing}
            adjusting={adjusting}
            onAdjust={setAdjusting}
            begin={begin}
            onChange={change}
            onMeasure={measured}
          />
        </main>
      </div>

      {/* -------------------------------------------------------- footer */}
      <footer className="no-print flex shrink-0 items-center gap-3 border-t border-ink-08 bg-paper px-4 py-2">
        <button
          type="button"
          onClick={pageOps.add}
          className="rounded-lg border border-ink-15 px-3 py-1.5 text-[0.78rem] font-medium transition-colors hover:border-ink"
        >
          + Add page
        </button>
        <button
          type="button"
          onClick={pageOps.duplicate}
          className="rounded-lg px-2.5 py-1.5 text-[0.78rem] text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink"
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={pageOps.remove}
          disabled={design.pages.length < 2}
          className="rounded-lg px-2.5 py-1.5 text-[0.78rem] text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent"
        >
          Delete page
        </button>

        <span className="flex-1" />

        <span className="text-[0.74rem] text-ink-30">
          A4 · {A4.w} × {A4.h}mm
        </span>

        <span className="h-4 w-px bg-ink-08" />

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.15, Math.round((z - 0.1) * 100) / 100))}
            className="grid h-6 w-6 place-items-center rounded-md text-ink-50 hover:bg-ink-04 hover:text-ink"
          >
            −
          </button>
          <input
            type="range"
            min={0.15}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="w-32 accent-black"
          />
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.1) * 100) / 100))}
            className="grid h-6 w-6 place-items-center rounded-md text-ink-50 hover:bg-ink-04 hover:text-ink"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            title="Back to 100%"
            className="w-12 rounded-md px-1 py-0.5 text-[0.76rem] tabular-nums text-ink-50 hover:bg-ink-04 hover:text-ink"
          >
            {Math.round(zoom * 100)}%
          </button>
        </div>

        <span className="h-4 w-px bg-ink-08" />

        <span className="text-[0.76rem] tabular-nums text-ink-50">
          Page {page + 1} of {design.pages.length}
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
          onDownload={() => void download()}
          onClose={() => setShare(false)}
        />
      )}
    </div>
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
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-lg text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <svg viewBox="0 0 20 20" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
