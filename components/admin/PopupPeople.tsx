"use client";

import { Fragment, useMemo, useState } from "react";
import { FilterMenu } from "@/components/admin/JourneyTable";
import type { PopupRow } from "@/lib/admin/match-popup";

/**
 * /admin/match-popup's people, one line each: who, where they saw it, the
 * matches, how long they looked, what came of it, when. Tap a line for the
 * rest — contact, field and skills, city and source, every click, payments
 * and the jobs they touched. Every header filters, spreadsheet-style, with
 * the same picker as /admin/journeys.
 */

const DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});
const WHEN = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});
const when = (iso: string | null) => (iso ? WHEN.format(new Date(iso)) : "—");

const TONE: Record<string, string> = {
  "Paid ₹99": "bg-[#e7f6ec] text-[#14532d]",
  "Paid ₹49": "bg-[#e7f6ec] text-[#14532d]",
  Applied: "bg-[#e7f6ec] text-[#14532d]",
  "Started payment": "bg-[#fff4e0] text-[#7a4b00]",
  "Looked at Pro": "bg-[#fff4e0] text-[#7a4b00]",
  "Opened matches": "bg-[#eef2ff] text-[#3730a3]",
  Closed: "bg-ink-04 text-ink-50",
  "No action": "bg-ink-04 text-ink-50",
};

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[0.68rem] uppercase tracking-[0.08em] text-ink-30">
        {label}
      </p>
      <div className="mt-1 text-[0.8rem] text-ink-70">{children}</div>
    </div>
  );
}

type Col = {
  id: string;
  label: string;
  value: (r: PopupRow) => string;
  right?: boolean;
};

const bestBand = (b: number | null) =>
  b === null
    ? "Unknown"
    : b >= 90
      ? "90%+"
      : b >= 80
        ? "80–89%"
        : b >= 70
          ? "70–79%"
          : "Below 70%";
const timeBand = (s: number | null) =>
  s === null ? "Unknown" : s < 5 ? "Under 5s" : s < 30 ? "5–30s" : "30s+";

const COLS: Col[] = [
  {
    id: "person",
    label: "Person",
    value: (r) => r.name ?? r.email ?? r.phone ?? "—",
  },
  { id: "where", label: "Seen after", value: (r) => r.where },
  { id: "best", label: "Matches", value: (r) => bestBand(r.best) },
  { id: "time", label: "On popup", value: (r) => timeBand(r.avgSeconds) },
  { id: "outcome", label: "Outcome", value: (r) => r.outcome },
  {
    id: "when",
    label: "When",
    value: (r) => (r.lastAt ? DAY.format(new Date(r.lastAt)) : "Unknown"),
    right: true,
  },
];

export function PopupPeople({ rows: all }: { rows: PopupRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );

  // A row passes when every filtered column holds one of its picked values.
  const rows = useMemo(
    () =>
      all.filter((r) =>
        COLS.every((c) => !filters[c.id] || filters[c.id].has(c.value(r))),
      ),
    [all, filters],
  );
  const active = Object.keys(filters).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[0.78rem] text-ink-50">
        <span className="tabular-nums">
          Showing {rows.length} of {all.length}
        </span>
        {active > 0 && (
          <>
            {Object.entries(filters).map(([id, set]) => (
              <span
                key={id}
                className="rounded-full bg-ink-04 px-2.5 py-0.5 text-ink"
              >
                {COLS.find((c) => c.id === id)?.label}:{" "}
                {set.size === 1 ? [...set][0] : `${set.size} picked`}
              </span>
            ))}
            <button
              type="button"
              onClick={() => setFilters({})}
              className="underline underline-offset-4 hover:text-ink"
            >
              Clear all filters
            </button>
          </>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-ink-08">
        <table className="w-full min-w-[760px] text-left text-[0.82rem]">
          <thead className="bg-ink-04">
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.id}
                  className={`px-3 py-2 font-medium ${c.right ? "text-right" : ""}`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      const b = e.currentTarget.getBoundingClientRect();
                      setMenu(
                        menu?.id === c.id
                          ? null
                          : { id: c.id, x: b.left, y: b.bottom + 4 },
                      );
                    }}
                    className={`inline-flex items-center gap-1 whitespace-nowrap text-[0.72rem] uppercase tracking-[0.08em] ${
                      filters[c.id] ? "text-ink" : "text-ink-50 hover:text-ink"
                    }`}
                  >
                    {c.label}
                    <span
                      aria-hidden
                      className={filters[c.id] ? "text-[#1f6fe0]" : ""}
                    >
                      {filters[c.id] ? "●" : "▾"}
                    </span>
                  </button>
                  {menu?.id === c.id && (
                    <FilterMenu
                      at={menu}
                      values={all.map(c.value)}
                      picked={filters[c.id] ?? null}
                      onClose={() => setMenu(null)}
                      onChange={(set) =>
                        setFilters((f) => {
                          const next = { ...f };
                          if (set) next[c.id] = set;
                          else delete next[c.id];
                          return next;
                        })
                      }
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={COLS.length}
                  className="px-3 py-8 text-center text-ink-50"
                >
                  Nobody matches these filters.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const isOpen = open === r.userId;
              const clicks = [
                r.unlockClicks && `₹49 ×${r.unlockClicks}`,
                r.passClicks && `₹99 ×${r.passClicks}`,
                r.applyClicks && `apply ×${r.applyClicks}`,
                r.seeAll && `see all ×${r.seeAll}`,
                r.proClicks && `Pro ×${r.proClicks}`,
              ].filter(Boolean);
              return (
                <Fragment key={r.userId}>
                  <tr
                    onClick={() => setOpen(isOpen ? null : r.userId)}
                    className={`cursor-pointer border-b border-ink-08 transition-colors hover:bg-ink-04 ${isOpen ? "bg-ink-04" : ""}`}
                  >
                    <td className="max-w-[16rem] truncate px-3 py-2.5">
                      <span className="mr-1.5 inline-block w-3 text-ink-30">
                        {isOpen ? "▾" : "▸"}
                      </span>
                      <span className="font-medium">
                        {r.name ?? r.email ?? r.phone ?? "—"}
                      </span>
                      {r.anonymous && (
                        <span className="ml-1.5 text-[0.7rem] text-ink-30">
                          · guest
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-ink-50">
                      {r.where}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                      {r.matches ?? "?"}{" "}
                      <span className="text-ink-30">
                        · best {r.best ?? "?"}%
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-ink-50">
                      {r.avgSeconds !== null ? `${r.avgSeconds}s` : "—"}
                      {r.shown > 1 ? (
                        <span className="text-ink-30"> · {r.shown}×</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[0.72rem] font-medium ${TONE[r.outcome] ?? ""}`}
                      >
                        {r.outcome}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-ink-50">
                      {when(r.lastAt)}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-ink-08 bg-ink-04/50">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <Detail label="Contact">
                            {r.phone && <p>{r.phone}</p>}
                            {r.email && <p className="break-all">{r.email}</p>}
                            {!r.phone && !r.email && "—"}
                            <p className="text-ink-30">
                              {r.anonymous ? "Not signed in" : "Signed in"}
                            </p>
                          </Detail>
                          <Detail label="Field">
                            <p>{r.field ?? "—"}</p>
                            {(r.years !== null || r.skills.length > 0) && (
                              <p className="text-ink-50">
                                {r.years !== null ? `${r.years} yrs` : ""}
                                {r.skills.length
                                  ? `${r.years !== null ? " · " : ""}${r.skills.slice(0, 6).join(", ")}`
                                  : ""}
                              </p>
                            )}
                          </Detail>
                          <Detail label="City · source">
                            <p>{r.city ?? "—"}</p>
                            <p className="text-ink-50">{r.source ?? "—"}</p>
                          </Detail>
                          <Detail label="Popup">
                            <p>
                              Shown {r.shown}× · first {when(r.firstShown)}
                            </p>
                            {!r.anonymous && (
                              <p className="text-ink-50">
                                {r.downloads} downloads
                              </p>
                            )}
                            {r.closed > 0 && (
                              <p className="text-ink-50">Closed {r.closed}×</p>
                            )}
                          </Detail>
                          <Detail label="Clicks">
                            {clicks.length ? clicks.join(" · ") : "—"}
                          </Detail>
                          <Detail label="Paid">
                            {r.paidRupees > 0
                              ? `₹${r.paidRupees} · ${r.paidKinds.join(", ")}`
                              : "—"}
                          </Detail>
                          <div className="sm:col-span-2">
                            <Detail label="Jobs">
                              {r.jobs.length
                                ? r.jobs.map((j, i) => (
                                    <p key={i}>
                                      {j.title}
                                      {j.company ? ` · ${j.company}` : ""}{" "}
                                      <span className="text-ink-30">
                                        ({j.action})
                                      </span>
                                    </p>
                                  ))
                                : "—"}
                            </Detail>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
