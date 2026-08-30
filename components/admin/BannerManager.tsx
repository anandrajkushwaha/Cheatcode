"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImageField } from "./ImageField";
import { PLACEMENTS, type Banner, type BannerStatRow, type Placement } from "@/lib/admin/banners";

const blank = (): Partial<Banner> => ({
  name: "",
  placement: "in_article",
  eyebrow: "",
  title: "",
  body: "",
  cta_label: "",
  cta_href: "",
  image_url: "",
  image_alt: "",
  theme: "dark",
  active: true,
  sort_order: 0,
});

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const ist = new Date(d.getTime() + (330 + d.getTimezoneOffset()) * 60000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ist.getFullYear()}-${pad(ist.getMonth() + 1)}-${pad(ist.getDate())}T${pad(ist.getHours())}:${pad(ist.getMinutes())}`;
}
const fromLocalInput = (v: string) => (v ? new Date(`${v}:00+05:30`).toISOString() : null);

export function BannerManager({
  banners,
  stats,
}: {
  banners: Banner[];
  stats: Record<string, BannerStatRow>;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Partial<Banner> | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const set = <K extends keyof Banner>(k: K, v: Banner[K]) =>
    setDraft((d) => ({ ...(d ?? {}), [k]: v }));

  async function upload(file: File): Promise<string | null> {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body });
    const json = await res.json();
    if (!json.ok) {
      setNote({ kind: "err", text: json.hint ? `${json.error} ${json.hint}` : json.error });
      return null;
    }
    return json.url as string;
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setDraft(null);
      setNote({ kind: "ok", text: "Saved. It is live on the site now." });
      router.refresh();
    } catch (e) {
      setNote({ kind: "err", text: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(b: Banner) {
    if (!confirm(`Delete "${b.name}"? Its past click data stays in the reports.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/banner?id=${b.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      router.refresh();
    } catch (e) {
      setNote({ kind: "err", text: e instanceof Error ? e.message : "Delete failed." });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(b: Banner) {
    setBusy(true);
    await fetch("/api/admin/banner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...b, active: !b.active }),
    });
    setBusy(false);
    router.refresh();
  }

  const field =
    "w-full rounded-xl border border-ink-15 px-3.5 py-2.5 text-[0.9rem] outline-none focus:border-ink-30";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em]">Promotional banners</h2>
          <p className="mt-1.5 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
            Your own slots on your own site. Each one records how many people actually saw it and
            how many clicked, so you can tell a banner nobody wants from one nobody scrolled to.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft(blank())}
          className="rounded-full bg-ink px-4 py-2 text-[0.82rem] font-medium text-paper"
        >
          New banner
        </button>
      </div>

      {note && (
        <p
          className={`mt-5 rounded-2xl border p-4 text-[0.88rem] leading-relaxed ${
            note.kind === "ok" ? "border-ink-15 text-ink-70" : "border-ink-30 text-ink"
          }`}
        >
          {note.text}
        </p>
      )}

      {/* ------------------------------------------------------------ editor */}
      {draft && (
        <div className="mt-6 rounded-2xl border border-ink-15 p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[0.75rem] text-ink-50">Internal name</span>
                  <input
                    value={draft.name ?? ""}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Only you see this"
                    className={`mt-1.5 ${field}`}
                  />
                </label>
                <label className="block">
                  <span className="text-[0.75rem] text-ink-50">Where it appears</span>
                  <select
                    value={draft.placement ?? "in_article"}
                    onChange={(e) => set("placement", e.target.value as Placement)}
                    className={`mt-1.5 ${field}`}
                  >
                    {PLACEMENTS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <p className="text-[0.78rem] leading-relaxed text-ink-30">
                {PLACEMENTS.find((p) => p.id === draft.placement)?.where}
              </p>

              <label className="block">
                <span className="text-[0.75rem] text-ink-50">Eyebrow · optional</span>
                <input
                  value={draft.eyebrow ?? ""}
                  onChange={(e) => set("eyebrow", e.target.value)}
                  placeholder="Free tool"
                  className={`mt-1.5 ${field}`}
                />
              </label>

              <label className="block">
                <span className="text-[0.75rem] text-ink-50">Headline</span>
                <input
                  value={draft.title ?? ""}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="The one line people read"
                  className={`mt-1.5 ${field}`}
                />
              </label>

              <label className="block">
                <span className="text-[0.75rem] text-ink-50">Body · optional</span>
                <textarea
                  value={draft.body ?? ""}
                  onChange={(e) => set("body", e.target.value)}
                  rows={3}
                  className={`mt-1.5 resize-none ${field}`}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[0.75rem] text-ink-50">Button text</span>
                  <input
                    value={draft.cta_label ?? ""}
                    onChange={(e) => set("cta_label", e.target.value)}
                    placeholder="Book a session"
                    className={`mt-1.5 ${field}`}
                  />
                </label>
                <label className="block">
                  <span className="text-[0.75rem] text-ink-50">Button link</span>
                  <input
                    value={draft.cta_href ?? ""}
                    onChange={(e) => set("cta_href", e.target.value)}
                    placeholder="/become-a-mentor"
                    className={`mt-1.5 ${field}`}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[0.75rem] text-ink-50">Starts · optional</span>
                  <input
                    type="datetime-local"
                    value={toLocalInput(draft.starts_at ?? null)}
                    onChange={(e) => set("starts_at", fromLocalInput(e.target.value))}
                    className={`mt-1.5 ${field}`}
                  />
                </label>
                <label className="block">
                  <span className="text-[0.75rem] text-ink-50">Ends · optional</span>
                  <input
                    type="datetime-local"
                    value={toLocalInput(draft.ends_at ?? null)}
                    onChange={(e) => set("ends_at", fromLocalInput(e.target.value))}
                    className={`mt-1.5 ${field}`}
                  />
                </label>
              </div>
              <p className="text-[0.78rem] text-ink-30">
                Leave the dates empty to run it until you turn it off. IST.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <span className="text-[0.75rem] text-ink-50">Image · optional</span>
                <div className="mt-2">
                  <ImageField
                    value={draft.image_url ?? ""}
                    onChange={(u) => set("image_url", u)}
                    alt={draft.image_alt ?? ""}
                    onAltChange={(a) => set("image_alt", a)}
                    upload={upload}
                    label="Drop a banner image"
                  />
                </div>
              </div>

              <div>
                <span className="text-[0.75rem] text-ink-50">Look</span>
                <div className="mt-2 flex gap-2">
                  {(["dark", "light"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set("theme", t)}
                      className={`flex-1 rounded-full px-3 py-1.5 text-[0.78rem] capitalize ${
                        (draft.theme ?? "dark") === t
                          ? "bg-ink text-paper"
                          : "border border-ink-15 text-ink-50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* A live preview, because a banner is a visual object and
                  guessing from six form fields is how ugly banners ship. */}
              <div>
                <span className="text-[0.75rem] text-ink-50">Preview</span>
                <div
                  className={`mt-2 overflow-hidden rounded-2xl p-5 ${
                    (draft.theme ?? "dark") === "dark"
                      ? "bg-ink text-paper"
                      : "border border-ink-08 bg-ink-04 text-ink"
                  }`}
                >
                  {draft.eyebrow && (
                    <p className={`text-[0.65rem] uppercase tracking-[0.16em] ${
                      (draft.theme ?? "dark") === "dark" ? "text-white/40" : "text-ink-30"
                    }`}>
                      {draft.eyebrow}
                    </p>
                  )}
                  <p className="mt-1.5 text-[0.98rem] font-medium leading-snug">
                    {draft.title || "Your headline"}
                  </p>
                  {draft.body && (
                    <p className={`mt-1.5 text-[0.8rem] leading-relaxed ${
                      (draft.theme ?? "dark") === "dark" ? "text-white/60" : "text-ink-50"
                    }`}>
                      {draft.body}
                    </p>
                  )}
                  {draft.cta_label && (
                    <span className={`mt-3 inline-block rounded-full px-3.5 py-1.5 text-[0.75rem] font-medium ${
                      (draft.theme ?? "dark") === "dark" ? "bg-paper text-ink" : "bg-ink text-paper"
                    }`}>
                      {draft.cta_label}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 border-t border-ink-08 pt-5">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !(draft.title ?? "").trim()}
              className="rounded-full bg-ink px-5 py-2 text-[0.85rem] font-medium text-paper disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save banner"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="text-[0.85rem] text-ink-50 underline underline-offset-4"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- list */}
      {banners.length === 0 ? (
        <p className="mt-8 text-[0.9rem] leading-relaxed text-ink-30">
          No banners yet. One in the article body usually earns its place first — the reader is
          already committed by the time they reach it.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[820px] text-[0.85rem]">
            <thead>
              <tr className="border-b border-ink-15 text-left text-[0.72rem] uppercase tracking-wider text-ink-30">
                <th className="pb-3 pr-4 font-medium">Banner</th>
                <th className="pb-3 pr-4 font-medium">Slot</th>
                <th className="pb-3 pr-4 text-right font-medium">Seen</th>
                <th className="pb-3 pr-4 text-right font-medium">Clicks</th>
                <th className="pb-3 pr-4 text-right font-medium">CTR</th>
                <th className="pb-3 pr-4 font-medium">State</th>
                <th className="pb-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-08">
              {banners.map((b) => {
                const s = stats[b.id];
                return (
                  <tr key={b.id}>
                    <td className="max-w-[280px] py-3 pr-4">
                      <p className="line-clamp-1 font-medium">{b.title}</p>
                      <p className="text-[0.75rem] text-ink-30">{b.name}</p>
                    </td>
                    <td className="py-3 pr-4 text-ink-50">
                      {PLACEMENTS.find((p) => p.id === b.placement)?.label}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">{s?.views ?? 0}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{s?.clicks ?? 0}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-ink-50">
                      {s?.views ? `${s.ctr}%` : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <button
                        type="button"
                        onClick={() => void toggle(b)}
                        disabled={busy}
                        className={`rounded-full px-2.5 py-1 text-[0.72rem] ${
                          b.active ? "bg-ink text-paper" : "border border-ink-15 text-ink-50"
                        }`}
                      >
                        {b.active ? "live" : "off"}
                      </button>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDraft(b)}
                        className="text-[0.8rem] text-ink-30 underline underline-offset-4 hover:text-ink"
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(b)}
                        className="ml-3 text-[0.8rem] text-ink-30 underline underline-offset-4 hover:text-ink"
                      >
                        delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
