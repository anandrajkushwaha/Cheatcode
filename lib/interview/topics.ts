import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import { llmJson } from "@/lib/app/llm";
import { toSlug } from "@/lib/interview/bank";

/**
 * The sub-topics offered for a role.
 *
 * Generated once per role and then shared by everyone who picks that role —
 * the topics that matter for a graphic designer do not depend on which
 * graphic designer is asking. That makes this a cache with a very high hit
 * rate rather than a per-user cost.
 *
 * A failure here is never fatal. The screen has the role itself to practise,
 * so an empty topic list costs a row of chips, not the feature.
 */

const SCHEMA = {
  type: "object",
  properties: {
    topics: { type: "array", items: { type: "string" } },
  },
  required: ["topics"],
} as const;

export async function getTopicsForRole(role: string, userId: string): Promise<string[]> {
  const slug = toSlug(role);
  if (!slug) return [];

  const db = createAppAdminClient();
  if (!db) return [];

  const cached = await db
    .from("interview_topic_sets")
    .select("topics")
    .eq("slug", slug)
    .maybeSingle();

  if (cached.data) {
    const topics = (cached.data as { topics: unknown }).topics;
    if (Array.isArray(topics) && topics.length) return topics.map(String).slice(0, 8);
  }

  // Missing table is the normal state before 82_interview_role.sql has run.
  if (cached.error && /does not exist/i.test(cached.error.message)) return [];

  const result = await llmJson({
    name: "interview_topics",
    meta: { feature: "interview_questions", userId },
    temperature: 0.4,
    maxTokens: 400,
    timeoutMs: 20_000,
    system: [
      "List the 8 areas an interviewer actually probes when hiring for a role.",
      "",
      "- Two to four words each, title case. They are chip labels.",
      "- Specific to this role. 'Communication' and 'Teamwork' apply to every job and are wasted slots.",
      "- Mix the craft and the judgement: the tools and techniques, and the decisions the role is trusted to make.",
      "- No numbering, no explanation, no duplicates of the role name itself.",
    ].join("\n"),
    user: `Role: ${role}`,
    schema: SCHEMA as unknown as Record<string, unknown>,
  });

  if (!result.ok) return [];

  const topics = ((result.data as { topics?: unknown })?.topics ?? []) as unknown[];
  const clean = Array.from(
    new Set(
      topics
        .map((t) => String(t).trim())
        .filter((t) => t.length > 1 && t.length < 40),
    ),
  ).slice(0, 8);

  if (clean.length === 0) return [];

  // Ignore the result: a cache that failed to write is a slower next visit,
  // not a broken one.
  await db
    .from("interview_topic_sets")
    .upsert({ slug, role, topics: clean }, { onConflict: "slug" });

  return clean;
}
