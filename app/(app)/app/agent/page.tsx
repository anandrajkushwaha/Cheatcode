import Link from "next/link";
import { getProfile, getPrimaryResume, isPaid } from "@/lib/app/account";
import { listConversations, getMessages, allowance } from "@/lib/app/agent-history";
import { Card, Empty, PaidOnly } from "@/components/app/ui";
import { Transcript } from "@/components/app/Transcript";

/**
 * Everything the agent has been told, and everything it said back.
 *
 * The page used to say "Not built yet", which was true of the voice agent and
 * not true of the conversations people were already having in the overlay —
 * those were happening and then vanishing when the tab closed. This is the
 * record.
 *
 * One conversation is open at a time, chosen by ?c=. Rendered on the server
 * so a long history costs nothing to hydrate.
 */
export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;

  const [profile, resume, conversations, left] = await Promise.all([
    getProfile(),
    getPrimaryResume(),
    listConversations(),
    allowance(),
  ]);

  const paid = isPaid(profile);
  const openId = c && conversations.some((x) => x.id === c) ? c : conversations[0]?.id;
  const messages = openId ? await getMessages(openId) : [];
  const open = conversations.find((x) => x.id === openId);

  const minutes = left === null ? null : Math.floor(left.voiceLeft / 60);

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Agent</h1>
        {minutes !== null && left !== null && (
          <p className="text-[0.8rem] text-ink-30">
            {minutes > 0
              ? left.voiceIsTrial
                ? `${minutes} min of free voice left — once used, that's it`
                : `${minutes} min of voice left today`
              : left.voiceIsTrial
                ? "Free voice trial used up"
                : "Voice used for today — typing still works"}
          </p>
        )}
      </div>

      <p className="mt-2.5 max-w-[68ch] text-[0.92rem] leading-relaxed text-ink-50">
        Press the orb in the corner to talk. Everything said is kept, so you can come back to
        what it told you about a role a week later.
      </p>

      <div className="mt-8">
        <PaidOnly
          paid={paid}
          feature="A real conversation about your career, then jobs chosen off the back of it."
        >
          {conversations.length === 0 ? (
            <Card>
              <Empty>
                {resume
                  ? "Nothing yet. Press the orb — your resume is already loaded, so it can start from what you do now."
                  : "Nothing yet. Add your resume first; the agent starts from it."}
              </Empty>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
              {/* the list */}
              <nav aria-label="Past conversations" className="min-w-0">
                <ul className="space-y-1">
                  {conversations.map((conv) => {
                    const active = conv.id === openId;
                    return (
                      <li key={conv.id}>
                        <Link
                          href={`/app/agent?c=${conv.id}`}
                          aria-current={active ? "true" : undefined}
                          className={`block rounded-xl px-3.5 py-3 transition-colors ${
                            active ? "bg-ink-04" : "hover:bg-ink-04"
                          }`}
                        >
                          <span
                            className={`block truncate text-[0.85rem] leading-snug ${
                              active ? "font-medium text-ink" : "text-ink-50"
                            }`}
                          >
                            {conv.title ?? "Conversation"}
                          </span>
                          <span className="mt-1 flex items-center gap-1.5 text-[0.72rem] text-ink-30">
                            {conv.channel === "voice" && <MicMark className="h-3 w-3 shrink-0" />}
                            {when(conv.updated_at)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* the conversation */}
              <Card
                title={open?.channel === "voice" ? "Spoken" : "Typed"}
                note={open ? when(open.started_at, true) : undefined}
              >
                {messages.length ? (
                  <Transcript messages={messages} />
                ) : (
                  <Empty>This conversation has nothing in it.</Empty>
                )}
              </Card>
            </div>
          )}
        </PaidOnly>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ bits */

function MicMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
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

/**
 * Relative until it stops being useful.
 *
 * "3d ago" beats a date for anything this week and is worse than one after
 * that — nobody counts back seventeen days.
 */
function when(iso: string, long = false): string {
  const then = new Date(iso);
  const mins = Math.round((Date.now() - then.getTime()) / 60000);

  if (!long) {
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 24 * 60) return `${Math.round(mins / 60)}h ago`;
    if (mins < 7 * 24 * 60) return `${Math.round(mins / (24 * 60))}d ago`;
  }

  return then.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(then.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }),
  });
}
