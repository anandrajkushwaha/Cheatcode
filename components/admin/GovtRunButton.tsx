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
 */
export function GovtRunButton() {
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
        disabled={busy}
        className="rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Reading the boards…" : "Run now"}
      </button>
      <p className="mt-2 text-[0.78rem] text-ink-30">
        Reads every board in one go, newest-checked last. Takes up to two minutes the first time —
        a browser has to be downloaded before anything can be rendered.
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
