"use client";

import { useLive } from "@/components/admin/useLive";

/** "N on the site right now", with a pulsing dot while anyone is. */
export function LiveCount({ initial, minutes }: { initial: { count: number; sessions: string[] } | null; minutes: number }) {
  const live = useLive(initial);
  const n = live?.count ?? 0;
  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-ink-15 px-4 py-2 text-[0.85rem]">
      <span className="relative flex h-2.5 w-2.5">
        {n > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-60" />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${n > 0 ? "bg-[#22c55e]" : "bg-ink-15"}`} />
      </span>
      <span className="font-semibold tabular-nums">{live ? n : "…"}</span>
      <span className="text-ink-50">on the site right now</span>
      <span className="text-[0.72rem] text-ink-30">active in the last {minutes} min</span>
    </div>
  );
}
