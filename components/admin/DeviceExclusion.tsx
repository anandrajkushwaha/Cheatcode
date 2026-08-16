"use client";

import { useEffect, useState } from "react";

const VID_KEY = "cc_vid";

function readCookie() {
  try {
    return document.cookie.split("; ").some((c) => c === "cc_owner=1");
  } catch {
    return false;
  }
}

function readVisitorId() {
  try {
    return localStorage.getItem(VID_KEY);
  } catch {
    return null;
  }
}

/**
 * Owner exclusion, from inside the panel.
 *
 * Two separate things happen here and it is worth keeping them apart:
 * the cookie stops anything new being recorded on this browser, while
 * "hide past activity" adds this browser's visitor id to a list the queries
 * filter against — which is what removes the weeks of your own browsing
 * that are already in the table.
 */
export function DeviceExclusion({ excludedDevices }: { excludedDevices: number }) {
  const [excluded, setExcluded] = useState<boolean | null>(null);
  const [vid, setVid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setExcluded(readCookie());
    setVid(readVisitorId());
  }, []);

  async function hideHistory(remove: boolean) {
    if (!vid) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/analytics/exclude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: vid, remove, note: "admin device" }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed");
      setExcluded(!remove);
      setNote(
        remove
          ? "This device counts as a normal visitor again. Reload to see the numbers change."
          : "Done. Your past activity is out of every figure on this page — reload to see it.",
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (excluded === null) return null;

  return (
    <div className="mt-8 rounded-2xl border border-ink-08 p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-[62ch]">
          <p className="text-[0.95rem] font-medium">
            {excluded ? "This device isn't being counted" : "This device is being counted"}
          </p>
          <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-50">
            {excluded
              ? "Nothing you do in this browser reaches the panel or Google Analytics. Signing in set this, and it lasts two years rather than expiring with your session."
              : "Your browsing of the live site is currently mixed into the numbers below. Signing in usually sets this automatically — if it hasn't, turn it on here."}
          </p>

          {vid ? (
            <p className="mt-3 font-mono text-[0.72rem] text-ink-30">device id {vid}</p>
          ) : (
            <p className="mt-3 text-[0.8rem] text-ink-30">
              No device id on this browser yet, so there is no past activity to hide.
            </p>
          )}

          {note && <p className="mt-3 text-[0.85rem] text-ink-70">{note}</p>}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2.5">
          <a
            href={`/api/analytics/exclude?on=${excluded ? "0" : "1"}`}
            className="whitespace-nowrap rounded-full border border-ink-15 px-4 py-2 text-[0.82rem] transition-colors hover:border-ink-30"
          >
            {excluded ? "Start counting this device" : "Stop counting this device"}
          </a>

          {vid && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void hideHistory(excluded)}
              className="whitespace-nowrap rounded-full bg-ink px-4 py-2 text-[0.82rem] font-medium text-paper transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-40"
            >
              {busy
                ? "Working…"
                : excluded
                  ? "Show my past activity"
                  : "Hide my past activity"}
            </button>
          )}
        </div>
      </div>

      <p className="mt-5 border-t border-ink-08 pt-4 text-[0.8rem] leading-relaxed text-ink-30">
        {excludedDevices > 0
          ? `${excludedDevices} device${excludedDevices === 1 ? "" : "s"} hidden from every figure on this page. `
          : ""}
        For a phone or another laptop, open{" "}
        <span className="font-mono text-ink-50">/api/analytics/exclude?on=1</span> on it — no
        login needed. To cover a whole network, set{" "}
        <span className="font-mono text-ink-50">ANALYTICS_EXCLUDE_IPS</span> in Vercel to your
        IP addresses, comma separated.
      </p>
    </div>
  );
}
