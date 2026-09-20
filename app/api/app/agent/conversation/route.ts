import { getSessionUser, createAppAdminClient } from "@/lib/supabase/app";

export const dynamic = "force-dynamic";

/**
 * One past conversation, as turns the agent screen can be opened with.
 *
 * Filtered by user_id as well as by id, deliberately. The id is a uuid in a
 * URL; guessing one is not realistic, but "not realistic" is not the standard
 * for somebody else's conversation with an agent that has read their resume.
 *
 * Only role and text come back. The `actions` column holds the job cards the
 * agent drew at the time, and those are stale — a posting from three weeks
 * ago may be closed. Re-rendering them as if they were current would be the
 * product lying quietly, so a resumed conversation starts as words and the
 * agent can pull fresh cards if it is asked again.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ ok: false, error: "Which conversation?" }, { status: 400 });

  const db = createAppAdminClient();
  if (!db) return Response.json({ ok: false, error: "Not configured." }, { status: 503 });

  const { data: owned } = await db
    .from("agent_conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owned) return Response.json({ ok: false, error: "Not found." }, { status: 404 });

  const { data, error } = await db
    .from("agent_messages")
    .select("role, content, spoken")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    // A very long history would be sent back to the model on every turn from
    // here on. The last 40 messages is plenty of context and bounded spend.
    .limit(40);

  if (error) {
    return Response.json({ ok: false, error: "Could not read that." }, { status: 502 });
  }

  const turns = ((data ?? []) as { role: string; content: string; spoken: boolean }[])
    .filter((m) => m.content?.trim())
    .map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("model" as const),
      text: m.content,
      // Spoken turns are hidden in the transcript while a call is live; on a
      // resumed conversation they are all just history, so they are shown.
      spoken: false,
    }));

  return Response.json({ ok: true, conversationId: id, turns });
}
