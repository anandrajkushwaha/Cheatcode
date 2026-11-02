"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Send a test copy, then the next batch — two steps, so a batch is never one stray click. */
export function EmailActions({ eligible, configured }: { eligible: number; configured: boolean }) {
  const router = useRouter();
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(25);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function call(body: object) {
    setBusy(true);
    setNote(null);
    const r = await fetch("/api/admin/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; sent?: number; failed?: string[]; remaining?: number };
    setBusy(false);
    setArmed(false);
    if (!j.ok) return setNote(j.error ?? "That didn't work.");
    setNote(
      `Sent ${j.sent ?? 0}.` +
        (j.failed?.length ? ` Failed ${j.failed.length}: ${j.failed.slice(0, 3).join("; ")}` : "") +
        (typeof j.remaining === "number" ? ` ${j.remaining} left in this segment.` : ""),
    );
    router.refresh();
  }

  if (!configured) {
    return (
      <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.84rem] text-ink-50">
        Sending is off: set <code>SMTP_USER</code> (support@cheatcodeapp.com) and <code>SMTP_PASS</code> (a Google app
        password for that mailbox) in Vercel → Settings → Environment Variables, then redeploy.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="your@email.com"
          className="w-64 rounded-full border border-ink-15 px-4 py-2 text-[0.85rem] outline-none focus:border-ink-30"
        />
        <button
          type="button"
          disabled={busy || !to}
          onClick={() => void call({ action: "test", to })}
          className="rounded-full border border-ink-15 px-4 py-2 text-[0.85rem] hover:border-ink-30 disabled:opacity-50"
        >
          Send test
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[0.85rem] text-ink-50">Send to the next</span>
        <input
          type="number"
          min={1}
          max={30}
          value={limit}
          onChange={(e) => setLimit(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
          className="w-20 rounded-full border border-ink-15 px-3 py-2 text-[0.85rem]"
        />
        <span className="text-[0.85rem] text-ink-50">of {eligible} not yet emailed</span>
        {!armed ? (
          <button
            type="button"
            disabled={busy || eligible === 0}
            onClick={() => setArmed(true)}
            className="rounded-full bg-ink px-4 py-2 text-[0.85rem] text-paper disabled:opacity-50"
          >
            Send batch…
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void call({ action: "send", limit })}
            className="rounded-full bg-[#c2410c] px-4 py-2 text-[0.85rem] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Sending…" : `Yes, send ${Math.min(limit, eligible)} emails now`}
          </button>
        )}
      </div>
      {note && <p className="rounded-xl bg-ink-04 px-4 py-3 text-[0.84rem]">{note}</p>}
    </div>
  );
}
