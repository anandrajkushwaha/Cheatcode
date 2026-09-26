"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { num, duration } from "@/components/admin/ui";
import type { PageStat } from "@/lib/admin/pages";

/**
 * One row per page, sorted by whatever you last clicked.
 *
 * A bar list was the wrong shape here. It ranks, which means it answers
 * "what is doing well" and silently drops everything else — and the reason
 * this screen exists is the everything else. A table keeps every row on the
 * page, including the ones reading zero, and lets four numbers sit beside
 * each other so a page with traffic and no reading can be told apart from a
 * page with no traffic at all.
 */

type SortKey = "views" | "people" | "entries" | "readThrough" | "seconds" | "shares" | "title";

const COLS: { key: SortKey; label: string; hint: string; right?: boolean }[] = [
  { key: "views", label: "Views", hint: "Times the page was opened", right: true },
  { key: "people", label: "People", hint: "Distinct visitors", right: true },
  { key: "entries", label: "Landed", hint: "Visits that started on this page", right: true },
  { key: "readThrough", label: "Read", hint: "Average furthest scroll", right: true },
  { key: "seconds", label: "Time", hint: "Median time on the page", right: true },
  { key: "shares", label: "Shares", hint: "Times it was passed on", right: true },
];

export function PageTable({
  rows,
  emptyLabel,
  showGroup = false,
}: {
  rows: PageStat[];
  emptyLabel: string;
  showGroup?: boolean;
}) {
  const [sort, setSort] = useState<SortKey>("views");
  const [desc, setDesc] = useState(true);
  const [only, setOnly] = useState<"all" | "seen" | "unseen">("all");
  const [q, setQ] = useState("");

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (only === "seen" && r.views === 0) return false;
      if (only === "unseen" && r.views > 0) return false;
      if (needle && !`${r.title} ${r.path}`.toLowerCase().includes(needle)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title) * (desc ? -1 : 1);
      // A page nobody scrolled has no read-through, which is not the same as
      // 0% and must not sort as though it were the worst page on the site.
      const av = a[sort] ?? -1;
      const bv = b[sort] ?? -1;
      const d = Number(bv) - Number(av);
      return (desc ? d : -d) || a.title.localeCompare(b.title);
    });
    return list;
  }, [rows, sort, desc, only, q]);

  function head(key: SortKey) {
    if (sort === key) setDesc(!desc);
    else {
      setSort(key);
      setDesc(true);
    }
  }

  const unseenCount = rows.filter((r) => r.views === 0).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          placeholder="Filter by title or path"
          className="min-w-0 flex-1 rounded-lg border border-ink-15 bg-paper px-3 py-1.5 text-[0.82rem] outline-none placeholder:text-ink-30 focus:border-ink-30"
        />
        <div className="flex shrink-0 gap-1 rounded-lg border border-ink-15 p-0.5">
          {(
            [
              ["all", `All ${rows.length}`],
              ["seen", "Opened"],
              ["unseen", `Never opened ${unseenCount}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setOnly(key)}
              className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[0.78rem] transition-colors ${
                only === key ? "bg-ink text-paper" : "text-ink-50 hover:bg-ink-04"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-15 px-4 py-6 text-center text-[0.82rem] text-ink-30">
          {q || only !== "all" ? "Nothing matches that filter." : emptyLabel}
        </p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[0.82rem]">
            <thead>
              <tr className="border-b border-ink-08 text-[0.7rem] uppercase tracking-[0.12em] text-ink-30">
                <th className="px-2 py-2 text-left font-medium">
                  <button type="button" onClick={() => head("title")} className="hover:text-ink">
                    Page {sort === "title" && (desc ? "↓" : "↑")}
                  </button>
                </th>
                {COLS.map((c) => (
                  <th key={c.key} className="px-2 py-2 text-right font-medium">
                    <button
                      type="button"
                      title={c.hint}
                      onClick={() => head(c.key)}
                      className="whitespace-nowrap hover:text-ink"
                    >
                      {c.label} {sort === c.key && (desc ? "↓" : "↑")}
                    </button>
                  </th>
                ))}
                <th className="px-2 py-2 text-left font-medium">Top source</th>
              </tr>
            </thead>
            <tbody>
              {view.map((r) => (
                <tr
                  key={r.path}
                  className={`border-b border-ink-04 ${r.views === 0 ? "text-ink-30" : ""}`}
                >
                  <td className="max-w-[360px] px-2 py-2.5">
                    <Link
                      href={r.path}
                      target="_blank"
                      className="block truncate underline-offset-4 hover:underline"
                      title={r.path}
                    >
                      {r.title}
                    </Link>
                    <span className="block truncate text-[0.72rem] text-ink-30">
                      {showGroup && <span className="mr-1.5">{r.group} ·</span>}
                      {r.path}
                      {r.status && r.status !== "published" && (
                        <span className="ml-1.5">· {r.status}</span>
                      )}
                      {r.unknown && <span className="ml-1.5">· not in the page list</span>}
                    </span>
                  </td>
                  <Cell v={r.views} />
                  <Cell v={r.people} />
                  <Cell v={r.entries} />
                  <Cell v={r.readThrough} suffix="%" />
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {r.seconds == null ? <span className="text-ink-30">—</span> : duration(r.seconds)}
                  </td>
                  <Cell v={r.shares} />
                  <td className="px-2 py-2.5">
                    {r.sources.length === 0 ? (
                      <span className="text-ink-30">—</span>
                    ) : (
                      <span className="whitespace-nowrap text-ink-50">
                        {r.sources[0].source}
                        {r.sources.length > 1 && (
                          <span className="text-ink-30"> +{r.sources.length - 1}</span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** A zero is shown as a dash: nothing happened is a different fact from a
 *  measured zero, and a column of 0s reads as data when it is absence. */
function Cell({ v, suffix = "" }: { v: number | null; suffix?: string }) {
  return (
    <td className="px-2 py-2.5 text-right tabular-nums">
      {v == null || v === 0 ? (
        <span className="text-ink-30">—</span>
      ) : (
        <>
          {num(v)}
          {suffix}
        </>
      )}
    </td>
  );
}
