import { StartButton } from "@/components/studio/interview/StartButton";

/**
 * The topics for a role, as a grid of tiles.
 *
 * The first tile is the role itself — a general interview — because that is
 * what most people want and burying it among eight sub-topics would make them
 * hunt for it. The rest narrow.
 */
export function TopicGrid({ role, topics }: { role: string; topics: string[] }) {
  const tiles = [role, ...topics.filter((t) => t.toLowerCase() !== role.toLowerCase())];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tiles.map((topic, i) => (
        <StartButton
          key={topic}
          topic={topic}
          kind={i === 0 ? "role" : "topic"}
          busyLabel="Writing your questions…"
          className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-ink-08 bg-paper px-5 py-4 text-left transition-all hover:border-ink-30 hover:shadow-[0_2px_14px_-6px_rgb(0_0_0/0.12)]"
        >
          <span className="min-w-0">
            <span className="block truncate text-[0.92rem] font-medium tracking-[-0.01em]">
              {topic}
            </span>
            {i === 0 && (
              <span className="mt-0.5 block text-[0.74rem] text-ink-30">
                A general interview for the role
              </span>
            )}
          </span>
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="size-[16px] shrink-0 text-ink-30 transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 5 7 7-7 7" />
          </svg>
        </StartButton>
      ))}
    </div>
  );
}
