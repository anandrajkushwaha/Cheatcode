"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RunResult } from "@/lib/govt/ingest";

/**
 * Run the boards now.
 *
 * Deliberately shows what each board did rather than a success tick. The
 * useful answer on a first run is never "it worked" — it is which of the ten
 * URLs turned out to be the wrong page, and that is only visible per board.
 *
 * While ingestion is paused the button is disabled rather than hidden: a run
 * would be a no-op anyway (the ingest only picks up active sources), and a
 * disabled control with a reason beside it is clearer than a missing one.
 */
export function GovtRunButton({ paused = false }: { paused?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/govt", { method: "POST" });
      setResult((await res.json()) as RunResult);
      router.refresh();
    } catch (e) {
      setResult({
        ok: false,
        sources: [],
        added: 0,
        remaining: 0,
        error: e instanceof Error ? e.message : "The run could not be started.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy || paused}
        className="rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Reading the boards…" : "Run now"}
      </button>
      <p className="mt-2 max-w-[68ch] text-[0.78rem] text-ink-30">
        {paused
          ? "Paused. Every board is switched off, so a run would read nothing and publish nothing. Switch a source back on in govt_sources once the publishing gate can be trusted."
          : "Reads every board in one go, newest-checked last. Takes up to two minutes the first time — a browser has to be downloaded before anything can be rendered."}
      </p>

      {result && (
        <div className="mt-4 rounded-xl border border-ink-08 p-4">
          {result.error && (
            <p className="mb-3 text-[0.82rem] text-[#c0392b]">{result.error}</p>
          )}
          <p className="text-[0.84rem]">
            {result.added} notice{result.added === 1 ? "" : "s"} added
            {result.remaining > 0 && ` · ${result.remaining} board(s) left for the next run`}
          </p>
          {result.sources.length > 0 && (
            <ul className="mt-2.5 space-y-1 text-[0.8rem] text-ink-50">
              {result.sources.map((s) => (
                <li key={s.source}>
                  <span className="font-medium text-ink">{s.source}</span> — {s.status}
                  {s.status !== "unchanged" && ` · ${s.checked} links read, ${s.found} notices`}
                  {s.note && <span className="text-[#8a5a12]"> · {s.note}</span>}
                  {s.error && <span className="text-[#c0392b]"> · {s.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
