"use client";

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
    return people.filter((p) => {
      if (stage && p.careerStage !== stage) return false;
      if (domain && p.domain !== domain) return false;
      if (!needle) return true;
      return [p.name, p.email, p.phone, p.city, p.profession]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [people, q, stage, domain]);

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
        <span className="text-[0.78rem] tabular-nums text-ink-30">
          {shown.length} of {people.length}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((p) => {
          const isOpen = open === p.userId;
          return (
            <div key={p.userId} className="rounded-2xl border border-ink-08 bg-paper p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[0.98rem] font-medium">
                    {p.name ?? <span className="text-ink-30">Unnamed</span>}
                  </p>
                  <p className="truncate text-[0.8rem] text-ink-50">
                    {p.profession ?? DASH}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {p.plan === "pro" && (
                    <span className="rounded-full bg-[#16162a] px-2 py-0.5 text-[0.68rem] font-medium text-white">
                      Pro
                    </span>
                  )}
                  {p.atsScore !== null && (
                    <span className="rounded-full bg-ink-04 px-2 py-0.5 text-[0.72rem] tabular-nums text-ink-50">
                      ATS {p.atsScore}
                    </span>
                  )}
                </div>
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
                  {p.source === "profile" && " · from profile only"}
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
