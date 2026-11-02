"use client";

import { Fragment, useState } from "react";
import type { PopupRow } from "@/lib/admin/match-popup";

/**
 * /admin/match-popup's people, one line each: who, where they saw it, the
 * matches, how long they looked, what came of it, when. Tap a line for the
 * rest — contact, field and skills, city and source, every click, payments
 * and the jobs they touched.
 */

const WHEN = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
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

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[0.68rem] uppercase tracking-[0.08em] text-ink-30">{label}</p>
      <div className="mt-1 text-[0.8rem] text-ink-70">{children}</div>
    </div>
  );
}

export function PopupPeople({ rows }: { rows: PopupRow[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-[0.82rem]">
        <thead className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-30">
          <tr className="border-b border-ink-08">
            <th className="py-2 pr-3 font-medium">Person</th>
            <th className="py-2 pr-3 font-medium">Seen after</th>
            <th className="py-2 pr-3 font-medium">Matches</th>
            <th className="py-2 pr-3 font-medium">On popup</th>
            <th className="py-2 pr-3 font-medium">Outcome</th>
            <th className="py-2 text-right font-medium">When</th>
          </tr>
        </thead>
        <tbody>
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
                  <td className="max-w-[16rem] truncate py-2.5 pr-3">
                    <span className="mr-1.5 inline-block w-3 text-ink-30">{isOpen ? "▾" : "▸"}</span>
                    <span className="font-medium">{r.name ?? r.email ?? r.phone ?? "—"}</span>
                    {r.anonymous && <span className="ml-1.5 text-[0.7rem] text-ink-30">· guest</span>}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-ink-50">{r.where}</td>
                  <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums">
                    {r.matches ?? "?"} <span className="text-ink-30">· best {r.best ?? "?"}%</span>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums text-ink-50">
                    {r.avgSeconds !== null ? `${r.avgSeconds}s` : "—"}
                    {r.shown > 1 ? <span className="text-ink-30"> · {r.shown}×</span> : null}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[0.72rem] font-medium ${TONE[r.outcome] ?? ""}`}>
                      {r.outcome}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right tabular-nums text-ink-50">{when(r.lastAt)}</td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-ink-08 bg-ink-04/50">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Detail label="Contact">
                          {r.phone && <p>{r.phone}</p>}
                          {r.email && <p className="break-all">{r.email}</p>}
                          {!r.phone && !r.email && "—"}
                          <p className="text-ink-30">{r.anonymous ? "Not signed in" : "Signed in"}</p>
                        </Detail>
                        <Detail label="Field">
                          <p>{r.field ?? "—"}</p>
                          {(r.years !== null || r.skills.length > 0) && (
                            <p className="text-ink-50">
                              {r.years !== null ? `${r.years} yrs` : ""}
                              {r.skills.length ? `${r.years !== null ? " · " : ""}${r.skills.slice(0, 6).join(", ")}` : ""}
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
                          {!r.anonymous && <p className="text-ink-50">{r.downloads} downloads</p>}
                          {r.closed > 0 && <p className="text-ink-50">Closed {r.closed}×</p>}
                        </Detail>
                        <Detail label="Clicks">{clicks.length ? clicks.join(" · ") : "—"}</Detail>
                        <Detail label="Paid">{r.paidRupees > 0 ? `₹${r.paidRupees} · ${r.paidKinds.join(", ")}` : "—"}</Detail>
                        <div className="sm:col-span-2">
                          <Detail label="Jobs">
                            {r.jobs.length
                              ? r.jobs.map((j, i) => (
                                  <p key={i}>
                                    {j.title}
                                    {j.company ? ` · ${j.company}` : ""} <span className="text-ink-30">({j.action})</span>
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
  );
}
