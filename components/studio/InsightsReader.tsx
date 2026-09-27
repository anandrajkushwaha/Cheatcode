"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EVENTS, track } from "@/lib/analytics/events";
import type { Insight } from "@/lib/insights/query";
import { ago } from "@/lib/insights/time";
import { InsightShare } from "@/components/studio/InsightShare";

/**
 * Inshorts, for careers.
 *
 * One card fills the frame; scrolling snaps to the next, so a swipe on a
 * phone or a flick of the trackpad moves exactly one story. ↑/↓ (and j/k) do
 * the same from the keyboard, and the arrow buttons beside the card on a wide
 * screen do it for a mouse.
 *
 * Stories that arrived since the last visit carry a "New" mark. What was seen
 * is remembered in this browser only — a convenience, so storage that is
 * blocked or wiped just means nothing is marked.
 */
/** The design sets this heading in a serif italic; Georgia is the one every
 *  device already has, so it costs no font download. */
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";

const TABS = [
  { key: "all", label: "All" },
  { key: "trend", label: "Trend" },
  { key: "guide", label: "Tips" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const SEEN_KEY = "cc_insights_seen";

/**
 * How many stories a signed-out visitor gets. The first is theirs to read;
 * the two behind it are blurred, and the scroller stops there rather than
 * carrying on into content they have not signed up for.
 */
const FREE_CARDS = 3;

/**
 * How tall the card frame is, inside the app's own shell. The public page
 * carries a site header and a footer that the app does not, so it passes its
 * own — a card that runs past the fold makes the page scroll and the snap
 * scroll fight each other.
 */
const APP_FRAME = "h-[calc(100dvh-230px)] min-h-[360px] overscroll-contain";

export function InsightsReader({
  items,
  startId,
  locked = false,
  frameClassName = APP_FRAME,
}: {
  items: Insight[];
  startId: string | null;
  /** Public page, nobody signed in: blur from the second card and stop at the third. */
  locked?: boolean;
  /** Height of the snapping frame, for shells with different chrome. */
  frameClassName?: string;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [index, setIndex] = useState(0);
  const [seenBefore, setSeenBefore] = useState<number | null>(null);
  const [sharing, setSharing] = useState<Insight | null>(null);
  const frame = useRef<HTMLDivElement>(null);

  const shown = useMemo(
    () => items.filter((i) => tab === "all" || i.category === tab),
    [items, tab],
  );

  // What is actually in the scroller. Cutting the list here rather than
  // hiding the overflow is what makes the wall hold: ↓, j/k and the arrow
  // buttons all clamp to `deck.length`, so there is no route past the third
  // card to keep in sync.
  const deck = useMemo(() => (locked ? shown.slice(0, FREE_CARDS) : shown), [shown, locked]);

  // What counted as "seen" is read once, then moved up to now.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      setSeenBefore(raw ? Number(raw) || 0 : 0);
      const newest = items[0] ? new Date(items[0].at).getTime() : 0;
      if (newest) localStorage.setItem(SEEN_KEY, String(Math.max(newest, Number(raw) || 0)));
    } catch {
      setSeenBefore(null);
    }
  }, [items]);

  const go = useCallback(
    (to: number) => {
      const el = frame.current;
      if (!el) return;
      const i = Math.max(0, Math.min(deck.length - 1, to));
      el.scrollTo({ top: i * el.clientHeight, behavior: "smooth" });
    },
    [deck.length],
  );

  // Opened from a card on the home screen: start at that story.
  useEffect(() => {
    if (!startId) return;
    const i = items.findIndex((x) => x.id === startId);
    const el = frame.current;
    if (i > 0 && el) el.scrollTo({ top: i * el.clientHeight });
  }, [startId, items]);

  // Which card is in the frame.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollTop / Math.max(1, el.clientHeight)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        go(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  /**
   * Which story was actually read.
   *
   * An insight is read inside this reader, not at its own URL, so nothing
   * was ever recorded against /insights/<id> and every insight showed zero
   * views in the admin however many people scrolled past it. The event is
   * filed against that public path so the reading lands on the same row the
   * share does, and each one counts once per mount — scrolling back up is
   * the same read, not a second one.
   */
  const counted = useRef(new Set<string>());
  useEffect(() => {
    const item = deck[index];
    // A blurred card was not read, whatever the scroll position says.
    if (!item || (locked && index > 0) || counted.current.has(item.id)) return;
    // A card only glimpsed on the way past is not a read.
    const id = window.setTimeout(() => {
      if (counted.current.has(item.id)) return;
      counted.current.add(item.id);
      track(EVENTS.ARTICLE_VIEW, {
        label: `/insights/${item.id}`,
        path: `/insights/${item.id}`,
        location: locked ? "public-reader" : "app-reader",
      });
    }, 1200);
    return () => window.clearTimeout(id);
  }, [deck, index, locked]);

  function pick(next: Tab) {
    setTab(next);
    setIndex(0);
    frame.current?.scrollTo({ top: 0 });
  }



  return (
    <div className="mx-auto flex max-w-[920px] flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h1 style={{ fontFamily: SERIF }} className="text-[1.7rem] font-bold italic leading-none text-[#121224]">
          Insights
        </h1>
        {shown.length > 0 && (
          <p className="text-[0.78rem] tabular-nums text-ink-30">
            {Math.min(index + 1, deck.length)} / {shown.length}
          </p>
        )}
      </div>

      <div
        role="tablist"
        aria-label="Insight type"
        className="grid grid-cols-3 gap-1 rounded-xl bg-paper p-1 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => pick(t.key)}
            className={`rounded-lg py-2 text-[0.84rem] transition-colors ${
              tab === t.key ? "bg-[#16162a] font-medium text-white" : "text-ink-50 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="grid h-[50dvh] place-items-center rounded-3xl border border-dashed border-ink-15 bg-paper p-8 text-center">
          <div>
            <p className="text-[0.95rem] font-medium">Nothing here yet</p>
            <p className="mx-auto mt-2 max-w-[40ch] text-[0.85rem] leading-relaxed text-ink-50">
              Insights are gathered every morning from Indian business and jobs
              news. Check back after the next update.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div
            ref={frame}
            className={`${frameClassName} snap-y snap-mandatory overflow-y-auto rounded-3xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
          >
            {deck.map((i, n) => {
              const fresh = seenBefore !== null && seenBefore > 0 && new Date(i.at).getTime() > seenBefore;
              // Everything after the first card, for a visitor who has not
              // signed in. Real story, real picture, out of focus.
              const veiled = locked && n > 0;
              return (
                <div key={i.id} className="relative h-full snap-start snap-always">
                <article
                  aria-hidden={veiled || undefined}
                  inert={veiled || undefined}
                  style={veiled ? { filter: `blur(${n === 1 ? 6 : 9}px)` } : undefined}
                  className={`h-full overflow-hidden rounded-3xl border border-[#efe9cf] bg-paper ${
                    veiled ? "pointer-events-none select-none" : ""
                  } ${
                    i.imageUrl ? "flex flex-col md:grid md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]" : "flex flex-col"
                  }`}
                >
                  {/* Only here, in the reader — the home card stays text. */}
                  {i.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={i.imageUrl}
                      alt=""
                      loading={n < 2 ? "eager" : "lazy"}
                      className="h-[34%] w-full shrink-0 object-cover md:h-full"
                    />
                  )}
                  <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex items-center gap-2 bg-[#fcfaee] px-6 py-4 text-[0.74rem] sm:px-8">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-medium uppercase tracking-[0.1em] ${
                        i.category === "guide" ? "bg-[#e8efff] text-[#1f5bff]" : "bg-[#fff1dc] text-[#b35f00]"
                      }`}
                    >
                      {i.category === "guide" ? "Tips" : "Trend"}
                    </span>
                    {fresh && (
                      <span className="rounded-full bg-[#16162a] px-2 py-0.5 font-medium text-white">New</span>
                    )}
                    <span className="ml-auto text-ink-30">{ago(i.at)}</span>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-5 sm:px-8 sm:pb-7">
                    <h2 className="text-[1.3rem] font-semibold leading-snug tracking-[-0.02em] text-[#121224] sm:text-[1.45rem]">
                      {i.title}
                    </h2>
                    <p className="mt-4 text-[0.98rem] leading-[1.7] text-ink-70">{i.summary}</p>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-ink-08 pt-4">
                      {i.sourceUrl ? (
                        <a
                          href={i.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 truncate text-[0.82rem] text-ink-50 hover:text-ink"
                        >
                          Read the full story at{" "}
                          <span className="font-medium text-ink">{i.sourceName ?? "the source"}</span> ↗
                        </a>
                      ) : (
                        <span className="text-[0.82rem] text-ink-30">Cheatcode Insights</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setSharing(i)}
                        className="shrink-0 rounded-full bg-[#16162a] px-4 py-1.5 text-[0.8rem] font-medium text-white transition-opacity hover:opacity-90"
                      >
                        Share
                      </button>
                    </div>

                    {n === 0 && deck.length > 1 && (
                      <p className="mt-3 text-center text-[0.72rem] text-ink-30">
                        Swipe up or press ↓ for the next story
                      </p>
                    )}
                  </div>
                  </div>
                </article>

                {veiled && (
                  <div className="absolute inset-0 grid place-items-center rounded-3xl bg-white/40 px-5 text-center">
                    {/* The words sit on their own panel rather than straight
                        on the blurred photograph — half of these cards have a
                        dark picture behind them and the copy has to hold up on
                        all of them. */}
                    <div className="max-w-[26rem] rounded-2xl bg-white/90 px-7 py-8 shadow-[0_8px_40px_rgba(0,0,0,0.1)] backdrop-blur-[2px]">
                      <p
                        style={{ fontFamily: SERIF }}
                        className="text-[1.5rem] font-bold italic leading-none text-[#121224] sm:text-[1.8rem]"
                      >
                        {shown.length - 1} more today
                      </p>
                      <p className="mx-auto mt-3 max-w-[38ch] text-[0.9rem] leading-relaxed text-ink-70">
                        Hiring, pay and work rules in India — a new set every morning. Free, and it
                        comes with the resume builder and mock interviews.
                      </p>
                      <a
                        href="/signin?next=/app/insights"
                        data-ev="cta_click"
                        data-ev-location="insights-wall"
                        data-ev-label="Sign up free"
                        className="mt-6 inline-block rounded-full bg-[#16162a] px-7 py-3 text-[0.9rem] font-medium text-white transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] active:scale-[0.97]"
                      >
                        Sign up free
                      </a>
                      <p className="mt-3 text-[0.76rem] text-ink-30">No card needed.</p>
                    </div>
                  </div>
                )}
                </div>
              );
            })}
          </div>

          {/* For a mouse on a wide screen. Touch and keys cover everyone else. */}
          <div className="absolute -right-14 top-1/2 hidden -translate-y-1/2 flex-col gap-2 lg:flex">
            <button
              type="button"
              aria-label="Previous story"
              disabled={index === 0}
              onClick={() => go(index - 1)}
              className="grid size-10 place-items-center rounded-full border border-ink-15 bg-paper text-ink-50 transition-colors hover:border-ink hover:text-ink disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Next story"
              disabled={index >= deck.length - 1}
              onClick={() => go(index + 1)}
              className="grid size-10 place-items-center rounded-full border border-ink-15 bg-paper text-ink-50 transition-colors hover:border-ink hover:text-ink disabled:opacity-30"
            >
              ↓
            </button>
          </div>
        </div>
      )}
      {sharing && <InsightShare item={sharing} onClose={() => setSharing(null)} />}
    </div>
  );
}
