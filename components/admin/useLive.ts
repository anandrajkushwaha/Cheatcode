"use client";

import { useEffect, useState } from "react";

/**
 * The live visits, polled every 20 seconds and shared by every component on
 * the page that asks — the count at the top and the dots in the table read
 * one request, not one each. Polling stops when nothing is listening or the
 * tab is hidden.
 */

export type Live = { count: number; sessions: Set<string>; at: number } | null;

const EVERY_MS = 20_000;
let current: Live = null;
const listeners = new Set<(l: Live) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

async function poll() {
  if (typeof document !== "undefined" && document.hidden) return;
  try {
    const r = await fetch("/api/admin/live", { cache: "no-store" });
    const j = (await r.json()) as { ok?: boolean; count?: number; sessions?: string[] };
    if (!j.ok) return;
    current = { count: j.count ?? 0, sessions: new Set(j.sessions ?? []), at: Date.now() };
    listeners.forEach((f) => f(current));
  } catch {
    /* keep the last value */
  }
}

export function useLive(initial?: { count: number; sessions: string[] } | null): Live {
  const [live, setLive] = useState<Live>(() =>
    current ?? (initial ? { count: initial.count, sessions: new Set(initial.sessions), at: Date.now() } : null),
  );
  useEffect(() => {
    listeners.add(setLive);
    if (!timer) {
      void poll();
      timer = setInterval(poll, EVERY_MS);
    }
    return () => {
      listeners.delete(setLive);
      if (!listeners.size && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);
  return live;
}
