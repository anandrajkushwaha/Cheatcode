"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * The two things somebody does to a draft before there is an editor: make one,
 * and print it.
 *
 * Both live in one small client island so the builder page itself can stay a
 * server component — the document is rendered from the database and there is
 * nothing interactive about it yet.
 */

const PRIMARY =
  "inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 " +
  "text-[0.85rem] font-semibold text-paper transition-transform hover:scale-[1.02] " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const QUIET =
  "text-[0.82rem] text-ink-30 underline underline-offset-4 transition-colors " +
  "hover:text-ink disabled:cursor-not-allowed disabled:opacity-60";

export function BuildDraftButton({
  label,
  restart = false,
  quiet = false,
  className = "",
}: {
  label: string;
  /** Throw away the edits and copy the uploaded resume again. */
  restart?: boolean;
  quiet?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const go = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/app/resume/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restart }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Could not start the draft.");

      // push, then refresh: the page is a server component reading the row
      // that was just written, and a push alone can serve it from the cache.
      startTransition(() => {
        router.push("/app/resume/builder");
        router.refresh();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the draft.");
    } finally {
      setBusy(false);
    }
  }, [restart, router]);

  const working = busy || pending;

  return (
    <span className={className}>
      <button
        type="button"
        onClick={() => void go()}
        disabled={working}
        className={quiet ? QUIET : PRIMARY}
      >
        {working ? "One moment…" : label}
      </button>
      {error && (
        <span className="mt-2 block text-[0.8rem] leading-relaxed text-ink-50">{error}</span>
      )}
    </span>
  );
}

/**
 * Print, which is also Save as PDF.
 *
 * Unglamorous, and the right first move: the browser's own print pipeline
 * produces a real text layer on day one, which is the entire thing an ATS
 * needs and the thing every "download PDF" library gets wrong first.
 */
export function PrintButton({ label = "Download PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={PRIMARY}>
      {label}
    </button>
  );
}
