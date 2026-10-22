"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The resume photo: optional, uploaded from the form, adjusted before it is
 * kept.
 *
 * The frame on the page is square (or a circle cut from a square) and crops
 * with object-fit: cover, so the crop is done here, once, the way the person
 * wants it — zoom and drag inside a frame the shape of the template's — and
 * what is stored is that square at 600px, a JPEG under 200KB: sharp at the
 * 26–30mm it prints, and inside what the save route accepts (lib/app/photo.ts
 * has the same limit for the same reason).
 *
 * The file they picked is kept for this session, so "Adjust" re-crops the
 * original rather than a crop of a crop.
 */

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_SIDE = 200;
const OUT = 600;
const LIMIT = 200 * 1024;
const VIEW = 260;

type Source = { url: string; w: number; h: number; img: HTMLImageElement };

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("That doesn't look like an image."));
    i.src = url;
  });
}

export function PhotoField({
  photo,
  onPhoto,
  round,
}: {
  photo: string | null;
  onPhoto: (next: string | null) => void;
  /** The template's frame is a circle (most) rather than a rounded square. */
  round: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(f: File) {
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setError("Use a JPG, PNG or WebP photo.");
    if (f.size > MAX_BYTES) return setError("That photo is over 10 MB. Pick a smaller one.");
    const url = URL.createObjectURL(f);
    try {
      const img = await load(url);
      if (Math.min(img.naturalWidth, img.naturalHeight) < MIN_SIDE) {
        URL.revokeObjectURL(url);
        return setError("That photo is too small — it would print blurry. Use one at least 200 × 200 px.");
      }
      if (source) URL.revokeObjectURL(source.url);
      setSource({ url, w: img.naturalWidth, h: img.naturalHeight, img });
      setEditing(true);
    } catch (e) {
      URL.revokeObjectURL(url);
      setError(e instanceof Error ? e.message : "That photo could not be read.");
    }
  }

  async function adjust() {
    if (source) return setEditing(true);
    if (!photo) return;
    // From an earlier session: only the saved square is left, so adjust that.
    const img = await load(photo).catch(() => null);
    if (!img) return;
    setSource({ url: photo, w: img.naturalWidth, h: img.naturalHeight, img });
    setEditing(true);
  }

  const shape = round ? "rounded-full" : "rounded-lg";

  return (
    <div>
      <div className="flex items-center gap-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Your photo" className={`h-16 w-16 object-cover ${shape}`} />
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className={`grid h-16 w-16 place-items-center border border-dashed border-ink-15 text-ink-30 transition-colors hover:border-ink hover:text-ink ${shape}`}
            aria-label="Upload a photo"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M10 4v12M4 10h12" />
            </svg>
          </button>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="rounded-lg border border-ink-15 px-3 py-1.5 text-[0.8rem] transition-colors hover:border-ink"
            >
              {photo ? "Replace" : "Upload photo"}
            </button>
            {photo && (
              <>
                <button
                  type="button"
                  onClick={() => void adjust()}
                  className="rounded-lg border border-ink-15 px-3 py-1.5 text-[0.8rem] transition-colors hover:border-ink"
                >
                  Adjust
                </button>
                <button
                  type="button"
                  onClick={() => onPhoto(null)}
                  className="px-1 text-[0.8rem] text-ink-30 transition-colors hover:text-ink"
                >
                  Remove
                </button>
              </>
            )}
          </div>
          <p className="mt-1.5 text-[0.74rem] leading-snug text-ink-30">
            Optional · JPG, PNG or WebP up to 10 MB · a clear, front-facing photo works best
          </p>
        </div>
      </div>
      {error && <p className="mt-2 text-[0.78rem] text-[#c0392b]">{error}</p>}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void pick(f);
        }}
      />

      {editing && source && (
        <Cropper
          source={source}
          round={round}
          onCancel={() => setEditing(false)}
          onDone={(out) => {
            onPhoto(out);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

function Cropper({
  source,
  round,
  onCancel,
  onDone,
}: {
  source: Source;
  round: boolean;
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // At zoom 1 the short side fills the frame; the long side overflows.
  const scale = (VIEW / Math.min(source.w, source.h)) * zoom;
  const dw = source.w * scale;
  const dh = source.h * scale;
  const clamp = (x: number, y: number) => ({
    x: Math.max(-(dw - VIEW) / 2, Math.min((dw - VIEW) / 2, x)),
    y: Math.max(-(dh - VIEW) / 2, Math.min((dh - VIEW) / 2, y)),
  });

  // Zooming out can leave an edge showing; pull the picture back over it.
  useEffect(() => {
    setOff((o) => clamp(o.x, o.y));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onCancel]);

  function save() {
    const k = OUT / VIEW;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source.img, ((VIEW - dw) / 2 + off.x) * k, ((VIEW - dh) / 2 + off.y) * k, dw * k, dh * k);
    let out = canvas.toDataURL("image/jpeg", 0.9);
    for (let q = 0.82; out.length * 0.75 > LIMIT && q >= 0.4; q -= 0.08) out = canvas.toDataURL("image/jpeg", q);
    onDone(out);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true" aria-label="Adjust photo">
      <button type="button" aria-label="Cancel" className="absolute inset-0 cursor-default" onClick={onCancel} />
      <div className="relative w-full rounded-t-[1.5rem] bg-paper p-6 shadow-2xl sm:max-w-[22rem] sm:rounded-[1.5rem]">
        <h2 className="text-[1.1rem] font-semibold tracking-[-0.02em]">Adjust your photo</h2>
        <p className="mt-1 text-[0.82rem] text-ink-50">Drag to move · use the slider to zoom</p>

        <div
          className="relative mx-auto mt-5 touch-none select-none overflow-hidden rounded-xl bg-ink-08"
          style={{ width: VIEW, height: VIEW, cursor: drag.current ? "grabbing" : "grab" }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            setOff(clamp(d.ox + e.clientX - d.x, d.oy + e.clientY - d.y));
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onWheel={(e) => setZoom((z) => Math.max(1, Math.min(3, z - e.deltaY * 0.002)))}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={source.url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none"
            style={{ width: dw, height: dh, left: (VIEW - dw) / 2 + off.x, top: (VIEW - dh) / 2 + off.y }}
          />
          {/* The frame as the template draws it; outside it is dimmed. */}
          <div
            className={`pointer-events-none absolute inset-0 ${round ? "rounded-full" : "rounded-[6%]"}`}
            style={{ boxShadow: "0 0 0 999px rgba(255,255,255,0.6)", outline: "1px solid rgba(0,0,0,0.15)" }}
          />
        </div>

        <label className="mt-5 flex items-center gap-3 text-[0.78rem] text-ink-50">
          <span>Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-black"
          />
        </label>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-ink-15 py-2.5 text-[0.86rem] transition-colors hover:border-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="flex-1 rounded-full bg-ink py-2.5 text-[0.86rem] font-medium text-paper transition-opacity hover:opacity-90"
          >
            Use photo
          </button>
        </div>
      </div>
    </div>
  );
}
