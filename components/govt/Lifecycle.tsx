import {
  LIFECYCLE,
  STAGE_LABEL,
  formatDate,
  type Notice,
} from "@/lib/govt/types";

/**
 * The exam's whole life, including the parts that have not happened.
 *
 * This is the one thing in the feature that is structurally different from
 * every site it competes with. They list a result, an admit card and a
 * notification as three unrelated rows in three columns; a person following
 * one recruitment has to go and find each separately, every time, and the
 * question they actually arrive with — "has the admit card come out yet?" —
 * is never answered, because a site that only lists what exists cannot say
 * that something does not.
 *
 * So every stage is drawn, always. A stage with no notice says "Not announced
 * yet", which is a real answer and the one most people came for.
 */
export function Lifecycle({ notices }: { notices: Notice[] }) {
  const byKind = new Map(notices.map((n) => [n.kind, n]));

  return (
    <section>
      <h2 className="mb-4 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
        Where this exam is up to
      </h2>

      <ol className="relative">
        {LIFECYCLE.map((kind, i) => {
          const notice = byKind.get(kind);
          const last = i === LIFECYCLE.length - 1;

          return (
            <li key={kind} className="relative flex gap-4 pb-5 last:pb-0">
              {/* The rail, drawn per item rather than as one absolute line:
                  the items are different heights, and a single line sized to
                  the list would need a measured container. */}
              {!last && (
                <span
                  aria-hidden="true"
                  className="absolute left-[7px] top-5 h-[calc(100%-1.25rem)] w-px bg-ink-08"
                />
              )}

              <span
                aria-hidden="true"
                className={`relative z-10 mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 ${
                  notice ? "border-ink bg-ink" : "border-ink-15 bg-paper"
                }`}
              />

              <div className="min-w-0 flex-1">
                <p
                  className={`text-[0.88rem] font-medium ${notice ? "text-ink" : "text-ink-30"}`}
                >
                  {STAGE_LABEL[kind]}
                </p>

                {notice ? (
                  <>
                    <a
                      href={notice.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="mt-0.5 inline-block text-[0.86rem] leading-snug text-ink-50 underline decoration-ink-15 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink"
                    >
                      {notice.title}
                    </a>
                    {notice.publishedOn && (
                      <p className="mt-0.5 text-[0.76rem] text-ink-30">
                        {formatDate(notice.publishedOn)}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-0.5 text-[0.84rem] text-ink-30">Not announced yet</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
