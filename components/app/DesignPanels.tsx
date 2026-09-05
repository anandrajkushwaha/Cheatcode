"use client";

import { useRef, useState } from "react";
import { DesignPage } from "@/components/app/DesignPage";
import { A4, image, line, shape, text, type Design, type Element } from "@/lib/app/design";
import { seedDesign } from "@/lib/app/design-seed";
import type { Resume } from "@/lib/app/resume-schema";
import { TEMPLATES } from "@/lib/app/resume-templates";

/**
 * The left rail and the panel it opens.
 *
 * Straight out of the PRD (§4, §5): a permanent vertical rail of tools, one
 * panel at a time to the right of it, each panel with its own search and its
 * own content. What is *not* here is as deliberate as what is — no Draw, no
 * Charts, no Video, no Apps. Each of those is a product, and shipping an empty
 * panel with a coming-soon label is worse than not having the button.
 *
 * Adding something always puts it in the middle of the page rather than at a
 * remembered cursor position. It is the one place a new element is guaranteed
 * to be visible, and the person's next action is to drag it anyway.
 */

export type PanelId = "templates" | "elements" | "text" | "uploads";

const TOOLS: { id: PanelId; label: string; icon: React.ReactNode }[] = [
  {
    id: "templates",
    label: "Design",
    icon: (
      <>
        <rect x="3.5" y="3.5" width="5.5" height="13" rx="1" />
        <rect x="11" y="3.5" width="5.5" height="6" rx="1" />
        <rect x="11" y="11.5" width="5.5" height="5" rx="1" />
      </>
    ),
  },
  {
    id: "elements",
    label: "Elements",
    icon: (
      <>
        <circle cx="6.5" cy="6.5" r="3" />
        <rect x="11" y="3.5" width="6" height="6" rx="1" />
        <path d="M6.5 11 10 17H3z" />
        <path d="M11.5 13.5h5.5" />
      </>
    ),
  },
  {
    id: "text",
    label: "Text",
    icon: (
      <>
        <path d="M4 5.5h12" />
        <path d="M10 5.5v11" />
      </>
    ),
  },
  {
    id: "uploads",
    label: "Uploads",
    icon: (
      <>
        <path d="M10 15V5m0 0L6.5 8.5M10 5l3.5 3.5" />
        <path d="M3.5 15.5v1.5h13v-1.5" />
      </>
    ),
  },
];

export function LeftRail({
  open,
  onOpen,
}: {
  open: PanelId | null;
  onOpen: (id: PanelId | null) => void;
}) {
  return (
    <nav className="no-print flex w-[68px] shrink-0 flex-col gap-1 border-r border-ink-08 bg-paper py-2">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onOpen(open === t.id ? null : t.id)}
          aria-pressed={open === t.id}
          className={`mx-1.5 flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[0.66rem] font-medium transition-colors ${
            open === t.id ? "bg-ink text-paper" : "text-ink-50 hover:bg-ink-04 hover:text-ink"
          }`}
        >
          <svg viewBox="0 0 20 20" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            {t.icon}
          </svg>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

/* ----------------------------------------------------------------- panel */

export function SidePanel({
  id,
  onClose,
  content,
  design,
  page,
  begin,
  onChange,
  onSelect,
  onReplacePage,
}: {
  id: PanelId;
  onClose: () => void;
  /** The résumé this design was seeded from, for the template previews. */
  content: Resume;
  design: Design;
  page: number;
  begin: () => void;
  onChange: (d: Design) => void;
  onSelect: (ids: string[]) => void;
  onReplacePage: (elements: Element[], background: string) => void;
}) {
  /** Put a new element in the middle of the page and select it. */
  function add(el: Element) {
    begin();
    const centred = { ...el, x: (A4.w - el.w) / 2, y: (A4.h - el.h) / 2 };
    const pages = design.pages.slice();
    pages[page] = { ...pages[page], elements: [...pages[page].elements, centred] };
    onChange({ ...design, pages });
    onSelect([centred.id]);
  }

  return (
    <aside className="no-print flex w-[286px] shrink-0 flex-col border-r border-ink-08 bg-paper">
      <header className="flex items-center justify-between px-4 py-3">
        <h2 className="text-[0.86rem] font-semibold capitalize">
          {id === "templates" ? "Design" : id}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="-m-1 rounded-lg p-1.5 text-ink-30 transition-colors hover:bg-ink-04 hover:text-ink"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
        {id === "templates" && <Templates content={content} onApply={onReplacePage} />}
        {id === "elements" && <Elements onAdd={add} />}
        {id === "text" && <TextBlocks onAdd={add} />}
        {id === "uploads" && <Uploads design={design} onAdd={add} />}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------- templates */

function Templates({
  content,
  onApply,
}: {
  content: Resume;
  onApply: (elements: Element[], background: string) => void;
}) {
  const [q, setQ] = useState("");
  const list = TEMPLATES.filter((t) =>
    `${t.name} ${t.style} ${t.colour}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search templates"
        className="mb-3 w-full rounded-xl border border-ink-15 px-3 py-2 text-[0.82rem] outline-none focus:border-ink-30"
      />
      <p className="mb-3 text-[0.76rem] leading-relaxed text-ink-50">
        Applying one replaces this page with that design, filled in with your details. Undo brings
        the old page back.
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        {list.map((t) => {
          const seeded = seedDesign(content, t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onApply(seeded.pages[0].elements, seeded.pages[0].background)}
              className="group text-left"
            >
              {/* A real render, shrunk. A picture of a template that is not
                  the template is how a gallery starts lying. */}
              <span className="block overflow-hidden rounded-lg border border-ink-08 transition-colors group-hover:border-ink-30">
                <span
                  className="block"
                  style={{ width: 118, height: 118 * (A4.h / A4.w) }}
                >
                  <span
                    className="block origin-top-left"
                    style={{ transform: `scale(${118 / (A4.w * (96 / 25.4))})` }}
                  >
                    <DesignPage page={seeded.pages[0]} />
                  </span>
                </span>
              </span>
              <span className="mt-1.5 block text-[0.72rem] leading-tight text-ink-50">{t.name}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* -------------------------------------------------------------- elements */

function Elements({ onAdd }: { onAdd: (el: Element) => void }) {
  const shapes = [
    { kind: "rect" as const, label: "Square" },
    { kind: "ellipse" as const, label: "Circle" },
    { kind: "triangle" as const, label: "Triangle" },
    { kind: "diamond" as const, label: "Diamond" },
  ];

  return (
    <>
      <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-30">Shapes</p>
      <div className="grid grid-cols-4 gap-2">
        {shapes.map((s) => (
          <button
            key={s.kind}
            type="button"
            title={s.label}
            onClick={() => onAdd(shape({ shape: s.kind, w: 40, h: 40, fill: "#2f3640" }))}
            className="grid aspect-square place-items-center rounded-lg border border-ink-08 transition-colors hover:border-ink-30"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-ink">
              {s.kind === "rect" && <rect x="3" y="3" width="18" height="18" rx="1.5" fill="currentColor" />}
              {s.kind === "ellipse" && <circle cx="12" cy="12" r="9" fill="currentColor" />}
              {s.kind === "triangle" && <polygon points="12,3 21,21 3,21" fill="currentColor" />}
              {s.kind === "diamond" && <polygon points="12,2 22,12 12,22 2,12" fill="currentColor" />}
            </svg>
          </button>
        ))}
      </div>

      <p className="mb-2 mt-5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-30">Lines</p>
      <div className="space-y-2">
        {(["solid", "dashed", "dotted"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onAdd(line({ w: 90, h: 0.5, strokeWidth: 0.5, dash: d }))}
            className="flex w-full items-center gap-3 rounded-lg border border-ink-08 px-3 py-2.5 transition-colors hover:border-ink-30"
          >
            <span className="flex-1" style={{ borderTop: `2px ${d} #111` }} />
            <span className="text-[0.74rem] capitalize text-ink-50">{d}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ text */

function TextBlocks({ onAdd }: { onAdd: (el: Element) => void }) {
  const blocks = [
    { label: "Add a heading", size: 28, bold: true, preview: "text-[1.4rem] font-bold" },
    { label: "Add a subheading", size: 16, bold: true, preview: "text-[1.05rem] font-semibold" },
    { label: "Add body text", size: 11, bold: false, preview: "text-[0.86rem]" },
    { label: "Add small print", size: 8.5, bold: false, preview: "text-[0.72rem] text-ink-50" },
  ];

  return (
    <>
      <div className="space-y-2">
        {blocks.map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={() =>
              onAdd(text({ text: b.label.replace("Add a ", "").replace("Add ", ""), size: b.size, bold: b.bold, w: 120, h: b.size * 0.36 * 1.35 }))
            }
            className={`w-full rounded-xl border border-ink-08 px-3 py-3 text-left transition-colors hover:border-ink-30 ${b.preview}`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <p className="mb-2 mt-5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-30">
        Ready-made
      </p>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() =>
            onAdd(
              text({
                text: "SECTION HEADING",
                size: 8.5,
                bold: true,
                caps: true,
                letterSpacing: 0.09,
                w: 120,
                h: 4,
              }),
            )
          }
          className="w-full rounded-xl border border-ink-08 px-3 py-3 text-left text-[0.7rem] font-bold uppercase tracking-[0.09em] transition-colors hover:border-ink-30"
        >
          Section heading
        </button>
        <button
          type="button"
          onClick={() =>
            onAdd(
              text({
                text: "A first point\nA second point\nA third point",
                size: 9.5,
                list: "bullet",
                w: 120,
                h: 16,
              }),
            )
          }
          className="w-full rounded-xl border border-ink-08 px-3 py-3 text-left text-[0.8rem] transition-colors hover:border-ink-30"
        >
          • Bulleted list
        </button>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- uploads */

/**
 * A photograph, made small enough to live inside a document row.
 *
 * The whole design is stored as one jsonb value, so an untouched 6MB phone
 * photograph would be 8MB of base64 in a single database row and would be sent
 * again on every autosave. It is resized to fit inside 1400px and then
 * re-encoded at falling quality until it is under 200KB — which was asked for
 * explicitly and is about right for a picture that prints at 40mm across.
 *
 * The aspect ratio is kept rather than cropped square: the element has crop
 * controls of its own, and a crop applied here could not be undone.
 */
async function compress(file: File, limit = 200 * 1024): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("That file could not be read."));
    r.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("That does not look like an image."));
    i.src = dataUrl;
  });

  const long = Math.max(img.width, img.height);
  const k = long > 1400 ? 1400 / long : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * k));
  canvas.height = Math.max(1, Math.round(img.height * k));
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);

  for (let q = 0.88; q >= 0.4; q -= 0.08) {
    const out = canvas.toDataURL("image/jpeg", q);
    if (out.length * 0.75 <= limit) return out;
  }
  return canvas.toDataURL("image/jpeg", 0.4);
}

function Uploads({ design, onAdd }: { design: Design; onAdd: (el: Element) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pictures already in this design, so one can be used again on another page
  // without being uploaded twice.
  const used = [
    ...new Set(
      design.pages.flatMap((p) => p.elements.filter((e) => e.type === "image").map((e) => e.src)),
    ),
  ];

  async function take(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files).slice(0, 6)) {
        const src = await compress(file);
        const img = await new Promise<HTMLImageElement>((resolve) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.src = src;
        });
        const w = 55;
        onAdd(image({ src, w, h: (w * img.height) / img.width }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="w-full rounded-xl bg-ink py-2.5 text-[0.84rem] font-semibold text-paper transition-transform hover:scale-[1.02] disabled:opacity-50"
      >
        {busy ? "Working…" : "Upload an image"}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void take(e.target.files)}
      />
      <p className="mt-2 text-[0.74rem] leading-relaxed text-ink-50">
        Shrunk to under 200KB in your browser before it goes anywhere.
      </p>
      {error && <p className="mt-2 text-[0.78rem]">{error}</p>}

      {used.length > 0 && (
        <>
          <p className="mb-2 mt-5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-30">
            In this design
          </p>
          <div className="grid grid-cols-3 gap-2">
            {used.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onAdd(image({ src, w: 55, h: 55 }))}
                className="aspect-square overflow-hidden rounded-lg border border-ink-08 transition-colors hover:border-ink-30"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
