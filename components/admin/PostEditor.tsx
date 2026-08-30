"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { RichEditor } from "./RichEditor";
import { ImageField } from "./ImageField";
import type { EditablePost } from "@/lib/queries/admin";

type Category = { id: string; slug: string; name: string };

/** A datetime-local value for an instant, in IST. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const ist = new Date(d.getTime() + (330 + d.getTimezoneOffset()) * 60000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ist.getFullYear()}-${pad(ist.getMonth() + 1)}-${pad(ist.getDate())}T${pad(ist.getHours())}:${pad(ist.getMinutes())}`;
}

/** …and back again. The input means IST because that is what the author means. */
function fromLocalInput(v: string) {
  return new Date(`${v}:00+05:30`).toISOString();
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export function PostEditor({
  post,
  categories,
}: {
  post: EditablePost | null;
  categories: Category[];
}) {
  const router = useRouter();
  const isNew = !post;

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [html, setHtml] = useState(post?.content_html ?? "");
  const [categoryId, setCategoryId] = useState(post?.category_id ?? "");
  const [cover, setCover] = useState(post?.cover_image ?? "");
  const [coverAlt, setCoverAlt] = useState(post?.cover_alt ?? "");
  const [seoTitle, setSeoTitle] = useState(post?.seo_title ?? "");
  const [seoDesc, setSeoDesc] = useState(post?.seo_description ?? "");
  const [keyword, setKeyword] = useState(post?.focus_keyword ?? "");
  const [when, setWhen] = useState(toLocalInput(post?.published_at ?? new Date().toISOString()));
  const [status, setStatus] = useState<"draft" | "published">(
    post?.status === "draft" ? "draft" : "published",
  );

  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [showSeo, setShowSeo] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const words = useMemo(
    () => html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length,
    [html],
  );
  const scheduled = useMemo(() => new Date(fromLocalInput(when)) > new Date(), [when]);
  const imported = post?.origin && post.origin !== "editor";

  /** Shared by the cover field and the toolbar's Image button. */
  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body });
    const json = await res.json();
    if (!json.ok) {
      setNote({ kind: "err", text: json.hint ? `${json.error} ${json.hint}` : json.error });
      return null;
    }
    return json.url as string;
  }, []);

  const pickImageForBody = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      const input = uploadRef.current;
      if (!input) return resolve(null);
      input.value = "";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        resolve(await uploadImage(file));
      };
      input.click();
    });
  }, [uploadImage]);

  async function save() {
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: post?.id,
          slug: slug || slugify(title),
          title,
          excerpt,
          content_html: html,
          category_id: categoryId || null,
          seo_title: seoTitle,
          seo_description: seoDesc,
          focus_keyword: keyword,
          cover_image: cover,
          cover_alt: coverAlt,
          status,
          published_at: fromLocalInput(when),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Save failed");

      setNote({
        kind: "ok",
        text:
          status === "draft"
            ? "Saved as a draft. It is not on the site."
            : json.scheduled
              ? "Scheduled. It goes live on its own at the time you set."
              : "Published. It is live now.",
      });
      if (isNew) router.replace(`/admin/posts/${json.slug}`);
      else router.refresh();
    } catch (e) {
      setNote({ kind: "err", text: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!post) return;
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/post?id=${post.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      router.push("/admin/posts");
    } catch (e) {
      setNote({ kind: "err", text: e instanceof Error ? e.message : "Delete failed." });
      setSaving(false);
    }
  }

  const field = "w-full rounded-xl border border-ink-15 px-3.5 py-2.5 text-[0.9rem] outline-none focus:border-ink-30";

  return (
    <>
      <input ref={uploadRef} type="file" accept="image/*" className="hidden" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">
            {isNew ? "New article" : "Edit article"}
          </h1>
          <p className="mt-1.5 text-[0.82rem] text-ink-30">
            {words.toLocaleString("en-IN")} words
            {!isNew && (
              <>
                {" · "}
                <Link href={`/blog/${post!.slug}`} className="underline underline-offset-4">
                  view on the site
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/posts" className="text-[0.85rem] text-ink-50 underline underline-offset-4">
            Back
          </Link>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !title.trim()}
            className="rounded-full bg-ink px-5 py-2 text-[0.85rem] font-medium text-paper transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
          >
            {saving ? "Saving…" : status === "draft" ? "Save draft" : scheduled ? "Schedule" : "Publish"}
          </button>
        </div>
      </div>

      {imported && (
        <p className="mt-5 rounded-2xl border border-ink-30 p-4 text-[0.85rem] leading-relaxed text-ink-50">
          This article came from the deployment&apos;s content files. Saving here converts it to an
          editor-owned article, after which a content re-sync will leave it alone — your edits will
          survive, but the version in <code>articles.json</code> stops being the source of truth.
        </p>
      )}

      {note && (
        <p
          className={`mt-5 rounded-2xl border p-4 text-[0.88rem] leading-relaxed ${
            note.kind === "ok" ? "border-ink-15 text-ink-70" : "border-ink-30 text-ink"
          }`}
        >
          {note.text}
        </p>
      )}

      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* ------------------------------------------------------ the writing */}
        <div className="min-w-0">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="Article title"
            className="w-full text-[1.6rem] font-semibold leading-snug tracking-[-0.03em] outline-none placeholder:text-ink-30"
          />

          <div className="mt-2 flex items-center gap-1.5 text-[0.78rem] text-ink-30">
            <span>/blog/</span>
            <input
              value={slug}
              onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
              placeholder="address-of-the-article"
              className="min-w-0 flex-1 border-b border-dashed border-ink-15 bg-transparent pb-0.5 font-mono outline-none focus:border-ink-30"
            />
          </div>

          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            placeholder="The summary shown on the blog index and in search results. Leave blank to use the opening lines."
            className="mt-5 w-full resize-none rounded-xl border border-ink-15 px-3.5 py-2.5 text-[0.88rem] leading-relaxed outline-none focus:border-ink-30"
          />

          <div className="mt-5">
            <RichEditor value={html} onChange={setHtml} onRequestImage={pickImageForBody} />
          </div>
        </div>

        {/* -------------------------------------------------------- settings */}
        <aside className="space-y-6">
          <section className="rounded-2xl border border-ink-08 p-5">
            <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
              Publishing
            </h2>

            <div className="mt-4 flex gap-2">
              {(["published", "draft"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex-1 rounded-full px-3 py-1.5 text-[0.78rem] ${
                    status === s ? "bg-ink text-paper" : "border border-ink-15 text-ink-50"
                  }`}
                >
                  {s === "published" ? "Live" : "Draft"}
                </button>
              ))}
            </div>

            <label className="mt-4 block">
              <span className="text-[0.75rem] text-ink-50">Publish date and time · IST</span>
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                disabled={status === "draft"}
                className={`mt-1.5 ${field} disabled:opacity-40`}
              />
            </label>

            <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-30">
              {status === "draft"
                ? "Drafts are invisible everywhere — not on the blog, not in the sitemap, not to Google."
                : scheduled
                  ? "A future time means it publishes itself then. Nothing to press on the day."
                  : "This time is in the past, so saving puts it live immediately."}
            </p>
          </section>

          <section className="rounded-2xl border border-ink-08 p-5">
            <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
              Topic
            </h2>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={`mt-4 ${field}`}
            >
              <option value="">No topic</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </section>

          <section className="rounded-2xl border border-ink-08 p-5">
            <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
              Cover image
            </h2>
            <div className="mt-4">
              <ImageField
                value={cover}
                onChange={setCover}
                alt={coverAlt}
                onAltChange={setCoverAlt}
                upload={uploadImage}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-ink-08 p-5">
            <button
              type="button"
              onClick={() => setShowSeo((v) => !v)}
              className="flex w-full items-center justify-between gap-3"
            >
              <span className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
                Search listing
              </span>
              <span className="text-[0.75rem] text-ink-30">{showSeo ? "hide" : "edit"}</span>
            </button>

            {showSeo ? (
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="text-[0.75rem] text-ink-50">
                    Title · {seoTitle.length}/62
                  </span>
                  <input
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    placeholder={title.slice(0, 62)}
                    className={`mt-1.5 ${field}`}
                  />
                </label>
                <label className="block">
                  <span className="text-[0.75rem] text-ink-50">
                    Description · {seoDesc.length}/158
                  </span>
                  <textarea
                    value={seoDesc}
                    onChange={(e) => setSeoDesc(e.target.value)}
                    rows={3}
                    className={`mt-1.5 resize-none ${field}`}
                  />
                </label>
                <label className="block">
                  <span className="text-[0.75rem] text-ink-50">Focus keyword</span>
                  <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="what someone types into Google"
                    className={`mt-1.5 ${field}`}
                  />
                </label>
              </div>
            ) : (
              <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-30">
                Leave this alone and the title and excerpt are used. Open it when you want the
                search result to read differently from the headline.
              </p>
            )}
          </section>

          {!isNew && !imported && (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={saving}
              className="text-[0.82rem] text-ink-30 underline underline-offset-4 hover:text-ink disabled:opacity-40"
            >
              Delete this article
            </button>
          )}
        </aside>
      </div>
    </>
  );
}
