import type { AgentMessage } from "@/lib/app/agent-history";

/**
 * A conversation, read back.
 *
 * Deliberately not the overlay's bubbles. The overlay is a live exchange and
 * bubbles are right for one; this is a record somebody is scanning for a
 * thing they were told, and a wall of alternating bubbles is the worst shape
 * to scan. So: speaker in the margin, text in a column, and the jobs that
 * were put on screen at the time shown underneath the turn that named them.
 *
 * A server component — nothing here is interactive, so nothing here should
 * cost the browser a hydration pass.
 */
export function Transcript({ messages }: { messages: AgentMessage[] }) {
  return (
    <ol className="space-y-6">
      {messages.map((m) => (
        <li key={m.id} className="grid gap-1.5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-4">
          <p className="flex items-center gap-1.5 pt-0.5 text-[0.72rem] uppercase tracking-[0.14em] text-ink-30">
            {m.role === "user" ? "You" : "Agent"}
            {m.spoken && <SpokenMark />}
          </p>

          <div className="min-w-0">
            <p
              className={`whitespace-pre-wrap text-[0.92rem] leading-relaxed ${
                m.role === "user" ? "text-ink" : "text-ink-50"
              }`}
            >
              {m.content}
            </p>

            {!!m.actions?.jobs?.length && (
              <div className="mt-3">
                {m.actions.reason && (
                  <p className="mb-2 text-[0.78rem] text-ink-30">{m.actions.reason}</p>
                )}
                <ul className="flex flex-wrap gap-2">
                  {m.actions.jobs.map((j) => (
                    <li key={j.id}>
                      {/* Opens the employer's page, so it is a plain anchor
                          with the usual protections rather than a Link. */}
                      <a
                        href={j.apply_url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex flex-col rounded-xl border border-ink-08 px-3.5 py-2.5 transition-colors hover:border-ink-15"
                      >
                        <span className="text-[0.84rem] font-medium leading-snug text-ink">
                          {j.title}
                        </span>
                        <span className="mt-0.5 text-[0.75rem] text-ink-30">
                          {j.company}
                          {j.cities.length
                            ? ` · ${j.cities.join(", ")}`
                            : j.is_remote
                              ? " · Remote"
                              : ""}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Marks a turn that was spoken rather than typed. */
function SpokenMark() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-label="spoken" className="h-3 w-3">
      <rect x="6" y="2" width="4" height="7" rx="2" fill="currentColor" />
      <path
        d="M4 7.5a4 4 0 008 0M8 11.5V14"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
