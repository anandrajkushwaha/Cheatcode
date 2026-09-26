"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { AdminInsight } from "@/lib/insights/query";
import type { InsightTraffic } from "@/lib/admin/insight-traffic";

/**
 * Write an insight, see it as the reader will, publish it.
 *
 * The preview on the right is the card from the Insights tab — image on the
 * left when there is one — so what gets published is what was looked at.
 */
const MAX_WORDS = 70;

type Draft = {
  id?: string;
  title: string;
  summary: string;
  category: "trend" | "guide";
  imageUrl: string;
  sourceName: string;
  sourceUrl: string;
  published: boolean;
};

const BLANK: Draft = {
  title: "",
  summary: "",
  category: "trend",
  imageUrl: "",
  sourceName: "",
  sourceUrl: "",
  published: true,
};

const field =
  "w-full rounded-xl border border-ink-15 bg-paper px-3 py-2 text-[0.85rem] outline-none focus:border-ink-30";
const label = "text-[0.74rem] font-medium uppercase tracking-[0.12em] text-ink-30";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function InsightsManager({
  items,
  canDelete,
  traffic,
}: {
  items: AdminInsight[];
  canDelete: boolean;
  traffic: InsightTraffic;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [open, setOpen] = useState(items.length === 0);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [order, setOrder] = useState<"newest" | "read" | "shared">("newest");

  const stat = (id: string) =>
    traffic.by[id] ?? { reads: 0, webViews: 0, people: 0, shares: 0 };

  // Newest is the writing order and stays the default — this screen is mostly
  // used to publish, not to read numbers. The other two are for the question
  // the numbers exist to answer: which kind of story is worth more of these.
  const ordered = useMemo(() => {
    if (order === "newest") return items;
    const score = (i: AdminInsight) =>
      order === "shared" ? stat(i.id).shares : stat(i.id).reads + stat(i.id).webViews;
    return [...items].sort((a, b) => score(b) - score(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, order, traffic]);

  const count = words(draft.summary);
  const over = count > MAX_WORDS;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function call(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json().catch(() => ({ ok: false, error: "No response." }))) as {
      ok?: boolean;
      error?: string;
    };
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNote(null);
    const r = await call({ action: "save", ...draft });
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "That didn't save.");
      return;
    }
    setNote(draft.id ? "Saved." : draft.published ? "Published." : "Saved as a draft.");
    setDraft(BLANK);
    setOpen(false);
    router.refresh();
  }

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
    setUploading(false);
    if (!data.ok || !data.url) {
      setError(data.error ?? "That upload failed.");
      return;
    }
    set("imageUrl", data.url);
  }

  async function toggle(i: AdminInsight) {
    const r = await call({ action: "publish", id: i.id, published: !i.published });
    if (!r.ok) setError(r.error ?? "That didn't work.");
    router.refresh();
  }

  async function remove(i: AdminInsight) {
    if (!confirm(`Delete "${i.title}"? This cannot be undone.`)) return;
    const r = await call({ action: "delete", id: i.id });
    if (!r.ok) setError(r.error ?? "That didn't work.");
    router.refresh();
  }

  function edit(i: AdminInsight) {
    setDraft({
      id: i.id,
      title: i.title,
      summary: i.summary,
      category: i.category,
      imageUrl: i.imageUrl ?? "",
      sourceName: i.sourceName ?? "",
      sourceUrl: i.sourceUrl ?? "",
      published: i.published,
    });
    setOpen(true);
    setNote(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------ editor */}
      <section className="rounded-2xl border border-ink-08 bg-paper">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-[0.95rem] font-medium">
            {draft.id ? "Edit insight" : "Write an insight"}
          </span>
          <span className="text-[0.8rem] text-ink-50">{open ? "Hide" : "Open"}</span>
        </button>

        {open && (
          <div className="grid gap-6 border-t border-ink-08 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div>
                <p className={label}>Type</p>
                <div className="mt-2 inline-grid grid-cols-2 gap-1 rounded-xl bg-ink-04 p-1">
                  {(["trend", "guide"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set("category", c)}
                      className={`rounded-lg px-4 py-1.5 text-[0.8rem] ${
                        draft.category === c ? "bg-[#16162a] text-white" : "text-ink-50"
                      }`}
                    >
                      {c === "trend" ? "Trend" : "Tips"}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[0.74rem] text-ink-30">
                  Tips: something the reader can act on — a rule, a deadline, a change to PF or tax, or a practical career tip. Trend: what the job market is doing.
                </p>
              </div>

              <label className="block">
                <span className={label}>Title</span>
                <input
                  value={draft.title}
                  onChange={(e) => set("title", e.target.value)}
                  maxLength={160}
                  placeholder="IT hiring has reached an 18-month high"
                  className={`${field} mt-2`}
                />
              </label>

              <label className="block">
                <span className="flex items-baseline justify-between">
                  <span className={label}>Description</span>
                  <span className={`text-[0.74rem] tabular-nums ${over ? "font-medium text-red-600" : "text-ink-30"}`}>
                    {count} / {MAX_WORDS} words
                  </span>
                </span>
                <textarea
                  value={draft.summary}
                  onChange={(e) => set("summary", e.target.value)}
                  rows={6}
                  placeholder="What happened, the number that matters, and what it means for someone looking for a job."
                  className={`${field} mt-2 resize-y leading-relaxed`}
                />
              </label>

              <div>
                <p className={label}>Image (optional)</p>
                <p className="mt-1 text-[0.74rem] text-ink-30">
                  Shown only when the insight is opened in the Insights tab — never on the home card.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="rounded-full border border-ink-15 px-4 py-1.5 text-[0.8rem] hover:border-ink disabled:opacity-50"
                  >
                    {uploading ? "Uploading…" : draft.imageUrl ? "Replace image" : "Upload image"}
                  </button>
                  {draft.imageUrl && (
                    <button
                      type="button"
                      onClick={() => set("imageUrl", "")}
                      className="text-[0.8rem] text-ink-50 underline underline-offset-4"
                    >
                      Remove
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload(f);
                      e.target.value = "";
                    }}
                  />
                </div>
                <p className="mt-2 text-[0.72rem] leading-relaxed text-ink-30">
                  Use an image you made or have the right to use — not a photo copied from a news site.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
                <label className="block">
                  <span className={label}>Source name</span>
                  <input
                    value={draft.sourceName}
                    onChange={(e) => set("sourceName", e.target.value)}
                    placeholder="Economic Times"
                    className={`${field} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className={label}>Source link</span>
                  <input
                    value={draft.sourceUrl}
                    onChange={(e) => set("sourceUrl", e.target.value)}
                    placeholder="https://…"
                    className={`${field} mt-2`}
                  />
                </label>
              </div>

              <label className="flex items-center gap-2.5 text-[0.85rem]">
                <input
                  type="checkbox"
                  checked={draft.published}
                  onChange={(e) => set("published", e.target.checked)}
                  className="h-4 w-4 accent-black"
                />
                Publish now (untick to keep it as a draft)
              </label>

              {error && <p className="text-[0.82rem] text-red-600">{error}</p>}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={save}
                  disabled={busy || over}
                  className="rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper disabled:opacity-40"
                >
                  {busy ? "Saving…" : draft.id ? "Save changes" : draft.published ? "Publish" : "Save draft"}
                </button>
                {draft.id && (
                  <button
                    type="button"
                    onClick={() => setDraft(BLANK)}
                    className="text-[0.82rem] text-ink-50 underline underline-offset-4"
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </div>

            {/* The reader's card, as it will look. */}
            <div>
              <p className={label}>Preview</p>
              <div className="mt-2 overflow-hidden rounded-3xl border border-[#efe9cf] bg-paper">
                <div className={draft.imageUrl ? "grid sm:grid-cols-2" : ""}>
                  {draft.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.imageUrl} alt="" className="h-44 w-full object-cover sm:h-full" />
                  )}
                  <div className="p-5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[0.68rem] font-medium uppercase tracking-[0.1em] ${
                        draft.category === "guide" ? "bg-[#e8efff] text-[#1f5bff]" : "bg-[#fff1dc] text-[#b35f00]"
                      }`}
                    >
                      {draft.category === "guide" ? "Tips" : "Trend"}
                    </span>
                    <p className="mt-3 text-[1.05rem] font-semibold leading-snug">
                      {draft.title || "Your title"}
                    </p>
                    <p className="mt-2.5 text-[0.84rem] leading-relaxed text-ink-70">
                      {draft.summary || "Your description, up to 70 words."}
                    </p>
                    {(draft.sourceName || draft.sourceUrl) && (
                      <p className="mt-3 text-[0.76rem] text-ink-50">
                        Read the full story at{" "}
                        <span className="font-medium text-ink">{draft.sourceName || "source"}</span> ↗
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {note && <p className="text-[0.84rem] text-ink-50">{note}</p>}

      {/* ----------------------------------------------------------- traffic */}
      {traffic.ok && (
        <section className="rounded-2xl border border-ink-08 px-5 py-4">
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            How insights are doing
          </h2>
          <p className="mt-2 text-[0.78rem] leading-relaxed text-ink-30">
            Since each one was published, not for a date range — an insight gets its readers in
            the first day or two and then stops.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure label="Read in the app" value={traffic.totals.reads} />
            <Figure label="Opened from a link" value={traffic.totals.webViews} />
            <Figure label="People" value={traffic.totals.people} />
            <Figure label="Shared" value={traffic.totals.shares} />
          </div>
          {traffic.totals.reads + traffic.totals.webViews === 0 && (
            <p className="mt-4 text-[0.78rem] leading-relaxed text-ink-50">
              Nothing recorded yet. Reading inside the app only started being counted with the
              latest deploy, so numbers begin from there rather than from when these were written.
            </p>
          )}
        </section>
      )}

      {/* -------------------------------------------------------------- list */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            All insights ({items.length})
          </h2>
          {traffic.ok && (
            <div className="flex gap-1 rounded-lg border border-ink-15 p-0.5">
              {(
                [
                  ["newest", "Newest"],
                  ["read", "Most read"],
                  ["shared", "Most shared"],
                ] as const
              ).map(([key, text]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOrder(key)}
                  className={`rounded-md px-2.5 py-1 text-[0.76rem] transition-colors ${
                    order === key ? "bg-ink text-paper" : "text-ink-50 hover:bg-ink-04"
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
          )}
        </div>
        {items.length === 0 ? (
          <p className="mt-3 text-[0.85rem] text-ink-50">Nothing written yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-08 overflow-hidden rounded-2xl border border-ink-08 bg-paper">
            {ordered.map((i) => (
              <li key={i.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
                {i.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.imageUrl} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[0.9rem] font-medium">{i.title}</p>
                  <p className="mt-1 line-clamp-2 text-[0.78rem] text-ink-50">{i.summary}</p>
                  <p className="mt-1.5 text-[0.72rem] text-ink-30">
                    {i.category === "guide" ? "Tips" : "Trend"} ·{" "}
                    {new Date(i.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    {i.authorName ? ` · ${i.authorName}` : ""}
                    {i.published ? "" : " · Draft"}
                  </p>
                  {traffic.ok && (
                    <p className="mt-1.5 text-[0.72rem] tabular-nums text-ink-50">
                      {stat(i.id).reads + stat(i.id).webViews === 0 ? (
                        <span className="text-ink-30">No reads yet</span>
                      ) : (
                        <>
                          <strong className="font-medium text-ink">
                            {stat(i.id).reads + stat(i.id).webViews}
                          </strong>{" "}
                          {stat(i.id).reads + stat(i.id).webViews === 1 ? "read" : "reads"}
                          <span className="text-ink-30"> · {stat(i.id).people} people</span>
                          {stat(i.id).webViews > 0 && (
                            <span className="text-ink-30"> · {stat(i.id).webViews} from a link</span>
                          )}
                          {stat(i.id).shares > 0 && (
                            <span className="text-ink-30"> · {stat(i.id).shares} shared</span>
                          )}
                        </>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3 text-[0.8rem]">
                  <button type="button" onClick={() => edit(i)} className="text-ink-50 hover:text-ink">
                    Edit
                  </button>
                  <button type="button" onClick={() => toggle(i)} className="text-ink-50 hover:text-ink">
                    {i.published ? "Unpublish" : "Publish"}
                  </button>
                  {canDelete && (
                    <button type="button" onClick={() => remove(i)} className="text-red-600/80 hover:text-red-600">
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** One number with its name under it. Big enough to read across the row. */
function Figure({ label: name, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[1.5rem] font-semibold tabular-nums leading-none tracking-[-0.03em]">
        {value.toLocaleString("en-IN")}
      </p>
      <p className="mt-1.5 text-[0.72rem] uppercase tracking-[0.12em] text-ink-30">{name}</p>
    </div>
  );
}
