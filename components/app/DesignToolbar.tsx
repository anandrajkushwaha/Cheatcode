"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  A4,
  coverFit,
  type Design,
  type Element,
  type ImageElement,
  type LineElement,
  type ShapeElement,
  type TextElement,
} from "@/lib/app/design";
import {
  align,
  duplicateElements,
  group,
  layer,
  removeElements,
  replaceImage,
  resetFit,
  setField,
  ungroup,
  type AlignTo,
} from "@/lib/app/design-ops";
import { FONTS } from "@/lib/app/resume-style";

/**
 * The toolbar is not a toolbar. It is a function of the selection.
 *
 * This is the single most-repeated complaint about the thing it replaces:
 * clicking a date and clicking a photograph gave you the same row of buttons,
 * so half of them did nothing and the ones that mattered were missing. The
 * PRD calls it out twice (§23, §68) and states it as a rule — identify what is
 * selected, then load the controls that belong to it.
 *
 * So there is no static list here. `kind()` answers what is selected and each
 * branch renders only what can honestly be done to it. Nothing is disabled and
 * left visible: a greyed-out Crop on a paragraph is still a claim that cropping
 * a paragraph is a thing, and the person has to work out that it is not.
 *
 * Everything writes through `design-ops`, which refuses to touch a locked
 * element — so "locked" does not have to be re-checked in twenty places here.
 */

type Props = {
  design: Design;
  page: number;
  selection: string[];
  onSelect: (ids: string[]) => void;
  /** Snapshot for undo, before a change. */
  begin: () => void;
  onChange: (design: Design) => void;
  /** The picture open for adjustment, and the way in and out of that mode. */
  adjusting: string | null;
  onAdjust: (id: string | null) => void;
  onAddPage: () => void;
  onDuplicatePage: () => void;
  onDeletePage: () => void;
};

type Kind = "page" | "text" | "image" | "shape" | "line" | "multiple" | "group";

function kind(selected: Element[]): Kind {
  if (!selected.length) return "page";
  if (selected.length > 1) {
    const g = selected[0].group;
    return g && selected.every((e) => e.group === g) ? "group" : "multiple";
  }
  return selected[0].type;
}

export function DesignToolbar({
  design,
  page,
  selection,
  onSelect,
  begin,
  onChange,
  adjusting,
  onAdjust,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
}: Props) {
  const current = design.pages[page];
  const selected = useMemo(
    () => current?.elements.filter((e) => selection.includes(e.id)) ?? [],
    [current, selection],
  );
  const what = kind(selected);
  const first = selected[0];

  /**
   * The picture open for adjustment.
   *
   * When there is one it takes the whole row. Adjusting a photo is a mode, and
   * a mode with the ordinary controls still sitting next to it invites people
   * to reach for one and wonder why it applies to the frame rather than to
   * what they are looking at.
   */
  const open = adjusting
    ? (current?.elements.find((e) => e.id === adjusting && e.type === "image") as
        | ImageElement
        | undefined)
    : undefined;
  const locked = selected.some((e) => e.locked);

  /** Change a field on everything selected, as one undo step. */
  function set(field: string, value: unknown) {
    begin();
    onChange(setField(design, page, selection, field, value));
  }

  /** Every colour already used in this design, for the picker's own row. */
  const documentColours = useMemo(() => {
    const seen = new Set<string>();
    for (const p of design.pages) {
      seen.add(p.background);
      for (const el of p.elements) {
        if (el.type === "text") seen.add(el.color);
        if (el.type === "shape") {
          seen.add(el.fill);
          if (el.stroke !== "transparent") seen.add(el.stroke);
        }
        if (el.type === "line") seen.add(el.stroke);
      }
    }
    return [...seen].filter((c) => c !== "transparent").slice(0, 18);
  }, [design]);

  /**
   * Adjusting a photo takes the row over entirely.
   *
   * Returned early rather than folded into the conditions below, so there is
   * no chance of a stray control from another branch appearing beside it.
   */
  if (open) {
    return (
      <div className="no-print flex min-h-[46px] flex-wrap items-center gap-1 border-b border-ink-08 bg-paper px-3 py-1.5">
        <AdjustControls
          el={open}
          set={set}
          onReplace={(src) => {
            begin();
            onChange(replaceImage(design, page, open.id, src));
          }}
          onReset={() => {
            begin();
            onChange(resetFit(design, page, open.id));
          }}
          onDone={() => onAdjust(null)}
        />
      </div>
    );
  }

  return (
    <div className="no-print flex min-h-[46px] flex-wrap items-center gap-1 border-b border-ink-08 bg-paper px-3 py-1.5">
      {what === "page" && (
        <>
          <Colour
            label="Page colour"
            value={current?.background ?? "#ffffff"}
            document={documentColours}
            onPick={(c) => {
              begin();
              const pages = design.pages.slice();
              pages[page] = { ...pages[page], background: c };
              onChange({ ...design, pages });
            }}
          />
          <Divide />
          <Text onClick={onAddPage}>Add page</Text>
          <Text onClick={onDuplicatePage}>Duplicate page</Text>
          <Text onClick={onDeletePage} disabled={design.pages.length < 2}>
            Delete page
          </Text>
          <span className="ml-2 text-[0.78rem] text-ink-30">
            Nothing selected — click something on the page to style it
          </span>
        </>
      )}

      {what === "text" && first?.type === "text" && (
        <TextControls el={first} set={set} document={documentColours} />
      )}

      {what === "image" && first?.type === "image" && !open && (
        <ImageControls
          el={first}
          set={set}
          onAdjust={() => onAdjust(first.id)}
          onReplace={(src) => {
            begin();
            onChange(replaceImage(design, page, first.id, src));
          }}
          onReset={() => {
            begin();
            onChange(resetFit(design, page, first.id));
          }}
        />
      )}

      {what === "shape" && first?.type === "shape" && (
        <ShapeControls el={first} set={set} document={documentColours} />
      )}

      {what === "line" && first?.type === "line" && (
        <LineControls el={first} set={set} document={documentColours} />
      )}

      {(what === "multiple" || what === "group") && (
        <>
          <span className="px-2 text-[0.8rem] font-medium">
            {selected.length} selected
          </span>
          <Divide />
          {what === "group" ? (
            <Text
              onClick={() => {
                begin();
                onChange(ungroup(design, page, selection));
              }}
            >
              Ungroup
            </Text>
          ) : (
            <Text
              onClick={() => {
                begin();
                onChange(group(design, page, selection));
              }}
            >
              Group
            </Text>
          )}
        </>
      )}

      {/* ------------------------------------------------ shared by all of them */}
      {selected.length > 0 && (
        <>
          <Divide />
          <Transparency value={first?.opacity ?? 1} onChange={(v) => set("opacity", v)} />

          <Position
            design={design}
            page={page}
            selection={selection}
            begin={begin}
            onChange={onChange}
          />

          <IconBtn
            label={locked ? "Unlock" : "Lock"}
            onClick={() => {
              begin();
              // `setField` deliberately refuses locked elements, so unlocking
              // has to go around it — otherwise nothing could ever be unlocked.
              const ids = new Set(selection);
              onChange({
                ...design,
                pages: design.pages.map((p, i) =>
                  i === page
                    ? { ...p, elements: p.elements.map((e) => (ids.has(e.id) ? { ...e, locked: !locked } : e)) }
                    : p,
                ),
              });
            }}
          >
            {locked ? (
              <>
                <path d="M6 9V6.5a4 4 0 0 1 8 0V9" />
                <rect x="4.5" y="9" width="11" height="7.5" rx="1.5" />
              </>
            ) : (
              <>
                <path d="M7 9V6.5a3 3 0 0 1 5.9-.8" />
                <rect x="4.5" y="9" width="11" height="7.5" rx="1.5" />
              </>
            )}
          </IconBtn>

          <IconBtn
            label="Duplicate"
            onClick={() => {
              begin();
              const r = duplicateElements(design, page, selection);
              onChange(r.design);
              onSelect(r.ids);
            }}
          >
            <path d="M7 3.5h9v9" />
            <rect x="4" y="7" width="9" height="9.5" rx="1.2" />
          </IconBtn>

          <IconBtn
            label="Delete"
            onClick={() => {
              begin();
              onChange(removeElements(design, page, selection));
              onSelect([]);
            }}
          >
            <path d="M4.5 6h11" />
            <path d="M7.5 6V4.5h5V6" />
            <path d="M6 6l.7 10.5h6.6L14 6" />
          </IconBtn>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ text */

function TextControls({
  el,
  set,
  document: docColours,
}: {
  el: TextElement;
  set: (f: string, v: unknown) => void;
  document: string[];
}) {
  return (
    <>
      <FontPicker value={el.font} onPick={(f) => set("font", f)} />
      <SizeBox value={el.size} onChange={(v) => set("size", v)} />
      <Colour label="Text colour" value={el.color} document={docColours} onPick={(c) => set("color", c)} />
      <Divide />

      <Toggle on={el.bold} label="Bold" onClick={() => set("bold", !el.bold)}>
        <span className="font-bold">B</span>
      </Toggle>
      <Toggle on={el.italic} label="Italic" onClick={() => set("italic", !el.italic)}>
        <span className="italic font-serif">I</span>
      </Toggle>
      <Toggle on={el.underline} label="Underline" onClick={() => set("underline", !el.underline)}>
        <span className="underline">U</span>
      </Toggle>
      <Toggle on={el.caps} label="Capitals" onClick={() => set("caps", !el.caps)}>
        <span className="text-[0.72rem] font-semibold tracking-tight">AA</span>
      </Toggle>
      <Divide />

      {(["left", "center", "right", "justify"] as const).map((a) => (
        <Toggle key={a} on={el.align === a} label={`Align ${a}`} onClick={() => set("align", a)}>
          <svg viewBox="0 0 20 20" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 6h12" />
            <path d={a === "left" ? "M4 10h7" : a === "right" ? "M9 10h7" : a === "center" ? "M6.5 10h7" : "M4 10h12"} />
            <path d={a === "left" ? "M4 14h9" : a === "right" ? "M7 14h9" : a === "center" ? "M5.5 14h9" : "M4 14h12"} />
          </svg>
        </Toggle>
      ))}
      <Divide />

      <Toggle
        on={el.list === "bullet"}
        label="Bulleted list"
        onClick={() => set("list", el.list === "bullet" ? "none" : "bullet")}
      >
        <svg viewBox="0 0 20 20" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="4.5" cy="6" r="1" fill="currentColor" />
          <circle cx="4.5" cy="10" r="1" fill="currentColor" />
          <circle cx="4.5" cy="14" r="1" fill="currentColor" />
          <path d="M8 6h8M8 10h8M8 14h8" />
        </svg>
      </Toggle>
      <Toggle
        on={el.list === "number"}
        label="Numbered list"
        onClick={() => set("list", el.list === "number" ? "none" : "number")}
      >
        <svg viewBox="0 0 20 20" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3.4 4.6h1v3.2M3.2 12.2h2v.9l-2 1.9v.8h2.2" />
          <path d="M8 6h8M8 10h8M8 14h8" />
        </svg>
      </Toggle>

      <Pop
        label="Spacing"
        button={<span className="text-[0.8rem]">Spacing</span>}
        width={244}
      >
        <Slider
          label="Line spacing"
          value={el.lineHeight}
          min={0.8}
          max={3}
          step={0.05}
          onChange={(v) => set("lineHeight", v)}
          format={(v) => v.toFixed(2)}
        />
        <Slider
          label="Letter spacing"
          value={el.letterSpacing}
          min={-0.1}
          max={0.6}
          step={0.01}
          onChange={(v) => set("letterSpacing", v)}
          format={(v) => v.toFixed(2)}
        />
      </Pop>
    </>
  );
}

/**
 * A font size you can type into.
 *
 * The plus and minus stay, because nudging is the common case, but the number
 * is a real input — asked for directly, and right: getting from 11 to 34 by
 * pressing a button twenty-three times is not a size control.
 *
 * It holds its own draft string while being typed, so a half-finished "1" on
 * the way to "18" does not set the size to 1 and reflow the page under the
 * cursor. It commits on blur and on Enter.
 */
function SizeBox({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (raw: string) => {
    const n = Number.parseFloat(raw);
    setDraft(null);
    if (Number.isFinite(n)) onChange(Math.min(400, Math.max(4, n)));
  };

  return (
    <span className="flex items-center rounded-lg border border-ink-15">
      <Step label="Smaller" onClick={() => onChange(Math.max(4, Math.round((value - 1) * 10) / 10))}>
        −
      </Step>
      <input
        value={draft ?? String(Math.round(value * 10) / 10)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") setDraft(null);
        }}
        inputMode="decimal"
        aria-label="Font size"
        className="w-11 bg-transparent py-1 text-center text-[0.8rem] tabular-nums outline-none"
      />
      <Step label="Bigger" onClick={() => onChange(Math.min(400, Math.round((value + 1) * 10) / 10))}>
        +
      </Step>
    </span>
  );
}

function Step({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="grid h-7 w-6 place-items-center text-[0.9rem] text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink"
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- image */

/**
 * A selected frame.
 *
 * The spec's row, in its order: Replace, Edit image, Crop, Flip, shape, and
 * the position controls the shared section already adds. "Edit image" and
 * "Crop" are the same door — double-clicking the picture — because they are
 * the same operation: in a frame, cropping *is* moving the picture behind a
 * fixed hole, and offering them as two buttons that open one mode would be
 * two names for one thing.
 */
function ImageControls({
  el,
  set,
  onAdjust,
  onReplace,
  onReset,
}: {
  el: ImageElement;
  set: (f: string, v: unknown) => void;
  onAdjust: () => void;
  onReplace: (src: string) => void;
  onReset: () => void;
}) {
  const file = useRef<HTMLInputElement>(null);

  async function pick(files: FileList | null) {
    const chosen = files?.[0];
    if (!chosen) return;
    try {
      onReplace(await compressImage(chosen));
    } finally {
      if (file.current) file.current.value = "";
    }
  }

  return (
    <>
      <Text onClick={() => file.current?.click()}>{el.src ? "Replace" : "Add a photo"}</Text>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void pick(e.target.files)}
      />

      {el.src && (
        <>
          <Text onClick={onAdjust}>Crop</Text>
          <Divide />
          <Text onClick={() => set("flipX", !el.flipX)}>Flip across</Text>
          <Text onClick={() => set("flipY", !el.flipY)}>Flip down</Text>
        </>
      )}

      <Divide />
      <Toggle
        on={el.shape === "circle"}
        label="Circle"
        onClick={() => set("shape", el.shape === "circle" ? "rect" : "circle")}
      >
        <svg viewBox="0 0 20 20" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="10" r="6.2" />
        </svg>
      </Toggle>
      {el.shape === "rect" && (
        <Pop label="Corners" button={<span className="text-[0.8rem]">Corners</span>} width={230}>
          <Slider
            label="Corner radius"
            value={el.radius}
            min={0}
            max={30}
            step={0.5}
            onChange={(v) => set("radius", v)}
            format={(v) => `${v.toFixed(1)}mm`}
          />
        </Pop>
      )}

      {el.src && (
        <Pop label="Adjust" button={<span className="text-[0.8rem]">Adjust</span>} width={244}>
          <Slider
            label="Zoom the picture"
            value={el.fit.scale}
            min={1}
            max={4}
            step={0.02}
            onChange={(v) => set("fit", coverFit({ ...el.fit, scale: v }))}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            label="Move across"
            value={el.fit.x}
            min={0}
            max={100}
            step={1}
            onChange={(v) => set("fit", coverFit({ ...el.fit, x: v }))}
            format={(v) => `${Math.round(v)}%`}
          />
          <Slider
            label="Move down"
            value={el.fit.y}
            min={0}
            max={100}
            step={1}
            onChange={(v) => set("fit", coverFit({ ...el.fit, y: v }))}
            format={(v) => `${Math.round(v)}%`}
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onReset}
            className="mt-1 w-full rounded-lg border border-ink-15 py-1.5 text-[0.78rem] font-medium transition-colors hover:border-ink"
          >
            Reset the picture
          </button>
        </Pop>
      )}
    </>
  );
}

/**
 * A picture open for adjustment: the whole row, and nothing else.
 *
 * Zoom, flip, replace, the two resets and Done — the spec's list. The frame
 * is not editable from here on purpose; that is the distinction the mode
 * exists to draw, and putting a width box next to a zoom slider would undo it
 * in one click.
 */
function AdjustControls({
  el,
  set,
  onReplace,
  onReset,
  onDone,
}: {
  el: ImageElement;
  set: (f: string, v: unknown) => void;
  onReplace: (src: string) => void;
  onReset: () => void;
  onDone: () => void;
}) {
  const file = useRef<HTMLInputElement>(null);

  async function pick(files: FileList | null) {
    const chosen = files?.[0];
    if (!chosen) return;
    try {
      onReplace(await compressImage(chosen));
    } finally {
      if (file.current) file.current.value = "";
    }
  }

  return (
    <>
      <span className="px-2 text-[0.8rem] font-medium">Adjusting the picture</span>
      <Divide />

      <div className="flex min-w-[13rem] items-center gap-2 px-2">
        <span className="text-[0.76rem] text-ink-50">Zoom</span>
        <input
          type="range"
          min={1}
          max={4}
          step={0.02}
          value={el.fit.scale}
          onChange={(e) => set("fit", coverFit({ ...el.fit, scale: Number(e.target.value) }))}
          className="h-1 flex-1 accent-black"
          aria-label="Zoom the picture"
        />
        <span className="w-10 text-right text-[0.74rem] tabular-nums text-ink-50">
          {Math.round(el.fit.scale * 100)}%
        </span>
      </div>

      <Divide />
      <Text onClick={() => set("flipX", !el.flipX)}>Flip across</Text>
      <Text onClick={() => set("flipY", !el.flipY)}>Flip down</Text>
      <Divide />
      <Text onClick={() => file.current?.click()}>Replace</Text>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void pick(e.target.files)}
      />
      <Text onClick={() => set("fit", coverFit({ ...el.fit, x: 50, y: 50 }))}>Recentre</Text>
      <Text onClick={() => set("fit", coverFit({ ...el.fit, scale: 1 }))}>Reset zoom</Text>
      <Text onClick={onReset}>Reset all</Text>

      <div className="ml-auto pr-1">
        <button
          type="button"
          onClick={onDone}
          className="rounded-full bg-ink px-4 py-1.5 text-[0.8rem] font-semibold text-paper transition-transform hover:scale-[1.03]"
        >
          Done
        </button>
      </div>
    </>
  );
}

/**
 * Shrink a chosen picture before it becomes part of the document.
 *
 * A design is stored as one JSON row, so a 4MB photograph straight off a
 * phone would be carried in every autosave, every undo snapshot and every
 * render of the PDF. Done here rather than server-side because the picture
 * then never leaves the browser at full size at all.
 */
async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1400;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser could not read that picture.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

/* ----------------------------------------------------------------- shape */

function ShapeControls({
  el,
  set,
  document: docColours,
}: {
  el: ShapeElement;
  set: (f: string, v: unknown) => void;
  document: string[];
}) {
  return (
    <>
      <Colour label="Fill" value={el.fill} document={docColours} onPick={(c) => set("fill", c)} />
      <Colour label="Border colour" value={el.stroke} document={docColours} onPick={(c) => set("stroke", c)} outline />
      <Pop label="Border" button={<span className="text-[0.8rem]">Border</span>} width={230}>
        <Slider
          label="Border weight"
          value={el.strokeWidth}
          min={0}
          max={6}
          step={0.1}
          onChange={(v) => set("strokeWidth", v)}
          format={(v) => `${v.toFixed(1)}mm`}
        />
        {el.shape === "rect" && (
          <Slider
            label="Corner radius"
            value={el.radius}
            min={0}
            max={40}
            step={0.5}
            onChange={(v) => set("radius", v)}
            format={(v) => `${v.toFixed(1)}mm`}
          />
        )}
      </Pop>
    </>
  );
}

function LineControls({
  el,
  set,
  document: docColours,
}: {
  el: LineElement;
  set: (f: string, v: unknown) => void;
  document: string[];
}) {
  return (
    <>
      <Colour label="Line colour" value={el.stroke} document={docColours} onPick={(c) => set("stroke", c)} />
      <Pop label="Line style" button={<span className="text-[0.8rem]">Line style</span>} width={230}>
        <Slider
          label="Weight"
          value={el.strokeWidth}
          min={0.1}
          max={6}
          step={0.1}
          onChange={(v) => {
            set("strokeWidth", v);
            set("h", v);
          }}
          format={(v) => `${v.toFixed(1)}mm`}
        />
        <div className="mt-2 flex gap-1">
          {(["solid", "dashed", "dotted"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => set("dash", d)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-[0.75rem] capitalize transition-colors ${
                el.dash === d ? "border-ink bg-ink-04 font-medium" : "border-ink-15 hover:border-ink-30"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </Pop>
    </>
  );
}

/* -------------------------------------------------------------- position */

/**
 * Layers and alignment, in one panel, because they are the same question.
 *
 * "Where is this?" has two answers — where in the stack, and where on the page
 * — and Canva puts both behind one button for that reason. Splitting them
 * means two popovers that each look half empty.
 */
function Position({
  design,
  page,
  selection,
  begin,
  onChange,
}: {
  design: Design;
  page: number;
  selection: string[];
  begin: () => void;
  onChange: (d: Design) => void;
}) {
  const move = (where: "forward" | "backward" | "front" | "back") => {
    begin();
    onChange(layer(design, page, selection, where));
  };
  const put = (to: AlignTo) => {
    begin();
    onChange(align(design, page, selection, to));
  };

  return (
    <Pop label="Position" button={<span className="text-[0.8rem]">Position</span>} width={250}>
      <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-30">Layer</p>
      <div className="grid grid-cols-2 gap-1">
        <Row onClick={() => move("forward")}>Bring forward</Row>
        <Row onClick={() => move("front")}>Bring to front</Row>
        <Row onClick={() => move("backward")}>Send backward</Row>
        <Row onClick={() => move("back")}>Send to back</Row>
      </div>

      <p className="mb-1.5 mt-3 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-30">
        Align {selection.length > 1 ? "to each other" : "to the page"}
      </p>
      <div className="grid grid-cols-3 gap-1">
        {(["left", "centre", "right", "top", "middle", "bottom"] as AlignTo[]).map((a) => (
          <Row key={a} onClick={() => put(a)}>
            <span className="capitalize">{a}</span>
          </Row>
        ))}
      </div>
    </Pop>
  );
}

function Transparency({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Pop
      label="Transparency"
      width={240}
      button={
        <svg viewBox="0 0 20 20" className="h-[16px] w-[16px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="10" r="6.4" />
          <path d="M10 3.6a6.4 6.4 0 0 1 0 12.8z" fill="currentColor" stroke="none" />
        </svg>
      }
    >
      <Slider
        label="Transparency"
        value={value}
        min={0.05}
        max={1}
        step={0.01}
        onChange={onChange}
        format={(v) => `${Math.round(v * 100)}%`}
      />
    </Pop>
  );
}

/* ----------------------------------------------------------------- fonts */

function FontPicker({ value, onPick }: { value: string; onPick: (f: string) => void }) {
  const [q, setQ] = useState("");
  const list = FONTS.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Pop
      label="Font"
      width={252}
      button={<span className="max-w-[8.5rem] truncate text-[0.8rem]">{value}</span>}
      chevron
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search fonts"
        className="mb-2 w-full rounded-lg border border-ink-15 px-2.5 py-1.5 text-[0.8rem] outline-none focus:border-ink-30"
      />
      <div className="max-h-[260px] overflow-y-auto">
        {list.map((f) => (
          <button
            key={f.name}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(f.name)}
            style={{ fontFamily: f.stack }}
            className={`block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-[0.92rem] transition-colors hover:bg-ink-04 ${
              f.name === value ? "bg-ink-04 font-semibold" : ""
            }`}
          >
            {f.name}
          </button>
        ))}
        {!list.length && <p className="px-2.5 py-3 text-[0.8rem] text-ink-30">No font by that name.</p>}
      </div>
    </Pop>
  );
}

/* ---------------------------------------------------------------- colour */

const PALETTE = [
  "#000000", "#3d3d3d", "#7a7a7a", "#b3b3b3", "#e5e5e5", "#ffffff",
  "#1e3a5f", "#2f5bd6", "#14706b", "#5b7a6b", "#5c1f45", "#b06a4f",
  "#c0392b", "#e07a3f", "#e5b53f", "#3f8f4f", "#2f3640", "#7c3aed",
];

function Colour({
  label,
  value,
  document: docColours,
  onPick,
  outline,
}: {
  label: string;
  value: string;
  document: string[];
  onPick: (c: string) => void;
  outline?: boolean;
}) {
  const [hex, setHex] = useState("");

  return (
    <Pop
      label={label}
      width={236}
      button={
        <span
          className="block h-[17px] w-[17px] rounded-[5px] border border-ink-15"
          style={
            value === "transparent"
              ? { backgroundImage: "linear-gradient(45deg,#ddd 25%,transparent 25%,transparent 75%,#ddd 75%)", backgroundSize: "8px 8px" }
              : outline
                ? { boxShadow: `inset 0 0 0 3px ${value}` }
                : { background: value }
          }
        />
      }
    >
      <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-30">{label}</p>

      {docColours.length > 0 && (
        <>
          <p className="mb-1 text-[0.72rem] text-ink-50">In this design</p>
          <Swatches list={docColours} value={value} onPick={onPick} />
        </>
      )}

      <p className="mb-1 mt-2.5 text-[0.72rem] text-ink-50">Colours</p>
      <Swatches list={PALETTE} value={value} onPick={onPick} />

      <div className="mt-3 flex items-center gap-2">
        <label className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-ink-15">
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
            onChange={(e) => onPick(e.target.value)}
            className="absolute -left-2 -top-2 h-12 w-12 cursor-pointer border-0 p-0"
            aria-label="Pick any colour"
          />
        </label>
        <input
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const v = hex.trim().replace(/^#?/, "#");
            if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) {
              onPick(v);
              setHex("");
            }
          }}
          placeholder="#RRGGBB"
          className="min-w-0 flex-1 rounded-lg border border-ink-15 px-2.5 py-1.5 text-[0.8rem] outline-none focus:border-ink-30"
        />
      </div>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onPick("transparent")}
        className="mt-2 w-full rounded-lg border border-ink-15 py-1.5 text-[0.78rem] transition-colors hover:border-ink"
      >
        No colour
      </button>
    </Pop>
  );
}

function Swatches({ list, value, onPick }: { list: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(c)}
          className={`h-6 w-6 rounded-md border transition-transform hover:scale-110 ${
            c === value ? "border-ink ring-2 ring-ink/20" : "border-ink-15"
          }`}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- parts */

function Divide() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-ink-08" />;
}

function Text({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg px-2.5 py-1.5 text-[0.8rem] transition-colors hover:bg-ink-04 disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function Toggle({
  on,
  label,
  onClick,
  children,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid h-8 min-w-[32px] place-items-center rounded-lg px-2 transition-colors ${
        on ? "bg-ink text-paper" : "hover:bg-ink-04"
      }`}
    >
      {children}
    </button>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-ink-04"
    >
      <svg viewBox="0 0 20 20" className="h-[16px] w-[16px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}

function Row({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded-lg border border-ink-08 px-2 py-1.5 text-left text-[0.76rem] transition-colors hover:border-ink-30"
    >
      {children}
    </button>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <label className="mt-2 block first:mt-0">
      <span className="mb-1 flex items-baseline justify-between text-[0.76rem] text-ink-50">
        {label}
        <span className="tabular-nums">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-black"
      />
    </label>
  );
}

/**
 * A popover that closes when it should.
 *
 * "Click anywhere else and the panel closes" sounds like one line and is three
 * separate cases: a click outside, Escape, and the window changing size under
 * an absolutely-positioned panel. All three were asked for and all three are
 * here. `onMouseDown` with `preventDefault` on every control inside means
 * pressing a button never steals focus from the text being edited — otherwise
 * changing the size of a paragraph would end the edit.
 */
function Pop({
  label,
  button,
  width,
  chevron,
  children,
}: {
  label: string;
  button: React.ReactNode;
  width: number;
  chevron?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const resized = () => setOpen(false);
    window.addEventListener("mousedown", away);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", resized);
    return () => {
      window.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", resized);
    };
  }, [open]);

  return (
    <span ref={root} className="relative">
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 transition-colors ${
          open ? "bg-ink-08" : "hover:bg-ink-04"
        }`}
      >
        {button}
        {chevron && (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-ink-50" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="m3 4.5 3 3 3-3" />
          </svg>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-50 rounded-xl border border-ink-08 bg-paper p-3 shadow-[0_2px_6px_rgba(0,0,0,0.06),0_18px_44px_-16px_rgba(0,0,0,0.3)]"
          style={{ width, maxWidth: `calc(100vw - 24px)` }}
        >
          {children}
        </div>
      )}
    </span>
  );
}

/** Kept for the page-size readout in the editor's footer. */
export const PAGE_LABEL = `A4 · ${A4.w} × ${A4.h}mm`;
