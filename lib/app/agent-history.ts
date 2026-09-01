import "server-only";
import { createAppServerClient, getSessionUser } from "@/lib/supabase/app";
import type { JobCard } from "@/lib/app/agent-types";

/**
 * What was said, previously.
 *
 * Read through the session client rather than the admin one on purpose: the
 * policies are the access control, and a page that reads history with the
 * secret key is a page that will one day read somebody else's. The queries
 * here carry no user_id filter at all — RLS supplies it, and if the policy
 * were ever dropped these would return nothing rather than everything.
 */

export type AgentConversation = {
  id: string;
  title: string | null;
  channel: "text" | "voice";
  started_at: string;
  updated_at: string;
  message_count: number;
};

export type AgentMessage = {
  id: string;
  role: "user" | "model";
  content: string;
  spoken: boolean;
  actions: { jobs?: JobCard[]; reason?: string } | null;
  created_at: string;
};

export async function listConversations(limit = 20): Promise<AgentConversation[]> {
  const user = await getSessionUser();
  if (!user) return [];

  const db = await createAppServerClient();
  if (!db) return [];

  const { data } = (await db
    .from("agent_conversations")
    .select("id,title,channel,started_at,updated_at,agent_messages(count)")
    .order("updated_at", { ascending: false })
    .limit(limit)) as unknown as {
    data:
      | (Omit<AgentConversation, "message_count"> & { agent_messages: { count: number }[] })[]
      | null;
  };

  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    channel: c.channel,
    started_at: c.started_at,
    updated_at: c.updated_at,
    message_count: c.agent_messages?.[0]?.count ?? 0,
  }));
}

export async function getMessages(conversationId: string): Promise<AgentMessage[]> {
  const user = await getSessionUser();
  if (!user) return [];

  const db = await createAppServerClient();
  if (!db) return [];

  const { data } = (await db
    .from("agent_messages")
    .select("id,role,content,spoken,actions,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200)) as unknown as { data: AgentMessage[] | null };

  return data ?? [];
}

/** Seconds of live voice left today. Null when it cannot be read. */
export async function voiceRemaining(): Promise<number | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const db = await createAppServerClient();
  if (!db) return null;

  const { data } = (await db.rpc("agent_voice_remaining", { p_user: user.id })) as unknown as {
    data: number | null;
  };
  return typeof data === "number" ? data : null;
}
