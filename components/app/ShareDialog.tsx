"use client";

import { useEffect, useState } from "react";

/**
 * Share, and mean it.
 *
 * The easy version of this dialog is a row of icons where "Copy link" copies
 * something that does not work yet. That is worse than no share button: it
 * fails at the one moment somebody is trying to send their resume to an
 * employer, and they find out from the employer.
 *
 * So the link is real. Switching sharing on mints an unguessable address and
 * publishes the document at `/r/<id>`; switching it off takes it down and
 * keeps the address, so turning it back on later does not break a URL already
 * sitting in somebody's inbox. WhatsApp and email are that same link handed to
 * the app that will send it, which is all either of them can honestly be.
 *
 * Downloading is a print dialog rather than a server-rendered PDF. The browser
 * writes real selectable text, which is the entire point of the document — a
 * picture of a resume scores nothing — and it needs no PDF library, no font
 * embedding and no second renderer that could disagree with the first.
 */

type Props = {
  draftId: string;
  shareId: string | null;
  isPublic: boolean;
  /** Unsaved edits would not be in the shared copy, so say so. */
  dirty: boolean;
  onSave: () => Promise<void>;
  onClose: () => void;
};

export function ShareDialog({ draftId, shareId, isPublic, dirty, onSave, onClose }: Props) {
  const [on, setOn] = useState(isPublic);
  const [id, setId] = useState(shareId);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const url = id ? `${typeof window === "undefined" ? "" : window.location.origin}/r/${id}` : null;

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      // Publish what is on screen, not what was last saved. Somebody who edits
      // and immediately shares would otherwise send the previous version and
      // have no way of knowing.
      if (next && dirty) await onSave();

      const res = await fetch("/api/app/resume/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draftId, on: next }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        shareId?: string | null;
        isPublic?: boolean;
      };
      if (!json.ok) throw new Error(json.error ?? "That didn't work.");
      setId(json.shareId ?? null);
      setOn(Boolean(json.isPublic));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Couldn't copy. Select the link and copy it by hand.");
    }
  }

  return (
    <div
      className="no-print fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Share this resume"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[440px] rounded-2xl bg-paper p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[1.05rem] font-semibold tracking-[-0.02em]">Share this resume</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-1 rounded-full p-1 text-ink-30 transition-colors hover:bg-ink-04 hover:text-ink"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* ------------------------------------------------------- the link */}
        <div className="mt-5 rounded-xl border border-ink-08 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={on}
              disabled={busy}
              onChange={(e) => void toggle(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-black"
            />
            <span className="min-w-0">
              <span className="block text-[0.9rem] font-medium">Anyone with the link can view</span>
              <span className="mt-1 block text-[0.8rem] leading-relaxed text-ink-50">
                A read-only page. No sign-in, nothing else from your account — and it is not
                indexed by search engines.
              </span>
            </span>
          </label>

          {on && url && (
            <div className="mt-4 flex items-center gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-ink-08 bg-ink-04 px-3 py-2 text-[0.8rem] text-ink-50 outline-none"
              />
              <button
                type="button"
                onClick={() => void copy()}
                className="shrink-0 rounded-lg bg-ink px-3.5 py-2 text-[0.8rem] font-semibold text-paper transition-transform hover:scale-[1.03]"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}

          {on && dirty && (
            <p className="mt-3 text-[0.78rem] text-ink-50">
              You have unsaved changes. Save before sending the link, or it will show the last
              saved version.
            </p>
          )}
        </div>

        {error && <p className="mt-3 text-[0.82rem]">{error}</p>}

        {/* ---------------------------------------------------------- ways */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          <Way label="Download" onClick={() => window.print()}>
            <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5" />
            <path d="M3.5 14v2.5h13V14" />
          </Way>

          <Way
            label="WhatsApp"
            disabled={!on || !url}
            onClick={() =>
              url &&
              window.open(
                `https://wa.me/?text=${encodeURIComponent(`My resume: ${url}`)}`,
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            <path d="M4 16l1-3a6 6 0 1 1 2.4 2.2L4 16Z" />
          </Way>

          <Way
            label="Email"
            disabled={!on || !url}
            onClick={() => {
              if (!url) return;
              // A mail draft, not a sent message. Nothing leaves without the
              // person pressing send in their own client.
              window.location.href = `mailto:?subject=${encodeURIComponent("My resume")}&body=${encodeURIComponent(url)}`;
            }}
          >
            <path d="M3 5.5h14v9H3z" />
            <path d="m3 6 7 5 7-5" />
          </Way>

          <Way label="Open" disabled={!on || !url} onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}>
            <path d="M11 4h5v5" />
            <path d="M16 4 9 11" />
            <path d="M15 12v4H4V5h4" />
          </Way>
        </div>

        {!on && (
          <p className="mt-4 text-[0.78rem] leading-relaxed text-ink-30">
            Downloading works either way. The other three need a link, so switch it on first.
          </p>
        )}
      </div>
    </div>
  );
}

function Way({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-2 rounded-xl border border-ink-08 px-2 py-3 text-[0.75rem] font-medium transition-colors hover:border-ink-30 disabled:opacity-35 disabled:hover:border-ink-08"
    >
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
      {label}
    </button>
  );
}
