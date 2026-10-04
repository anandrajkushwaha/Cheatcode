"use client";

import { useMemo, useRef, useState } from "react";
import { compressPhoto } from "@/lib/app/photo";
import { FONTS, SWATCHES, fontStack, type DocStyle } from "@/lib/app/resume-style";
import { TEMPLATES, showsPhoto, templateById, type Template } from "@/lib/app/resume-templates";
import { shapeOf, type Shape } from "@/lib/app/flow/theme";

/**
 * Design, as a drawer over the form.
 *
 * It used to be a link to `/app/resume/templates`, and that route is now a
 * redirect — so the button went somewhere, the gallery sent you back, and the
 * person who clicked it watched their builder disappear and reappear with
 * nothing changed. Worse than a dead link, because a dead link at least
 * says so.
 *
 * A drawer rather than a page for a reason that outlives the bug: the whole
 * value of changing a template is watching the document change, and a
 * full-page gallery is the one place you cannot see the document. Everything
 * here writes straight through to the preview standing behind it.
 */
export function DesignPanel({
  open,
  onClose,
  templateId,
  onTemplate,
  doc,
  onDoc,
  photo,
  onPhoto,
}: {
  open: boolean;
  onClose: () => void;
  templateId: string;
  onTemplate: (id: string) => void;
  doc: DocStyle;
  onDoc: (next: DocStyle) => void;
  photo: string | null;
  onPhoto: (next: string | null) => void;
}) {
  const [tab, setTab] = useState<"templates" | "style">("templates");
  const [q, setQ] = useState("");
  const current = templateById(templateId);
  const takesPhoto = showsPhoto(current);
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return TEMPLATES;
    return TEMPLATES.filter((t) =>
      `${t.name} ${t.style} ${t.colour} ${t.roles.join(" ")}`.toLowerCase().includes(needle),
    );
  }, [q]);

  if (!open) return null;

  const set = (patch: Partial<DocStyle>) => onDoc({ ...doc, ...patch });

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label="Design">
      <button
        type="button"
        aria-label="Close design"
        onClick={onClose}
        className="flex-1 cursor-default bg-ink/20"
      />
      <div className="flex h-full w-full max-w-[26rem] flex-col border-l border-ink-08 bg-paper shadow-[0_0_40px_rgba(0,0,0,0.12)]">
        <header className="flex h-14 items-center gap-3 border-b border-ink-08 px-4">
          <div className="min-w-0 flex-1">
            <p className="text-[0.95rem] font-semibold leading-tight">Design</p>
            <p className="truncate text-[0.74rem] text-ink-30">{current.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[0.85rem] text-ink-50 transition-colors hover:text-ink"
          >
            Done
          </button>
        </header>

        <div className="grid grid-cols-2 gap-1 border-b border-ink-08 p-1.5">
          {(["templates", "style"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`rounded-lg py-2 text-[0.84rem] capitalize transition-colors ${
                tab === k ? "bg-ink font-medium text-paper" : "text-ink-50 hover:text-ink"
              }`}
            >
              {k === "style" ? "Colour & type" : "Templates"}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "templates" ? (
            <>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search templates"
                className="mb-3 w-full rounded-xl border border-ink-15 bg-paper px-3.5 py-2.5 text-[16px] outline-none transition-colors placeholder:text-ink-30 focus:border-ink-50 sm:text-[0.9rem]"
              />
              <div className="grid grid-cols-3 gap-2.5">
                {shown.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTemplate(t.id)}
                    title={t.name}
                    className={`group rounded-xl border p-1.5 text-left transition-colors ${
                      t.id === templateId
                        ? "border-ink bg-ink-04"
                        : "border-ink-08 hover:border-ink-30"
                    }`}
                  >
                    <Thumb t={t} />
                    <p className="mt-1.5 line-clamp-2 text-[0.68rem] leading-tight text-ink-50">
                      {t.name}
                    </p>
                  </button>
                ))}
              </div>
              {shown.length === 0 && (
                <p className="py-10 text-center text-[0.85rem] text-ink-30">
                  Nothing matches “{q}”.
                </p>
              )}
            </>
          ) : (
            <div className="space-y-6">
              {/* ------------------------------------------------- accent */}
              <Field label="Accent" onReset={doc.accent ? () => set({ accent: undefined }) : undefined}>
                <div className="flex flex-wrap gap-2">
                  {[current.theme.accent ?? "#111111", ...SWATCHES]
                    .filter((c, i, a) => a.indexOf(c) === i)
                    .map((c, i) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => set({ accent: i === 0 ? undefined : c })}
                        aria-label={i === 0 ? "The template's own colour" : c}
                        style={{ background: c }}
                        className={`h-7 w-7 rounded-full ring-offset-2 transition-shadow ${
                          (doc.accent ?? current.theme.accent) === c
                            ? "ring-2 ring-ink"
                            : "ring-1 ring-ink-08"
                        }`}
                      />
                    ))}
                </div>
              </Field>

              {/* --------------------------------------------------- font */}
              <Field label="Typeface" onReset={doc.font ? () => set({ font: undefined }) : undefined}>
                <select
                  value={doc.font ?? ""}
                  onChange={(e) => set({ font: e.target.value || undefined })}
                  className="w-full rounded-xl border border-ink-15 bg-paper px-3 py-2.5 text-[0.9rem] outline-none focus:border-ink-50"
                  style={{ fontFamily: fontStack(doc.font) }}
                >
                  <option value="">The template&rsquo;s own</option>
                  {FONTS.map((f) => (
                    <option key={f.name} value={f.name} style={{ fontFamily: f.stack }}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </Field>

              {/* -------------------------------------------- size, space */}
              <Slider
                label="Text size"
                value={doc.scale ?? 1}
                min={0.85}
                max={1.2}
                onChange={(v) => set({ scale: v === 1 ? undefined : v })}
              />
              <Slider
                label="Spacing"
                value={doc.density ?? 1}
                min={0.8}
                max={1.3}
                onChange={(v) => set({ density: v === 1 ? undefined : v })}
              />

              {/* -------------------------------------------------- photo */}
              {takesPhoto && (
                <Field label="Photo">
                  <div className="flex items-center gap-3">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" className="h-14 w-14 rounded-full object-cover" />
                    ) : (
                      <div className="grid h-14 w-14 place-items-center rounded-full border border-dashed border-ink-15 text-[0.7rem] text-ink-30">
                        none
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => file.current?.click()}
                        className="rounded-lg border border-ink-15 px-3 py-1.5 text-[0.8rem] transition-colors hover:border-ink disabled:opacity-40"
                      >
                        {busy ? "Working…" : photo ? "Replace" : "Upload"}
                      </button>
                      {photo && (
                        <button
                          type="button"
                          onClick={() => onPhoto(null)}
                          className="text-left text-[0.78rem] text-ink-30 transition-colors hover:text-ink"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  {error && <p className="mt-2 text-[0.76rem] text-[#c0392b]">{error}</p>}
                  <input
                    ref={file}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      setBusy(true);
                      setError(null);
                      try {
                        onPhoto(await compressPhoto(f));
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "That image could not be read.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                </Field>
              )}

              <button
                type="button"
                onClick={() => onDoc({})}
                className="text-[0.82rem] text-ink-30 underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                Back to the template&rsquo;s own look
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ bits */

function Field({
  label,
  children,
  onReset,
}: {
  label: string;
  children: React.ReactNode;
  onReset?: () => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[0.82rem] font-medium">{label}</span>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-[0.74rem] text-ink-30 transition-colors hover:text-ink"
          >
            Reset
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[0.82rem] font-medium">{label}</span>
        <span className="text-[0.74rem] text-ink-30">
          {value === 1 ? "Template" : `${Math.round(value * 100)}%`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Math.round(Number(e.target.value) * 100) / 100)}
        className="w-full accent-ink"
      />
    </div>
  );
}

/**
 * The template, as a diagram.
 *
 * Not a rendering of the résumé. Sixty live documents in a scrolling drawer
 * is sixty measuring passes and a panel that stutters when you type in the
 * search box — and at 54×76 pixels a real page is grey fuzz anyway. What a
 * person is choosing between at this size is the *shape*: where the colour
 * is, which side the narrow column is on, whether there is a band. So that is
 * what is drawn, in the template's own colours, from the same `shapeOf` the
 * renderer lays the real page out with. The document itself is the full-size
 * preview standing right behind the drawer.
 */
function Thumb({ t }: { t: Template }) {
  const s: Shape = shapeOf(t.id);
  const accent = t.theme.accent ?? "#111111";
  const wash = t.theme.wash ?? accent;
  const bar = (w: string, dark = false) => (
    <div style={{ height: 2, width: w, borderRadius: 1, background: dark ? "#9aa0a6" : "#d7dade" }} />
  );
  const lines = (n: number, dark = false) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i}>{bar(i % 3 === 2 ? "62%" : "100%", dark)}</div>
      ))}
    </div>
  );

  const main = (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, padding: 4, minWidth: 0 }}>
      {s.header === "plain" && (
        <>
          <div style={{ height: 4, width: "66%", borderRadius: 1, background: accent }} />
          {bar("44%")}
        </>
      )}
      <div style={{ height: 2, width: "34%", borderRadius: 1, background: accent }} />
      {lines(4)}
      <div style={{ height: 2, width: "30%", borderRadius: 1, background: accent }} />
      {lines(3)}
    </div>
  );

  const aside = (
    <div
      style={{
        width: `${Math.round((s.asideMm / 210) * 100)}%`,
        background: s.asideFill ? wash : undefined,
        borderRight: s.asideRule && s.aside === "left" ? "1px solid #d7dade" : undefined,
        borderLeft: s.asideRule && s.aside === "right" ? "1px solid #d7dade" : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        padding: 4,
      }}
    >
      {showsPhoto(t) && (
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: s.squarePhoto ? 2 : "50%",
            margin: "0 auto",
            background: s.asideFill ? "rgba(255,255,255,0.45)" : "#e6e8ea",
          }}
        />
      )}
      <div style={{ height: 2, width: "70%", borderRadius: 1, background: s.asideFill ? "rgba(255,255,255,0.8)" : accent }} />
      {lines(3, s.asideFill)}
      <div style={{ height: 2, width: "60%", borderRadius: 1, background: s.asideFill ? "rgba(255,255,255,0.8)" : accent }} />
      {lines(2, s.asideFill)}
    </div>
  );

  return (
    <div
      aria-hidden="true"
      style={{
        aspectRatio: "210 / 297",
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 4,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontSize: 0,
      }}
    >
      {s.header === "band" && (
        <div
          style={{
            background: accent,
            padding: 4,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            flex: "0 0 auto",
          }}
        >
          <div style={{ height: 4, width: "62%", borderRadius: 1, background: "rgba(255,255,255,0.92)" }} />
          <div style={{ height: 2, width: "40%", borderRadius: 1, background: "rgba(255,255,255,0.6)" }} />
          {s.bandSummary && (
            <div style={{ height: 2, width: "86%", borderRadius: 1, background: "rgba(255,255,255,0.4)" }} />
          )}
        </div>
      )}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {s.aside === "left" && aside}
        {main}
        {s.aside === "right" && aside}
      </div>
      {s.footerBand && <div style={{ height: 9, background: accent, flex: "0 0 auto" }} />}
    </div>
  );
}
