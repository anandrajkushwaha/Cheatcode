import Link from "next/link";
import { getSessionUser, createAppAdminClient } from "@/lib/supabase/app";
import { OrbMark } from "@/components/studio/OrbMark";
import { AgentHistory } from "@/components/studio/AgentHistory";

export const dynamic = "force-dynamic";

/**
 * Past conversations with the agent.
 *
 * Read only, and that is the whole design. The agent itself is the orb in the
 * corner — it opens over whatever you were doing, which is the point of it —
 * so a second place to *start* a conversation would be a second entrance to
 * the same room. What was missing was a way to find something it told you
 * last week, and that is what this is.
 *
 * Everything degrades to the empty state. A conversation table that does not
 * exist yet, or a failed query, leaves somebody looking at an invitation to
 * press the orb rather than at an error about a table.
 */

type Row = {
  id: string;
  title: string | null;
  created_at: string;
  channel: string | null;
};

async function recentConversations(userId: string): Promise<Row[]> {
  const db = createAppAdminClient();
  if (!db) return [];

  const { data, error } = await db
    .from("agent_conversations")
    .select("id, title, created_at, channel")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    if (!/does not exist/i.test(error.message)) {
      console.error("[agent] history read failed", error.message);
    }
    return [];
  }

  return (data ?? []) as Row[];
}

export default async function StudioAgentPage() {
  const user = await getSessionUser();
  const rows = user ? await recentConversations(user.id) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.38rem] font-semibold tracking-[-0.03em]">Agent</h1>
        <p className="mt-1.5 max-w-[60ch] text-[0.86rem] leading-relaxed text-ink-50">
          Press the orb in the bottom-right corner to start something new, or
          pick up any of these where you left off.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink-15 bg-paper px-6 py-14 text-center">
          <OrbMark className="size-12" />
          <p className="mt-5 text-[0.95rem] font-medium">No conversations yet</p>
          <p className="mt-2 max-w-[46ch] text-[0.85rem] leading-relaxed text-ink-50">
            It has read your resume and knows the roles you are after, so it
            answers about you rather than in general. The orb is in the corner
            of every screen.
          </p>
        </div>
      ) : (
        <AgentHistory
          conversations={rows.map((row) => ({
            id: row.id,
            title: row.title,
            createdAt: row.created_at,
            channel: row.channel,
          }))}
        />
      )}

      <p className="text-[0.78rem] leading-relaxed text-ink-30">
        Looking for interview feedback instead? That lives with each interview
        — see{" "}
        <Link href="/app/interviews" className="underline underline-offset-4 hover:text-ink">
          Mock interviews
        </Link>
        .
      </p>
    </div>
  );
}
