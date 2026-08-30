import type { EventsSummary } from "@/lib/queries/admin";
import type { Range } from "@/lib/admin/range";

/**
 * The funnel steps, built once and shared by both screens that show them.
 *
 * The important part is `partial`. Some of these events have been recorded
 * since July; cta_view only started when the CTA observer shipped. Presenting
 * them side by side without saying so makes a measurement gap look like a
 * behavioural cliff — the reader concludes nobody sees the CTAs, when in truth
 * nobody was counting. A step whose event began after the window opened shows
 * its start date instead of a number.
 */
export function funnelSteps(
  ev: EventsSummary,
  range: Range,
): { label: string; value: number; note?: string; since?: string; partial?: boolean }[] {
  const windowStart = range.from
    ? new Date(range.from)
    : new Date(Date.now() - range.days * 864e5);

  const coverage = (event: string) => {
    const since = ev.first_seen?.[event];
    if (!since) return { since: undefined, partial: false };
    // A day of slack: an event first seen on the opening day of the window
    // has effectively been measured throughout it.
    const began = new Date(`${since}T00:00:00+05:30`);
    return { since, partial: began.getTime() > windowStart.getTime() + 864e5 };
  };

  const step = (label: string, value: number, event: string, note?: string) => ({
    label, value, note, ...coverage(event),
  });

  return [
    { label: "Visits", value: ev.funnel.sessions },
    step("Opened an article", ev.funnel.read_article, "article_view"),
    step("Read most of it", ev.funnel.read_deeply, "scroll_depth", "75% or more"),
    step("Opened a tool", ev.funnel.opened_tool, "tool_view"),
    step("Used the tool", ev.funnel.used_tool, "tool_compute"),
    step("Saw a call to action", ev.funnel.saw_cta, "cta_view"),
    step("Clicked it", ev.funnel.clicked_cta, "cta_click"),
    step("Joined the waitlist", ev.funnel.joined, "waitlist_success"),
  ];
}
