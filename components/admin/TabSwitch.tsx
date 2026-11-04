"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * A two-way pill switch over panels rendered on the server — the black track
 * with a white sliding thumb. Both panels stay mounted, so switching is
 * instant and keeps each one's filters and open rows.
 *
 * Each tab can show, in superscript, how many of its entries are new since
 * this browser last opened that tab. Opening the tab marks them seen and the
 * number goes. "Seen" is kept in this browser (localStorage), per tab: it is
 * a reading aid for whoever is looking, not shared state.
 */

export type Tab = {
  id: string;
  label: string;
  /** ISO time of each entry's latest activity; newer than "last seen" = new. */
  stamps: (string | null)[];
  content: React.ReactNode;
};

const seenKey = (scope: string, id: string) => `cc_admin_seen:${scope}:${id}`;

function readSeen(scope: string, id: string): string | null {
  try {
    return localStorage.getItem(seenKey(scope, id));
  } catch {
    return null;
  }
}

function markSeen(scope: string, id: string) {
  try {
    localStorage.setItem(seenKey(scope, id), new Date().toISOString());
  } catch {
    /* storage blocked: the number simply stays */
  }
}

export function TabSwitch({ scope, tabs }: { scope: string; tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const [fresh, setFresh] = useState<Record<string, number>>({});

  // Counted after mount (the server can't see this browser's "seen" times);
  // the tab that opens first is marked seen straight away.
  useEffect(() => {
    const counts: Record<string, number> = {};
    for (const t of tabs) {
      const seen = readSeen(scope, t.id);
      counts[t.id] = t.stamps.filter((s) => s && (!seen || s > seen)).length;
    }
    if (active) {
      counts[active] = 0;
      markSeen(scope, active);
    }
    setFresh(counts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function open(id: string) {
    if (id === active) return;
    setActive(id);
    markSeen(scope, id);
    setFresh((f) => ({ ...f, [id]: 0 }));
  }

  // The thumb sits under the active button, measured, so labels of any width fit.
  const track = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const btn = track.current?.querySelector<HTMLButtonElement>(`[data-tab="${active}"]`);
      if (btn) setThumb({ x: btn.offsetLeft, w: btn.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active]);

  return (
    <div>
      <div
        ref={track}
        role="tablist"
        className="relative inline-flex rounded-full bg-ink p-1.5"
      >
        {thumb && (
          <span
            aria-hidden="true"
            className="absolute top-1.5 bottom-1.5 rounded-full bg-paper transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ left: thumb.x, width: thumb.w }}
          />
        )}
        {tabs.map((t) => {
          const on = t.id === active;
          const n = fresh[t.id] ?? 0;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              data-tab={t.id}
              onClick={() => open(t.id)}
              className={`relative z-10 rounded-full px-6 py-2.5 text-[0.95rem] font-medium tracking-[-0.02em] transition-colors duration-300 ${
                on ? "text-ink" : "text-paper/90 hover:text-paper"
              }`}
            >
              {t.label}
              {n > 0 && (
                <sup className="ml-0.5 align-super text-[0.62rem] font-semibold tabular-nums">
                  {n > 99 ? "99+" : n}
                  <span className="sr-only"> new</span>
                </sup>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {tabs.map((t) => (
          <div
            key={t.id}
            role="tabpanel"
            hidden={t.id !== active}
            className="animate-[tabIn_220ms_ease-out]"
          >
            {t.content}
          </div>
        ))}
      </div>
      <style>{`@keyframes tabIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
