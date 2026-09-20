"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { QueueItem } from "@/lib/app/resume-review";

/**
 * The review queue.
 *
 * Everything a reviewer needs to open one, read it, and write the email:
 * who, what role, what they asked, and the document itself — either a link to
 * the design they built or the plain text of what they uploaded.
 *
 * There is no "send feedback" box, deliberately. The reply is an email
 * written by a person; building a message composer here would mean building
 * delivery, threading and a read receipt to go with it, and the whole point
 * of this first version is that a human answers properly.
 */

const WHEN = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export function ReviewQueue({ items }: { items: QueueItem[] }) {
  const [showDone, setShowDone] = useState(false);

  const open = items.filter((i) => i.status === "open");
  const rest = items.filter((i) => i.status !== "open");
  const shown = showDone ? rest : [];

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            Waiting
          </h2>
          <span className="text-[0.75rem] text-ink-30">{open.length} open</span>
        </div>

        {open.length === 0 ? (
          <p className="mt-5 text-[0.85rem] leading-relaxed text-ink-30">
            Nothing waiting. Pro members who ask for a review land here.
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {open.map((item) => (
              <Item key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>

      {rest.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30 hover:text-ink"
          >
            {showDone ? "Hide" : "Show"} handled ({rest.length})
          </button>

          {shown.length > 0 && (
            <ul className="mt-5 space-y-3">
              {shown.map((item) => (
                <Item key={item.id} item={item} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Item({ item }: { item: QueueItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(item.adminNote ?? "");
  const [showText, setShowText] = useState(false);

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch("/api/admin/resume-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, ...payload }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const subject = `Your resume review — ${item.targetRole ?? "Cheatcode"}`;

  return (
    <li className="rounded-2xl border border-ink-08 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.92rem] font-semibold">
            {item.fullName?.trim() || item.email || "Someone"}
          </p>
          <p className="text-[0.78rem] text-ink-50">{item.email ?? "no email on file"}</p>
          <p className="mt-1.5 text-[0.76rem] text-ink-30">
            {WHEN.format(new Date(item.createdAt))}
            {item.targetRole ? ` · applying for ${item.targetRole}` : ""}
            {item.atsScore !== null ? ` · ATS ${item.atsScore}` : ""}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${
            item.status === "open"
              ? "bg-amber-50 text-amber-700"
              : item.status === "done"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-ink-04 text-ink-50"
          }`}
        >
          {item.status === "open" ? "Waiting" : item.status === "done" ? "Sent" : "Cancelled"}
        </span>
      </div>

      {item.note && (
        <p className="mt-4 border-l-2 border-ink-15 pl-3 text-[0.85rem] leading-relaxed text-ink-70">
          {item.note}
        </p>
      )}

      {/* The document. A built design opens as the page they would actually
          send; an upload only has its extracted text, which is still what a
          reviewer reads. */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {item.shareId && (
          <a
            href={`/r/${item.shareId}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-ink-08 px-3 py-1.5 text-[0.78rem] transition-colors hover:bg-ink-04"
          >
            Open their resume ↗
          </a>
        )}
        {item.rawText && (
          <button
            type="button"
            onClick={() => setShowText((v) => !v)}
            className="rounded-lg border border-ink-08 px-3 py-1.5 text-[0.78rem] transition-colors hover:bg-ink-04"
          >
            {showText ? "Hide" : "Read"} the uploaded text
          </button>
        )}
        {item.email && (
          <a
            href={`mailto:${item.email}?subject=${encodeURIComponent(subject)}`}
            className="rounded-lg border border-ink-08 px-3 py-1.5 text-[0.78rem] transition-colors hover:bg-ink-04"
          >
            Write the reply ↗
          </a>
        )}
        {!item.shareId && !item.rawText && (
          <span className="text-[0.78rem] text-ink-30">
            Nothing attached — they may have deleted it since.
          </span>
        )}
      </div>

      {showText && item.rawText && (
        <pre className="mt-3 max-h-[380px] overflow-auto whitespace-pre-wrap rounded-xl bg-ink-04 p-4 font-sans text-[0.8rem] leading-relaxed text-ink-70">
          {item.rawText}
        </pre>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-ink-08 pt-4">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note for the next reviewer (they never see this)"
          className="min-w-[220px] flex-1 rounded-xl border border-ink-15 px-3 py-2 text-[0.82rem] outline-none focus:border-ink-30"
        />
        {item.status === "open" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void send({ status: "done", adminNote: note })}
            className="rounded-full bg-ink px-4 py-2 text-[0.82rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Mark replied"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void send({ status: "open", adminNote: note })}
            className="rounded-full border border-ink-15 px-4 py-2 text-[0.82rem] transition-colors hover:border-ink-30 disabled:opacity-40"
          >
            Reopen
          </button>
        )}
      </div>
    </li>
  );
}
