"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImageField } from "@/components/admin/ImageField";
import { ReviewCard } from "@/components/studio/ReviewCard";
import type { Review } from "@/lib/studio/reviews";

/**
 * Add a testimonial, see it, order it.
 *
 * The preview on the right is the real ReviewCard, the same component the
 * landing page renders — not an approximation of it. That is the reason the
 * card has no hooks in it: a preview drawn separately is a preview that
 * eventually lies, and the whole point of this screen is to see what will be
 * published before publishing it.
 *
 * Order is up/down buttons rather than drag and drop. Dragging is nicer with
 * a mouse and unusable with a keyboard or on a phone, and this list will
 * never be longer than a screen.
 */

type Draft = {
  id: number | null;
  name: string;
  role: string;
  quote: string;
  avatarUrl: string;
  published: boolean;
};

const BLANK: Draft = {
  id: null,
  name: "",
  role: "",
  quote: "",
  avatarUrl: "",
  published: true,
};

async function uploadImage(file: File): Promise<string | null> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body });
  const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
  if (!data.ok || !data.url) {
    alert(data.error ?? "That upload failed.");
    return null;
  }
  return data.url;
}

const field =
  "w-full rounded-xl border border-ink-15 px-3 py-2 text-[0.85rem] outline-none focus:border-ink-30";

export function ReviewsManager({ reviews }: { reviews: Review[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  async function send(payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "That didn't save.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Could not reach the server.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const ok = await send({
      action: "save",
      id: draft.id ?? undefined,
      name: draft.name,
      role: draft.role,
      quote: draft.quote,
      avatarUrl: draft.avatarUrl || null,
      published: draft.published,
    });
    if (ok) setDraft(BLANK);
  }

  // What the preview shows: the draft as a Review, so the same card renders it.
  const preview: Review = {
    id: -1,
    name: draft.name.trim() || "Their name",
    role: draft.role.trim(),
    quote:
      draft.quote.trim() ||
      "Their words about Cheatcode will appear here, exactly as they will on the Pro page.",
    avatarUrl: draft.avatarUrl.trim() || null,
    position: 0,
    published: draft.published,
  };

  return (
    <div className="space-y-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_392px]">
        {/* ------------------------------------------------------------ form */}
        <section className="rounded-2xl border border-ink-08 p-6">
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            {draft.id ? "Edit review" : "New review"}
          </h2>

          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[0.78rem] text-ink-50">Name</span>
                <input
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Rohit Menon"
                  className={field}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[0.78rem] text-ink-50">
                  Title — the line underneath
                </span>
                <input
                  value={draft.role}
                  onChange={(e) => set("role", e.target.value)}
                  placeholder="Software Engineer"
                  className={field}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[0.78rem] text-ink-50">
                What they said
              </span>
              <textarea
                value={draft.quote}
                onChange={(e) => set("quote", e.target.value)}
                rows={6}
                maxLength={900}
                placeholder="In their own words…"
                className={`${field} resize-y leading-relaxed`}
              />
              <span className="mt-1 block text-[0.72rem] text-ink-30">
                {draft.quote.length}/900 — around 400 reads best in the card.
              </span>
            </label>

            <div>
              <span className="mb-1.5 block text-[0.78rem] text-ink-50">Photo</span>
              <ImageField
                value={draft.avatarUrl}
                onChange={(url) => set("avatarUrl", url)}
                upload={uploadImage}
                label="Drop a photo, or click to choose"
              />
              <p className="mt-2 text-[0.72rem] leading-relaxed text-ink-30">
                Square works best — it is cropped to a circle. No photo is fine:
                the card shows their initials instead.
              </p>
            </div>

            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => set("published", e.target.checked)}
                className="size-4 accent-black"
              />
              <span className="text-[0.82rem]">
                Publish now
                <span className="ml-1.5 text-ink-30">
                  — unticked keeps it as a draft, off the site
                </span>
              </span>
            </label>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[0.8rem] text-red-700">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={save}
                disabled={busy || !draft.name.trim() || !draft.quote.trim()}
                className="rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {busy ? "Saving…" : draft.id ? "Save changes" : "Add review"}
              </button>
              {draft.id && (
                <button
                  type="button"
                  onClick={() => setDraft(BLANK)}
                  className="text-[0.82rem] text-ink-50 underline underline-offset-4 hover:text-ink"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- preview */}
        <section>
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            How it will look
          </h2>
          <div className="mt-5 rounded-2xl border border-ink-08 bg-paper p-5">
            <ReviewCard review={preview} />
          </div>
          <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-30">
            This is the same card the Pro page renders, at its real width.
          </p>
        </section>
      </div>

      {/* ------------------------------------------------------------- list */}
      <section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            On the page
          </h2>
          <span className="text-[0.75rem] text-ink-30">
            {reviews.filter((r) => r.published).length} published · {reviews.length} total
          </span>
        </div>

        {reviews.length === 0 ? (
          <p className="mt-5 text-[0.85rem] leading-relaxed text-ink-30">
            Nothing yet. The testimonial section hides itself on the Pro page
            until there is at least one published review.
          </p>
        ) : (
          <ol className="mt-5 space-y-3">
            {reviews.map((r, i) => (
              <li
                key={r.id}
                className="flex flex-wrap items-start gap-4 rounded-2xl border border-ink-08 p-4"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink-04 text-[0.72rem] font-medium tabular-nums text-ink-50">
                  {i + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[0.88rem] font-semibold">
                    {r.name}
                    {!r.published && (
                      <span className="rounded-full bg-ink-04 px-2 py-0.5 text-[0.68rem] font-medium text-ink-50">
                        Draft
                      </span>
                    )}
                  </p>
                  {r.role && <p className="text-[0.78rem] text-ink-50">{r.role}</p>}
                  <p className="mt-1.5 line-clamp-2 text-[0.8rem] leading-relaxed text-ink-50">
                    {r.quote}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={busy || i === 0}
                    onClick={() => void send({ action: "move", id: r.id, direction: "up" })}
                    aria-label={`Move ${r.name} up`}
                    className="grid size-8 place-items-center rounded-lg border border-ink-08 text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={busy || i === reviews.length - 1}
                    onClick={() => void send({ action: "move", id: r.id, direction: "down" })}
                    aria-label={`Move ${r.name} down`}
                    className="grid size-8 place-items-center rounded-lg border border-ink-08 text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void send({ action: "publish", id: r.id, published: !r.published })
                    }
                    className="ml-1 rounded-lg border border-ink-08 px-2.5 py-1.5 text-[0.75rem] text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink disabled:opacity-40"
                  >
                    {r.published ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setDraft({
                        id: r.id,
                        name: r.name,
                        role: r.role,
                        quote: r.quote,
                        avatarUrl: r.avatarUrl ?? "",
                        published: r.published,
                      })
                    }
                    className="rounded-lg border border-ink-08 px-2.5 py-1.5 text-[0.75rem] text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink disabled:opacity-40"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (!confirm(`Remove ${r.name}'s review? This cannot be undone.`)) return;
                      void send({ action: "delete", id: r.id });
                    }}
                    className="rounded-lg border border-ink-08 px-2.5 py-1.5 text-[0.75rem] text-ink-30 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
