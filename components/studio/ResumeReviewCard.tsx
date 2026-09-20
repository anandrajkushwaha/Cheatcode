"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReviewRequest } from "@/lib/app/resume-review";

/**
 * "Have a person read it."
 *
 * Three states, and they are the whole component: nothing sent, one waiting,
 * one done. A request in the queue shows what was asked rather than a spinner
 * — the wait is a day or two, so the useful thing on screen is a reminder of
 * what they asked for and where the answer will arrive.
 *
 * The target role is required. A review written without knowing what somebody
 * is applying for is a list of writing tips, and they can get those anywhere.
 */

const WHEN = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});

export function ResumeReviewCard({
  existing,
  defaultRole,
  email,
  hasDocument,
}: {
  existing: ReviewRequest | null;
  defaultRole: string | null;
  email: string | null;
  /** Whether there is anything to review yet. */
  hasDocument: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(defaultRole ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/app/resume/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole: role.trim(), note: note.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Could not send that.");
        setBusy(false);
        return;
      }
      setOpen(false);
      setNote("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  /* --------------------------------------------------------- in the queue */
  if (existing?.status === "open") {
    return (
      <section className="rounded-2xl border border-[#fdaa29]/40 bg-[#fffaf0] p-5 sm:p-6">
        <p className="flex items-center gap-2 text-[0.8rem] font-semibold text-[#8a5a12]">
          <ClockIcon />
          With a reviewer
        </p>
        <p className="mt-2.5 max-w-[60ch] text-[0.88rem] leading-relaxed text-ink-70">
          Sent {WHEN.format(new Date(existing.createdAt))}
          {existing.targetRole ? ` · for ${existing.targetRole} roles` : ""}. You
          will get the feedback by email
          {email ? ` at ${email}` : ""}, usually within two working days.
        </p>
        {existing.note && (
          <p className="mt-3 border-l-2 border-[#fdaa29]/40 pl-3 text-[0.82rem] italic leading-relaxed text-ink-50">
            {existing.note}
          </p>
        )}
      </section>
    );
  }

  /* -------------------------------------------------------------- the ask */
  return (
    <section className="rounded-2xl border border-ink-08 bg-paper p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[0.97rem] font-semibold tracking-[-0.02em]">
            Have a person read it
          </h2>
          <p className="mt-1.5 max-w-[58ch] text-[0.85rem] leading-relaxed text-ink-50">
            {existing?.status === "done"
              ? `We sent your last review${existing.doneAt ? ` on ${WHEN.format(new Date(existing.doneAt))}` : ""}. Ask again whenever you have changed it.`
              : "Not a score and not a checklist — someone reads it against the job you are actually applying for and writes back."}
          </p>
        </div>

        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={!hasDocument}
            className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Request a review
          </button>
        )}
      </div>

      {!hasDocument && !open && (
        <p className="mt-3 text-[0.8rem] text-ink-30">
          Upload a resume or build one first — there has to be something to read.
        </p>
      )}

      {open && (
        <div className="mt-5 space-y-4 border-t border-ink-08 pt-5">
          <label className="block">
            <span className="mb-1.5 block text-[0.78rem] text-ink-50">
              Which role are you applying for?
            </span>
            <input
              autoFocus
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Graphic Designer"
              className="w-full rounded-xl border border-ink-15 px-3.5 py-2.5 text-[0.88rem] outline-none transition-colors focus:border-ink-30"
            />
            <span className="mt-1 block text-[0.73rem] text-ink-30">
              The review is written against this, so it matters more than
              anything else here.
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[0.78rem] text-ink-50">
              Anything you want looked at? <span className="text-ink-30">Optional</span>
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={1500}
              placeholder="I keep getting rejected at screening · not sure my last role reads well · is it too long?"
              className="w-full resize-y rounded-xl border border-ink-15 p-3.5 text-[0.88rem] leading-relaxed outline-none transition-colors placeholder:text-ink-30 focus:border-ink-30"
            />
          </label>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[0.82rem] text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || role.trim().length < 2}
              className="rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send for review"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="text-[0.82rem] text-ink-50 underline underline-offset-4 hover:text-ink"
            >
              Cancel
            </button>
          </div>

          <p className="text-[0.75rem] leading-relaxed text-ink-30">
            We read whatever is on this page at the time we open it — so make
            your edits first. The reply comes by email
            {email ? ` to ${email}` : ""}.
          </p>
        </div>
      )}
    </section>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-[14px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}
