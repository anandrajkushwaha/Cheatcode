"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_PHOTO_FIT,
  FONTS,
  PHOTO_PATH,
  SWATCHES,
  type FieldStyle,
  type PhotoFit,
  type Presentation,
} from "@/lib/app/resume-style";

/**
 * The toolbar, acting on whichever field the caret is in.
 *
 * Two decisions worth writing down.
 *
 * **Every control uses `onMouseDown` with `preventDefault`.** Pressing a
 * toolbar button would otherwise blur the field it is meant to change, and by
 * the time the click landed there would be nothing selected. This is the bug
 * that makes hand-rolled rich text editors feel broken, and it is one line per
 * control to avoid.
 *
 * **Nothing here is disabled when no field is selected — it is dimmed and
 * inert.** A toolbar that disappears or greys out entirely reads as broken;
 * one that plainly says "click a line first" reads as waiting.
 */

type Props = {
  selected: string | null;
  styles: Presentation;
  onStyle: (patch: FieldStyle | null) => void;
  photo: string | null;
  onPhoto: (dataUrl: string | null) => void;
  /** Sections that can be switched on and off, with their current state. */
  sections: { key: string; label: string; hidden: boolean }[];
  onSection: (key: string, hidden: boolean) => void;
  /** False when the chosen template has nowhere to show one. */
  photoSlot: boolean;
  onPhotoFit: (fit: PhotoFit) => void;
};

export function EditorToolbar({
  selected,
  styles,
  onStyle,
  photo,
  onPhoto,
  sections,
  onSection,
  photoSlot,
  onPhotoFit,
}: Props) {
  const [open, setOpen] = useState<"font" | "colour" | "sections" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

  const current: FieldStyle = (selected && styles.fields[selected]) || {};
  const live = Boolean(selected);

  /**
   * Anything outside the toolbar closes whatever is open.
   *
   * `mousedown` rather than `click`, so a popover that covers the thing
   * somebody is reaching for is gone before their press lands on it —
   * otherwise the first click only dismisses and the second does the work.
   * Escape too, because a menu that traps you is worse than one that lingers.
   */
  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const shut = () => setOpen(null);

    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", shut);
    };
  }, []);

  const patch = (p: FieldStyle) => live && onStyle({ ...current, ...p });
  const size = current.size ?? 10;

  async function pickPhoto(f: File) {
    setBusy(true);
    setError(null);
    try {
      onPhoto(await compress(f));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That image didn't work.");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  const fit = styles.photoFit ?? DEFAULT_PHOTO_FIT;
  const nudge = (patch: Partial<PhotoFit>) => onPhotoFit({ ...fit, ...patch });

  if (selected === PHOTO_PATH && photo) {
    return (
      <div
        ref={root}
        className="no-print relative flex flex-wrap items-center gap-3 border-b border-ink-08 bg-paper px-3 py-2"
      >
        <span className="text-[0.8rem] font-medium">Photo</span>

        <label className="flex items-center gap-2 text-[0.78rem] text-ink-50">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={fit.scale}
            onChange={(e) => nudge({ scale: Number(e.target.value) })}
            className="w-32 accent-black"
          />
          <span className="w-9 tabular-nums">{fit.scale.toFixed(2)}×</span>
        </label>

        {/* Nudges rather than a drag surface. A drag inside a 22mm circle is
            fiddly on a trackpad and impossible on a phone; four buttons move
            it predictably and can be held down. */}
        <span className="flex items-center gap-1">
          <Step label="Move left" onClick={() => nudge({ x: Math.max(-50, fit.x - 4) })}>←</Step>
          <Step label="Move right" onClick={() => nudge({ x: Math.min(50, fit.x + 4) })}>→</Step>
          <Step label="Move up" onClick={() => nudge({ y: Math.max(-50, fit.y - 4) })}>↑</Step>
          <Step label="Move down" onClick={() => nudge({ y: Math.min(50, fit.y + 4) })}>↓</Step>
        </span>

        <button
          type="button"
          onClick={() => onPhotoFit(DEFAULT_PHOTO_FIT)}
          className="rounded-full px-3 py-1.5 text-[0.78rem] text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink"
        >
          Reset
        </button>

        <Divider />

        <button
          type="button"
          onClick={() => file.current?.click()}
          className="rounded-full px-3 py-1.5 text-[0.8rem] font-medium text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink"
        >
          Replace
        </button>
        <button
          type="button"
          onClick={() => onPhoto(null)}
          className="rounded-full px-3 py-1.5 text-[0.8rem] text-ink-30 transition-colors hover:bg-ink-04 hover:text-ink"
        >
          Remove
        </button>

        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pickPhoto(f);
          }}
        />
        {error && <span className="text-[0.75rem]">{error}</span>}
      </div>
    );
  }

  return (
    <div
      ref={root}
      className="no-print relative flex flex-wrap items-center gap-1 border-b border-ink-08 bg-paper px-3 py-2"
    >
      {/* ------------------------------------------------------------ font */}
      <Pop
        open={open === "font"}
        onToggle={() => setOpen(open === "font" ? null : "font")}
        label={current.font ?? "Font"}
        wide
        dim={!live}
      >
        <div className="max-h-[320px] w-[240px] overflow-y-auto p-1">
          {FONTS.map((f) => (
            <button
              key={f.name}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                patch({ font: f.name });
                setOpen(null);
              }}
              style={{ fontFamily: f.stack }}
              className={[
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[0.95rem] transition-colors hover:bg-ink-04",
                current.font === f.name ? "bg-ink-04" : "",
              ].join(" ")}
            >
              {f.name}
              {!f.web && <span className="text-[0.65rem] text-ink-30">safe</span>}
            </button>
          ))}
        </div>
      </Pop>

      {/* ------------------------------------------------------------ size */}
      <div className={`flex items-center rounded-full border border-ink-15 ${live ? "" : "opacity-40"}`}>
        <Step label="Smaller" onClick={() => patch({ size: Math.max(6, size - 0.5) })}>−</Step>
        <span className="w-9 text-center text-[0.82rem] tabular-nums">{size}</span>
        <Step label="Bigger" onClick={() => patch({ size: Math.min(48, size + 0.5) })}>+</Step>
      </div>

      <Divider />

      {/* --------------------------------------------------------- colour */}
      <Pop
        open={open === "colour"}
        onToggle={() => setOpen(open === "colour" ? null : "colour")}
        label={
          <span className="flex items-center gap-1.5">
            <span className="text-[0.9rem] font-semibold leading-none">A</span>
            <span
              className="h-[3px] w-4 rounded-sm"
              style={{ background: current.color ?? "#000" }}
            />
          </span>
        }
        dim={!live}
      >
        <div className="w-[236px] p-3">
          <div className="grid grid-cols-6 gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onMouseDown={(e) => {
                  e.preventDefault();
                  patch({ color: c });
                }}
                style={{ background: c }}
                className={[
                  "h-7 w-7 rounded-full border transition-transform hover:scale-110",
                  current.color === c ? "border-ink ring-2 ring-ink ring-offset-2" : "border-ink-15",
                ].join(" ")}
              />
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-ink-08 pt-3">
            {/* The browser's own picker. Building a saturation square and a hue
                slider would be a week of work to reproduce something every
                platform already ships and everybody already knows. */}
            <input
              type="color"
              value={current.color ?? "#000000"}
              onChange={(e) => patch({ color: e.target.value })}
              className="h-8 w-9 cursor-pointer rounded border border-ink-15 bg-transparent p-0.5"
              aria-label="Pick a colour"
            />
            <input
              type="text"
              value={current.color ?? ""}
              placeholder="#1e3a5f"
              onChange={(e) => {
                const v = e.target.value.trim();
                if (/^#[0-9a-fA-F]{6}$/.test(v)) patch({ color: v.toLowerCase() });
              }}
              className="min-w-0 flex-1 rounded-lg border border-ink-15 px-2.5 py-1.5 font-mono text-[0.8rem] outline-none focus:border-ink"
            />
          </div>

          {current.color && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onStyle({ ...current, color: undefined });
              }}
              className="mt-2 w-full rounded-lg py-1.5 text-[0.78rem] text-ink-50 hover:bg-ink-04 hover:text-ink"
            >
              Back to the template&apos;s colour
            </button>
          )}
        </div>
      </Pop>

      <Toggle on={current.bold} dim={!live} label="Bold" onClick={() => patch({ bold: !current.bold })}>
        <span className="font-bold">B</span>
      </Toggle>
      <Toggle on={current.italic} dim={!live} label="Italic" onClick={() => patch({ italic: !current.italic })}>
        <span className="font-serif italic">I</span>
      </Toggle>
      <Toggle on={current.underline} dim={!live} label="Underline" onClick={() => patch({ underline: !current.underline })}>
        <span className="underline underline-offset-2">U</span>
      </Toggle>

      <Divider />

      <Toggle on={current.align === "left"} dim={!live} label="Align left" onClick={() => patch({ align: "left" })}>
        <Lines widths={[14, 9, 12]} />
      </Toggle>
      <Toggle on={current.align === "center"} dim={!live} label="Centre" onClick={() => patch({ align: "center" })}>
        <Lines widths={[14, 9, 12]} centre />
      </Toggle>
      <Toggle on={current.align === "right"} dim={!live} label="Align right" onClick={() => patch({ align: "right" })}>
        <Lines widths={[14, 9, 12]} right />
      </Toggle>

      <Divider />

      {/* --------------------------------------------------------- photo */}
      {/* Only where the template has a hole for one. Offering an upload that
          lands nowhere is worse than not offering it: somebody spends ten
          minutes deciding whether the failure is theirs. */}
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pickPhoto(f);
        }}
      />
      <button
        type="button"
        onClick={() => file.current?.click()}
        disabled={busy || !photoSlot}
        title={photoSlot ? undefined : "This template doesn't show a photo. Pick a sidebar or header-band one."}
        className="rounded-full px-3 py-1.5 text-[0.8rem] font-medium text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
      >
        {busy ? "Compressing…" : photo ? "Change photo" : "Add photo"}
      </button>
      {photo && photoSlot && (
        <button
          type="button"
          onClick={() => onPhoto(null)}
          className="rounded-full px-2.5 py-1.5 text-[0.8rem] text-ink-30 transition-colors hover:bg-ink-04 hover:text-ink"
        >
          Remove
        </button>
      )}

      <Divider />

      {/* ------------------------------------------------------- sections */}
      <Pop
        open={open === "sections"}
        onToggle={() => setOpen(open === "sections" ? null : "sections")}
        label="Sections"
      >
        <div className="w-[230px] p-2">
          {sections.map((s) => (
            <label
              key={s.key}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.85rem] transition-colors hover:bg-ink-04"
            >
              <input
                type="checkbox"
                checked={!s.hidden}
                onChange={() => onSection(s.key, !s.hidden)}
                className="h-3.5 w-3.5 accent-black"
              />
              {s.label}
            </label>
          ))}
          <p className="px-2.5 pb-1 pt-2 text-[0.72rem] leading-relaxed text-ink-30">
            Switching one off hides it. Nothing you wrote is deleted.
          </p>
        </div>
      </Pop>

      {selected ? null : (
        <span className="ml-2 text-[0.75rem] text-ink-30">Click a line to style it</span>
      )}
      {error && <span className="ml-2 text-[0.75rem]">{error}</span>}
    </div>
  );
}

/* -------------------------------------------------------------- fragments */

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-ink-08" />;
}

function Step({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="px-2.5 py-1 text-[0.95rem] leading-none text-ink-50 transition-colors hover:text-ink"
    >
      {children}
    </button>
  );
}

function Toggle({
  on,
  dim,
  label,
  onClick,
  children,
}: {
  on?: boolean;
  dim?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={label}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={[
        "grid h-8 w-8 place-items-center rounded-lg text-[0.9rem] transition-colors",
        on ? "bg-ink text-paper" : "text-ink-50 hover:bg-ink-04 hover:text-ink",
        dim ? "opacity-40" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Lines({ widths, centre, right }: { widths: number[]; centre?: boolean; right?: boolean }) {
  return (
    <span
      className={`flex flex-col gap-[3px] ${centre ? "items-center" : right ? "items-end" : "items-start"}`}
      aria-hidden
    >
      {widths.map((w, i) => (
        <span key={i} className="h-[1.5px] rounded-full bg-current" style={{ width: w }} />
      ))}
    </span>
  );
}

function Pop({
  open,
  onToggle,
  label,
  children,
  wide,
  dim,
}: {
  open: boolean;
  onToggle: () => void;
  label: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
  dim?: boolean;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onToggle();
        }}
        className={[
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.82rem] font-medium transition-colors",
          open ? "border-ink" : "border-ink-15 hover:border-ink-30",
          wide ? "min-w-[110px] justify-between" : "",
          dim ? "opacity-40" : "",
        ].join(" ")}
      >
        <span className="truncate">{label}</span>
        <svg viewBox="0 0 10 6" className="h-[6px] w-[10px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-ink-08 bg-paper shadow-xl">
          {children}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ the picture */

const MAX_BYTES = 200 * 1024;
const MAX_EDGE = 640;

/**
 * Shrink a photograph until it is small enough to live in a row.
 *
 * Two passes, in this order, because they do different jobs. Resizing to 640px
 * is what actually makes the file small — a phone photo is 4000px wide and no
 * amount of JPEG quality will save that. Stepping the quality down afterwards
 * is the fine adjustment, and it stops at 0.4: below that the artefacts are
 * visible at the size this renders, and a smudged headshot is worse than a
 * slightly larger row.
 *
 * Square-cropped from the centre, because every template that shows one shows
 * it in a circle. Cropping here rather than with CSS means the bytes stored
 * are the bytes displayed.
 */
async function compress(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That isn't an image.");

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That image couldn't be read.");
  });

  const edge = Math.min(bitmap.width, bitmap.height, MAX_EDGE);
  const canvas = document.createElement("canvas");
  canvas.width = edge;
  canvas.height = edge;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't resize images.");

  const side = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    edge,
    edge,
  );
  bitmap.close();

  for (let quality = 0.85; quality >= 0.4; quality -= 0.1) {
    const url = canvas.toDataURL("image/jpeg", quality);
    // A data URL is base64: four characters per three bytes, so the string
    // length overstates the size by a third. Measuring the encoded length is
    // the honest check, since the encoded string is what gets stored.
    if (url.length <= MAX_BYTES) return url;
  }

  throw new Error("That image is too detailed to shrink. Try a smaller crop.");
}
