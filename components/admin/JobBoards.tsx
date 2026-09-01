"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The job boards, and the button that pulls them.
 *
 * The whole point of this screen is that adding a board is a thirty-second job
 * and a broken board is visible without going looking. So every row carries
 * its last result, and a failed board can be retried on its own rather than
 * by re-running everything.
 */

export type Source = {
  id: string;
  provider: string;
  token: string;
  company_name: string;
  careers_url: string | null;
  is_active: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_count: number;
  last_error: string | null;
  search_query: string | null;
  search_country: string | null;
  job_count: number;
};

type Report = {
  ok?: boolean;
  sources?: number;
  written?: number;
  retired?: number;
  note?: string;
  error?: string;
  report?: { company: string; ok: boolean; found?: number; written?: number; error?: string }[];
};

export function JobBoards({ sources, totalJobs }: { sources: Source[]; totalJobs: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    provider: "greenhouse",
    token: "",
    company_name: "",
    search_query: "",
  });
  const isQuery = form.provider === "jsearch";

  async function call(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as Report & { result?: Report };
      if (!res.ok || json.error) {
        setError(json.error ?? "That didn't work.");
        return null;
      }
      setResult(json.result ?? json);
      router.refresh();
      return json;
    } catch {
      setError("Network trouble. Try again.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const ok = await call({ action: "add", ...form }, "add");
    if (ok) {
      setForm({ provider: "greenhouse", token: "", company_name: "", search_query: "" });
      setAdding(false);
    }
  }

  const field =
    "w-full rounded-xl border border-ink-15 px-3.5 py-2.5 text-[0.9rem] outline-none focus:border-ink-30";

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------ top */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.85rem] text-ink-50">
          {sources.filter((s) => s.provider !== "jsearch").length} boards ·{" "}
          {sources.filter((s) => s.provider === "jsearch").length} searches ·{" "}
          {totalJobs.toLocaleString("en-IN")} open{" "}
          {totalJobs === 1 ? "role" : "roles"}
        </p>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setAdding((a) => !a)}
            className="rounded-full border border-ink-15 px-4 py-2 text-[0.84rem] transition-colors hover:border-ink-30"
          >
            {adding ? "Cancel" : "Add a source"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void call({ action: "sync" }, "sync")}
            className="rounded-full bg-ink px-5 py-2 text-[0.84rem] font-medium text-paper disabled:opacity-40"
          >
            {busy === "sync" ? "Syncing…" : "Sync now"}
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------- form */}
      {adding && (
        <form onSubmit={add} className="rounded-2xl border border-ink-08 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-[0.75rem] text-ink-50">Board</span>
              <select
                value={form.provider}
                onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                className={`mt-1.5 ${field}`}
              >
                <option value="greenhouse">Greenhouse</option>
                <option value="lever">Lever</option>
                <option value="ashby">Ashby</option>
                <option value="jsearch">JSearch — a saved search</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[0.75rem] text-ink-50">
                {isQuery ? "What to search for" : "Slug in the URL"}
              </span>
              <input
                value={isQuery ? form.search_query : form.token}
                onChange={(e) =>
                  setForm((f) =>
                    isQuery
                      ? { ...f, search_query: e.target.value }
                      : { ...f, token: e.target.value },
                  )
                }
                placeholder={
                  isQuery ? "backend developer in Bengaluru India" : "razorpaysoftwareprivatelimited"
                }
                className={`mt-1.5 ${field}`}
              />
            </label>
            <label className="block">
              <span className="text-[0.75rem] text-ink-50">
                {isQuery ? "Label" : "Company"}
              </span>
              <input
                value={form.company_name}
                onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                placeholder={isQuery ? "Backend · Bengaluru" : "Razorpay"}
                className={`mt-1.5 ${field}`}
              />
            </label>
          </div>

          <p className="mt-3 max-w-[80ch] text-[0.78rem] leading-relaxed text-ink-30">
            {isQuery ? (
              <>
                A saved search runs against Google for Jobs, so it reaches Naukri, LinkedIn and
                Indeed — everything the company boards cannot. Each one costs a request from the
                monthly quota, so a handful run per night in rotation rather than all of them.
              </>
            ) : (
              <>
                The slug is the last part of the company&apos;s board URL —{" "}
                <code className="font-mono">boards.greenhouse.io/<b>slug</b></code>,{" "}
                <code className="font-mono">jobs.lever.co/<b>slug</b></code>,{" "}
                <code className="font-mono">jobs.ashbyhq.com/<b>slug</b></code>. Boards are free and
                unlimited, so add as many as you like.
              </>
            )}{" "}
            It gets pulled straight away, so a wrong one shows up here immediately.
          </p>

          <button
            type="submit"
            disabled={busy !== null}
            className="mt-4 rounded-full bg-ink px-5 py-2 text-[0.84rem] font-medium text-paper disabled:opacity-40"
          >
            {busy === "add" ? "Adding…" : "Add and pull"}
          </button>
        </form>
      )}

      {/* --------------------------------------------------------- result */}
      {error && (
        <p className="rounded-xl border border-ink-30 px-4 py-3 text-[0.85rem]">{error}</p>
      )}
      {result && (
        <div className="rounded-xl border border-ink-08 bg-ink-04/50 px-4 py-3.5 text-[0.85rem]">
          <p className="font-medium">
            {result.note
              ? result.note
              : `${result.written ?? 0} written, ${result.retired ?? 0} closed, across ${
                  result.sources ?? 0
                } ${result.sources === 1 ? "board" : "boards"}.`}
          </p>
          {result.report && result.report.length > 0 && (
            <ul className="mt-2 space-y-1 text-[0.8rem] text-ink-50">
              {result.report.map((r) => (
                <li key={r.company}>
                  {r.company}: {r.ok ? `${r.written ?? 0} of ${r.found ?? 0} kept` : r.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------- table */}
      <div className="overflow-x-auto rounded-2xl border border-ink-08">
        <table className="w-full min-w-[680px] text-[0.86rem]">
          <thead>
            <tr className="border-b border-ink-08 text-left text-[0.72rem] uppercase tracking-[0.12em] text-ink-30">
              <th className="px-4 py-3 font-normal">Name</th>
              <th className="px-4 py-3 font-normal">Source</th>
              <th className="px-4 py-3 text-right font-normal">Open</th>
              <th className="px-4 py-3 font-normal">Last run</th>
              <th className="px-4 py-3 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-b border-ink-08 last:border-0">
                <td className="px-4 py-3">
                  <span className={s.is_active ? "" : "text-ink-30 line-through"}>
                    {s.company_name}
                  </span>
                  {s.last_error && (
                    <p className="mt-0.5 max-w-[38ch] text-[0.76rem] leading-relaxed text-ink-50">
                      {s.last_error}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-50">
                  {s.provider === "jsearch" ? (
                    <>
                      search
                      <span className="text-ink-30"> · {s.search_query}</span>
                    </>
                  ) : (
                    <>
                      {s.provider}
                      <span className="text-ink-30"> · {s.token}</span>
                    </>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{s.job_count}</td>
                <td className="px-4 py-3 text-ink-50">
                  {s.last_run_at ? (
                    <span className={s.last_status === "error" ? "text-ink" : ""}>
                      {ago(s.last_run_at)}
                      {s.last_status === "error" ? " · failed" : ""}
                    </span>
                  ) : (
                    <span className="text-ink-30">never</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3 text-[0.8rem]">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void call({ action: "sync", id: s.id }, s.id)}
                      className="text-ink-50 underline-offset-4 hover:text-ink hover:underline disabled:opacity-40"
                    >
                      {busy === s.id ? "…" : "Pull"}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void call({ action: "toggle", id: s.id, is_active: !s.is_active }, s.id)
                      }
                      className="text-ink-30 underline-offset-4 hover:text-ink hover:underline disabled:opacity-40"
                    >
                      {s.is_active ? "Pause" : "Resume"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sources.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[0.86rem] text-ink-30">
                  No boards yet. Add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(mins)) return "—";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
