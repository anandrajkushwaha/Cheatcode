"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PersonCard } from "@/lib/admin/user-analytics";

/**
 * The people, as cards you can sift.
 *
 * Filtering happens here rather than in the URL because the whole list is
 * already on the page: a round trip to re-query four hundred rows so somebody
 * can type three letters is a slower screen for no benefit.
 *
 * A field nobody gave us prints an em dash. The age is the one derived number
 * on the card and it always carries the word "est." — it is a graduation year
 * plus twenty-two, not a date of birth, and the screen should never let that
 * be forgotten.
 */
const DASH = "—";

const WHEN = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const when = (iso: string) => WHEN.format(new Date(iso));

/** "just now", "3h ago", "2 days ago", then the date. */
function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86_400);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

const AVATAR = ["bg-[#e0f2fe] text-[#075985]", "bg-[#ede9fe] text-[#5b21b6]", "bg-[#dcfce7] text-[#166534]", "bg-[#fef3c7] text-[#92400e]", "bg-[#fce7f3] text-[#9d174d]", "bg-[#e0e7ff] text-[#3730a3]"];
function initials(name: string | null, email: string | null) {
  const src = (name ?? email ?? "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
function tone(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR[h % AVATAR.length];
}

/** The ATS score as a small ring: green from 80, amber from 60, red below. */
function ScoreRing({ score }: { score: number }) {
  const c = score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626";
  const r = 15;
  const len = 2 * Math.PI * r;
  return (
    <div className="relative size-11 shrink-0" title={`ATS score ${score}`}>
      <svg viewBox="0 0 36 36" className="size-11 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#15161a" strokeOpacity="0.07" strokeWidth="3.5" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={c} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(score / 100) * len} ${len}`} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[0.72rem] font-semibold tabular-nums">{score}</span>
    </div>
  );
}

function Field({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.68rem] uppercase tracking-[0.1em] text-ink-30">{label}</dt>
      <dd className="mt-0.5 truncate text-[0.86rem] text-ink" title={value ?? undefined}>
        {value ?? <span className="text-ink-30">{DASH}</span>}
        {value && hint && <span className="ml-1.5 text-[0.72rem] text-ink-30">{hint}</span>}
      </dd>
    </div>
  );
}

export function PeopleCards({ people }: { people: PersonCard[] }) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [domain, setDomain] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [sort, setSort] = useState<"joined" | "active" | "score">("joined");

  const stages = useMemo(
    () => [...new Set(people.map((p) => p.careerStage).filter(Boolean))] as string[],
    [people],
  );
  const domains = useMemo(
    () => [...new Set(people.map((p) => p.domain).filter(Boolean))].sort() as string[],
    [people],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = people.filter((p) => {
      if (stage && p.careerStage !== stage) return false;
      if (domain && p.domain !== domain) return false;
      if (!needle) return true;
      return [p.name, p.email, p.phone, p.city, p.profession]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
    const by = {
      joined: (p: PersonCard) => p.joined,
      active: (p: PersonCard) => p.lastActive ?? "",
      score: (p: PersonCard) => String(p.atsScore ?? -1).padStart(4, "0"),
    }[sort];
    return [...list].sort((a, b) => by(b).localeCompare(by(a)));
  }, [people, q, stage, domain, sort]);

  const sel = "rounded-lg border border-ink-15 bg-paper px-3 py-2 text-[0.82rem]";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, email, phone, city, role…"
          className={`${sel} min-w-[16rem] flex-1`}
        />
        <select value={stage} onChange={(e) => setStage(e.target.value)} className={sel}>
          <option value="">Any stage</option>
          {stages.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={domain} onChange={(e) => setDomain(e.target.value)} className={sel}>
          <option value="">Any field</option>
          {domains.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={sel} aria-label="Sort">
          <option value="joined">Newest first</option>
          <option value="active">Recently active</option>
          <option value="score">Highest ATS score</option>
        </select>
        <span className="text-[0.78rem] tabular-nums text-ink-30">
          {shown.length} of {people.length}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((p) => {
          const isOpen = open === p.userId;
          return (
            <div
              key={p.userId}
              className="rounded-2xl border border-ink-08 bg-paper p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-15 hover:shadow-[0_14px_32px_-20px_rgba(0,0,0,0.3)]"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full text-[0.82rem] font-semibold ${tone(p.userId)}`}
                >
                  {initials(p.name, p.email)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/users/${p.userId}`} className="truncate text-[0.98rem] font-semibold underline-offset-4 hover:underline">
                      {p.name ?? <span className="text-ink-30">Unnamed</span>}
                    </Link>
                    {p.plan === "pro" && (
                      <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-[0.66rem] font-medium text-[#9be15d]">Pro</span>
                    )}
                  </div>
                  <p className="truncate text-[0.8rem] text-ink-50">{p.profession ?? DASH}</p>
                </div>
                {p.atsScore !== null && <ScoreRing score={p.atsScore} />}
              </div>

              {/* when */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-[#f7f7f5] px-3 py-2 text-[0.74rem] text-ink-50">
                <span className="inline-flex items-center gap-1.5" title={when(p.joined)}>
                  <svg viewBox="0 0 16 16" className="size-3.5 text-ink-30" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <rect x="2" y="3" width="12" height="11" rx="2" />
                    <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" strokeLinecap="round" />
                  </svg>
                  Joined <span className="font-medium text-ink-70">{when(p.joined)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5" title={p.lastActive ? when(p.lastActive) : undefined}>
                  <span aria-hidden="true" className={`size-1.5 rounded-full ${p.lastActive && Date.now() - new Date(p.lastActive).getTime() < 7 * 86_400_000 ? "bg-[#22c55e]" : "bg-ink-15"}`} />
                  Last active <span className="font-medium text-ink-70">{p.lastActive ? ago(p.lastActive) : "never edited a résumé"}</span>
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
                <Field
                  label="Age"
                  value={p.ageEstimate ? `~${p.ageEstimate}` : null}
                  hint={p.gradYear ? `est. · ${p.gradYear} grad` : undefined}
                />
                <Field label="Stage" value={p.careerStage} />
                <Field label="Field" value={p.domain} />
                <Field label="City" value={p.city} />
                <Field label="Phone" value={p.phone} />
                <Field label="Email" value={p.email} />
              </dl>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink-08 pt-3">
                <p className="text-[0.76rem] text-ink-30">
                  {p.drafts} résumé{p.drafts === 1 ? "" : "s"}
                  {p.source === "upload" && " · from the résumé they uploaded"}
                  {p.source === "design" && " · read off their designed résumé"}
                  {p.source === "profile" && " · from profile only"}
                  {p.source === "sample" && " · still the template's sample"}
                  {p.source === "none" && " · nothing filled in"}
                </p>
                {p.gaps.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : p.userId)}
                    className="shrink-0 text-[0.78rem] font-medium text-ink underline"
                  >
                    {p.gaps.length} gap{p.gaps.length === 1 ? "" : "s"} {isOpen ? "▲" : "▼"}
                  </button>
                ) : (
                  <span className="text-[0.76rem] text-ink-30">
                    {p.atsScore === null ? "not scored" : "no gaps"}
                  </span>
                )}
              </div>

              {isOpen && (
                <ul className="mt-3 space-y-2 border-t border-ink-08 pt-3">
                  {p.gaps.map((g, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                          g.status === "fail" ? "bg-[#c0392b]" : "bg-[#d99a00]"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-[0.82rem] font-medium">{g.label}</p>
                        {g.detail && (
                          <p className="mt-0.5 text-[0.78rem] leading-relaxed text-ink-50">
                            {g.detail}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {shown.length === 0 && (
        <p className="py-10 text-center text-[0.85rem] text-ink-30">Nobody matches that.</p>
      )}
    </>
  );
}
