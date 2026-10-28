"use client";

import { useEffect, useState } from "react";
import { MatchesPopup, type MatchesData } from "@/components/app/builder/MatchesPopup";
import { isGenuine, matchJob, type Candidate } from "@/lib/jobs/match";
import { findContact } from "@/lib/tools/contact";

/**
 * After the free ATS check: the same match popup as after a resume download.
 *
 * Matched here, in the browser — the checker promises the file never leaves
 * it — against a job list with no company or link (/api/tools/match-pool).
 * Everything else is MatchesPopup's: the copy, the ₹49 / ₹99 unlocks and the
 * events in /admin/match-popup.
 */

type PoolJob = { id: string; title: string; skills: string[]; years_min: number | null; years_max: number | null; cities: string[]; is_remote: boolean };

export function AtsMatches({ text }: { text: string }) {
  const [data, setData] = useState<MatchesData | null>(null);
  const [href, setHref] = useState("/app/jobs?for=me");

  useEffect(() => {
    let live = true;
    const candidate: Candidate = { skills: [], text: text.toLowerCase(), years: null, cities: [], remote: false, targetRole: null };
    fetch("/api/tools/match-pool")
      .then((r) => r.json())
      .then((d: { jobs?: PoolJob[] }) => {
        if (!live) return;
        const found = (d.jobs ?? [])
          .map((j) => ({ j, m: matchJob(candidate, j) }))
          .filter(({ j, m }) => isGenuine(m, j))
          .sort((a, b) => b.m.score - a.m.score);
        if (!found.length) return;
        setHref(`/app/jobs?picked=${found.slice(0, 20).map(({ j, m }) => `${j.id}:${m.score}`).join(",")}`);
        const next: MatchesData = {
          count: found.length,
          all: false,
          passUntil: null,
          prices: { job: 49, pass: 99, passDays: 7 },
          top: found.slice(0, 3).map(({ j, m }) => ({
            id: j.id,
            title: j.title,
            score: m.score,
            matched: m.matched.slice(0, 3),
            locked: true,
            company: null,
            where: j.is_remote ? "Remote" : j.cities.slice(0, 2).join(", ") || "India",
            applyUrl: null,
          })),
        };
        // A beat after the score, so the score is read first.
        setTimeout(() => live && setData(next), 1200);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [text]);

  if (!data) return null;
  const c = findContact(text);
  return (
    <MatchesPopup
      initial={data}
      onClose={() => setData(null)}
      ats={{ continueHref: href, contact: { name: c.name, email: c.email, phone: c.phone } }}
    />
  );
}
