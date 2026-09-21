"use client";

import { useEffect } from "react";

/**
 * Take this browser's past browsing out of the numbers, once.
 *
 * Signing in to the admin panel already sets the cc_owner cookie, and that
 * stops every *new* hit — GA and our own table. What it never did was reach
 * back: the days somebody spent reading the blog before they were given a
 * login stayed in the dashboard as a visitor. The owner had a page for that
 * (/api/analytics/exclude); a team member would have had to be told it
 * existed.
 *
 * So every admin page does it quietly, for whoever is signed in. The visitor
 * id lives in localStorage, which the server cannot read, so it has to be
 * handed over from here. A flag keyed to the id means one request per
 * browser, ever — not one per page.
 */
export function ExcludeThisDevice({ who }: { who: string }) {
  useEffect(() => {
    try {
      const id = localStorage.getItem("cc_vid");
      // Never counted on this browser, so there is no history to remove.
      if (!id) return;
      if (localStorage.getItem("cc_vid_excluded") === id) return;

      fetch("/api/analytics/exclude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: id, note: `admin: ${who}`.slice(0, 120) }),
      })
        .then((r) => r.json())
        .then((j: { ok?: boolean }) => {
          if (j?.ok) localStorage.setItem("cc_vid_excluded", id);
        })
        .catch(() => {
          /* Retried on the next admin page. Nothing depends on it. */
        });
    } catch {
      /* Storage blocked — the cookie still stops new hits. */
    }
  }, [who]);

  return null;
}
