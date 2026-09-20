"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ResumeUpload } from "@/components/app/ResumeUpload";
import type { ReviewRequest } from "@/lib/app/resume-review";

/**
 * The two things you can do to a resume, as buttons rather than as sections.
 *
 * Both of these used to be blocks down the page: a review card, and a large
 * dashed upload zone at the bottom. Between them they took two screens of
 * height to offer two actions, and the upload — the thing somebody arriving
 * with a file actually wants — was the furthest thing from the top.
 *
 * So they are buttons at the top and the work happens in a dialog. The page
 * underneath is then about the document itself, which is what somebody who
 * already has one came to look at.
 */

const WHEN = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});

type Open = "upload" | "review" | null;

export function ResumeActions({
  paid,
  review,
  defaultRole,
  email,
  hasDocument,
}: {
  paid: boolean;
  review: ReviewRequest | null;
  defaultRole: string | null;
  email: string | null;
  /** Whether there is anything to review yet. */
  hasDocument: boolean;
}) {
  const [open, setOpen] = useState<Open>(null);
  const waiting = review?.status === "open";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setOpen("upload")}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity hover:opacity-90"
        >
          <UploadIcon />
          {hasDocument ? "Upload a newer resume" : "Upload resume"}
        </button>

        {paid &&
          (waiting ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-[#fdaa29]/50 bg-[#fffaf0] px-4 py-2.5 text-[0.82rem] font-medium text-[#8a5a12]">
              <ClockIcon />
              Review in progress
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setOpen("review")}
              className="inline-flex items-center gap-2 rounded-full border border-ink-15 bg-paper px-5 py-2.5 text-[0.85rem] font-medium transition-colors hover:border-ink"
            >
              <EyeIcon />
              Request a review
            </button>
          ))}
      </div>

      {/* One line about the request that is already in, rather than a card.
          The useful fact is where the answer arrives, and that fits here. */}
      {paid && waiting && review && (
        <p className="mt-2.5 text-[0.79rem] leading-relaxed text-ink-30">
          Sent {WHEN.format(new Date(review.createdAt))}
          {review.targetRole ? ` for ${review.targetRole} roles` : ""} · feedback
          comes by email{email ? ` to ${email}` : ""}, usually within two working
          days.
        </p>
      )}

      {open === "upload" && (
        <Dialog
          title={hasDocument ? "Upload a newer resume" : "Upload your resume"}
          detail="Read in your browser, scored, and used to fill every template. PDF, DOCX or TXT."
          onClose={() => setOpen(null)}
        >
          <ResumeUpload hasExisting={hasDocument} />
        </Dialog>
      )}

      {open === "review" && (
        <Dialog
          title="Have a person read it"
          detail="Attach the PDF you actually send. Someone reads it against the job you are applying for and writes back by email."
          onClose={() => setOpen(null)}
        >
          <ReviewForm defaultRole={defaultRole} email={email} onDone={() => setOpen(null)} />
        </Dialog>
      )}
    </>
  );
}

/* --------------------------------------------------------------- the form */

function ReviewForm({
  defaultRole,
  email,
  onDone,
}: {
  defaultRole: string | null;
  email: string | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [role, setRole] = useState(defaultRole ?? "");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      // Multipart rather than JSON, because the document goes with it. The
      // Content-Type header is deliberately not set: the browser has to add
      // its own boundary, and setting it by hand breaks the parse server-side.
      const body = new FormData();
      body.append("targetRole", role.trim());
      body.append("note", note.trim());
      if (file) body.append("file", file);

      const res = await fetch("/api/app/resume/review", { method: "POST", body });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Could not send that.");
        setBusy(false);
        return;
      }
      onDone();
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
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
          The review is written against this, so it matters more than anything
          else here.
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

      <div>
        <span className="mb-1.5 block text-[0.78rem] text-ink-50">
          The resume <span className="text-ink-30">— required</span>
        </span>

        <input
          ref={picker}
          type="file"
          accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        {file ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-15 px-3.5 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-[0.85rem] font-medium">{file.name}</span>
              <span className="block text-[0.73rem] text-ink-30">
                {(file.size / 1024).toFixed(0)} KB
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (picker.current) picker.current.value = "";
              }}
              className="shrink-0 text-[0.78rem] text-ink-30 underline underline-offset-4 hover:text-ink"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => picker.current?.click()}
            className="w-full rounded-xl border border-dashed border-ink-15 px-4 py-4 text-[0.84rem] text-ink-50 transition-colors hover:border-ink-30 hover:text-ink"
          >
            Attach the PDF you actually send
          </button>
        )}

        <span className="mt-1.5 block text-[0.73rem] leading-relaxed text-ink-30">
          We review the file itself — half of what is wrong with a resume is
          only visible in the PDF: layout, spacing, where page two ends. PDF,
          DOCX or TXT, under 10MB.
        </span>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[0.82rem] text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy || role.trim().length < 2 || !file}
        className="rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Sending…" : "Send for review"}
      </button>

      <p className="text-[0.75rem] leading-relaxed text-ink-30">
        We review the file you attach, exactly as it is — so send the version
        you are actually sending out. The reply comes by email
        {email ? ` to ${email}` : ""}.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- the dialog */

function Dialog({
  title,
  detail,
  onClose,
  children,
}: {
  title: string;
  detail: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Locking the body would take the scrollbar away and shift the page
    // behind, so it is left alone — this dialog is short enough that a page
    // scrolling underneath it is not a problem.
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/30 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] rounded-t-3xl border border-ink-08 bg-paper p-6 sm:rounded-3xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[1.05rem] font-semibold tracking-[-0.02em]">{title}</p>
            <p className="mt-1.5 max-w-[52ch] text-[0.84rem] leading-relaxed text-ink-50">
              {detail}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-full text-ink-30 transition-colors hover:bg-ink-04 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ icons */

const S = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "size-[15px]",
  "aria-hidden": true,
};

const UploadIcon = () => (
  <svg {...S}>
    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
    <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
  </svg>
);

const EyeIcon = () => (
  <svg {...S}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
);

const ClockIcon = () => (
  <svg {...S} className="size-[14px]">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </svg>
);
