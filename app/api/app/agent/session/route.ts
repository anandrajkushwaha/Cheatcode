import { getSessionUser, createAppAdminClient } from "@/lib/supabase/app";
import { spend } from "@/lib/app/allowance";
import { recordVoiceCall } from "@/lib/app/ai-usage";
import { preferredOpenAIModel } from "@/lib/app/openai-models";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * Writing down what was said, and paying for it.
 *
 * Every transcript in the product goes through here. The browser cannot write
 * to agent_messages at all — there is no insert policy and no grant — because
 * a client that can write its own transcript can write one that never
 * happened, and the history page would then be a record of nothing.
 *
 * The same request settles the bill. `seconds` is how long the socket was
 * open, which only the client can observe, so it is clamped to something a
 * real conversation could be before it is spent. That is the honest position:
 * the number cannot be verified, but it can be bounded, and the daily
 * allowance means the worst case is one person's day of voice, not a bill.
 */

const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

/** A single POST cannot claim more than this. Longer calls checkpoint. */
const MAX_SECONDS_PER_REPORT = 15 * 60;

type Incoming = {
  conversationId?: unknown;
  channel?: unknown;
  seconds?: unknown;
  ended?: unknown;
  messages?: unknown;
  /** Which realtime model actually answered, for costing. */
  model?: unknown;
};

type Message = { role: "user" | "model"; content: string; spoken?: boolean; actions?: unknown };

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return bad("Not signed in", 401);

  const db = createAppAdminClient();
  if (!db) return bad("Not configured", 503);

  let body: Incoming;
  try {
    body = (await request.json()) as Incoming;
  } catch {
    return bad("Could not read that request.");
  }

  const messages = readMessages(body.messages);
  const seconds = readSeconds(body.seconds);
  const channel = body.channel === "voice" ? "voice" : "text";

  // Charge first. If the write of the transcript fails we would rather have
  // billed for a conversation than given away an unbilled one — the meter is
  // the only thing standing between this feature and an open tab.
  let left = null;
  if (seconds > 0) {
    left = await spend(user.id, { seconds });

    /**
     * The same seconds, recorded in money.
     *
     * The realtime session bills through a WebRTC connection the server never
     * touches, so there is no response body with a usage block in it — the
     * duration the browser reports is all there is. It is the number we
     * already bill the allowance against, so costing it changes no trust
     * assumption: it is bounded above by MAX_SECONDS_PER_REPORT either way.
     */
    recordVoiceCall({
      userId: user.id,
      sessionId: typeof body.conversationId === "string" ? body.conversationId : null,
      // What the client says it connected to, falling back to what we would
      // have asked for. Never blank: an unnamed model cannot be priced.
      model:
        typeof body.model === "string" && body.model.trim()
          ? body.model.trim().slice(0, 80)
          : preferredOpenAIModel("realtime"),
      seconds,
    });
  }

  let conversationId =
    typeof body.conversationId === "string" && body.conversationId ? body.conversationId : null;

  // Confirm the conversation is theirs before writing into it. The admin
  // client bypasses RLS, so this check is the policy.
  if (conversationId) {
    const { data } = (await db
      .from("agent_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle()) as unknown as { data: { id: string } | null };
    if (!data) conversationId = null;
  }

  if (!conversationId && messages.length) {
    const { data, error } = (await db
      .from("agent_conversations")
      .insert({
        user_id: user.id,
        channel,
        // The first thing they said, trimmed. Replaced by a written title
        // later; until then it is still better than a timestamp.
        title: messages.find((m) => m.role === "user")?.content.slice(0, 70) ?? null,
      })
      .select("id")) as unknown as { data: { id: string }[] | null; error: { message: string } | null };

    if (error || !data?.[0]) return bad("Could not start a conversation.", 500);
    conversationId = data[0].id;
  }

  if (conversationId && messages.length) {
    const { error } = await db.from("agent_messages").insert(
      messages.map((m) => ({
        conversation_id: conversationId,
        user_id: user.id,
        role: m.role,
        content: m.content,
        spoken: !!m.spoken,
        actions: m.actions ?? null,
      })),
    );
    if (error) return bad("Could not save that.", 500);
  }

  if (body.ended === true && conversationId) {
    await db.from("agent_conversations").update({ ended_at: new Date().toISOString() }).eq("id", conversationId);
  }

  return Response.json({
    ok: true,
    conversationId,
    remaining: left?.voiceLeft ?? null,
    messagesLeft: left?.messagesLeft ?? null,
  });
}

/* --------------------------------------------------------------- reading */

function readSeconds(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.round(value), MAX_SECONDS_PER_REPORT);
}

function readMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (m): m is Message =>
        !!m &&
        typeof m === "object" &&
        ((m as Message).role === "user" || (m as Message).role === "model") &&
        typeof (m as Message).content === "string" &&
        (m as Message).content.trim().length > 0,
    )
    .slice(0, 60)
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, 4000),
      spoken: !!m.spoken,
      actions: m.actions ?? null,
    }));
}
