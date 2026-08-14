"use client";

import { EVENTS, track } from "@/lib/analytics/events";
import type { FaqItem } from "@/types/db";

/**
 * Accepts either {q,a} or {question,answer}. Different writers produce
 * different shapes; normalising here means one malformed key can never
 * render an empty FAQ block again.
 */
function normaliseFaq(items: FaqItem[]) {
  return (items ?? [])
    .map((it) => {
      const raw = it as unknown as Record<string, string | undefined>;
      return { q: (raw.q ?? raw.question ?? "").trim(), a: (raw.a ?? raw.answer ?? "").trim() };
    })
    .filter((it) => it.q && it.a);
}

export function FaqBlock({ items }: { items: FaqItem[] }) {
  const faq = normaliseFaq(items);
  if (!faq.length) return null;
  return (
    <section className="mt-16 border-t border-ink-08 pt-12">
      <h2 className="text-[1.65rem] font-semibold tracking-[-0.03em]">
        Frequently asked questions
      </h2>
      <div className="mt-6 divide-y divide-ink-08 border-t border-ink-08">
        {faq.map((item, i) => (
          <details
            key={i}
            className="group py-5"
            onToggle={(e) => {
              if ((e.currentTarget as HTMLDetailsElement).open) {
                track(EVENTS.FAQ_OPEN, { label: item.q.slice(0, 120) });
              }
            }}
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-[1rem] font-medium leading-snug [&::-webkit-details-marker]:hidden">
              {item.q}
              <span aria-hidden="true" className="relative mt-1.5 size-3.5 shrink-0">
                <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-ink-50" />
                <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-ink-50 transition-transform duration-300 group-open:rotate-90 group-open:opacity-0" />
              </span>
            </summary>
            <p className="mt-3 max-w-[68ch] text-[0.97rem] leading-relaxed text-ink-50">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
