"use client";

import { useRouter } from "next/navigation";
import { usePost } from "@/components/admin/govt/fields";

/**
 * Publish, from the list, without opening anything.
 *
 * Posting ten jobs and then opening ten forms to tick a box would make the
 * draft step the most expensive part of the job, which would be a strange
 * thing to have built on purpose. One press, in place, and the row updates.
 */
export function RowPublish({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const { busy, error, post } = usePost("/api/admin/govt/notice");

  async function set(next: string) {
    if (await post({ action: "status", id, status: next })) router.refresh();
  }

  const live = status === "published";

  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-[0.72rem] text-red-700">{error}</span>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void set(live ? "draft" : "published")}
        className={
          live
            ? "rounded-full border border-ink-15 px-3.5 py-1.5 text-[0.78rem] text-ink-30 transition-colors hover:border-ink-30 hover:text-ink disabled:opacity-40"
            : "rounded-full bg-ink px-3.5 py-1.5 text-[0.78rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
        }
      >
        {busy ? "…" : live ? "Unpublish" : "Publish"}
      </button>
    </span>
  );
}

/**
 * Publish everything sitting in drafts.
 *
 * The normal shape of this work is a batch: eight jobs read off a board in
 * one sitting, checked, then put up together. This is that, as one press.
 */
export function PublishAll({ count }: { count: number }) {
  const router = useRouter();
  const { busy, error, post } = usePost("/api/admin/govt/notice");

  if (count === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (await post({ action: "publish_all" })) router.refresh();
        }}
        className="rounded-full bg-ink px-4 py-2 text-[0.8rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Publishing…" : `Publish all ${count}`}
      </button>
      {error && <span className="text-[0.78rem] text-red-700">{error}</span>}
    </span>
  );
}
