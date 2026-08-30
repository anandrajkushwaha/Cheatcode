"use client";

import { useEffect, useState } from "react";

const KEY = "cc_hide_stale_notice";

/**
 * Shown when the deployed SQL functions are older than this code.
 *
 * This exists because of a real failure: the app shipped before the migration
 * was run, the summary functions returned an older shape, and the dashboard
 * quietly printed NaN. Silence about a known-wrong state is worse than a
 * banner.
 *
 * It is dismissible, but deliberately not with a plain "close": hiding it means
 * living with numbers you know are incomplete, so the control says so, and it
 * comes back on its own once the migration is run and the data is whole again.
 */
export function StaleSchemaNotice({ stale }: { stale: boolean }) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  // Once the migration has run, forget the dismissal — so if this ever fires
  // again it is about a new problem and will be visible.
  useEffect(() => {
    if (!stale) {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* private mode */
      }
    }
  }, [stale]);

  if (!stale) return null;

  function hide() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* private mode — it just won't persist */
    }
    setHidden(true);
  }

  if (hidden) {
    return (
      <p className="mt-6 text-[0.78rem] text-ink-30">
        Some panels are incomplete until the database migration is run.{" "}
        <button
          type="button"
          onClick={() => setHidden(false)}
          className="underline underline-offset-4 hover:text-ink"
        >
          details
        </button>
      </p>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-ink-30 p-5">
      <p className="text-[0.9rem] font-medium">These numbers are incomplete</p>
      <p className="mt-2 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
        The database is still running an older version of the reporting functions, so several
        panels have nothing to read and are showing zero rather than the truth. Run{" "}
        <code className="font-mono text-ink">supabase/schemas/10_dashboard.sql</code> — and then{" "}
        <code className="font-mono text-ink">11_authoring.sql</code> — in the Supabase SQL editor
        and reload. This message disappears by itself once that is done.
      </p>
      <button
        type="button"
        onClick={hide}
        className="mt-4 text-[0.78rem] text-ink-30 underline underline-offset-4 hover:text-ink"
      >
        Hide until it&apos;s fixed
      </button>
    </div>
  );
}
