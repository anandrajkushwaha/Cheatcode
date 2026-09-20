import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { llmJson } from "@/lib/app/llm";
import { toSlug } from "@/lib/interview/bank";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Drafting and publishing a question-bank page.
 *
 * `draft` writes a whole page in one model call — intro and twenty
 * question-and-answer pairs — and stores it unpublished. `publish` is a
 * separate action taken by a person after reading it.
 *
 * Those being two actions is the point. It would be less work to generate and
 * publish in one go, and that is exactly how a site ends up with two hundred
 * machine-written pages nobody has read, which Google treats as spam and
 * which will eventually contain a confidently wrong answer under our name.
 */

const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

const SCHEMA = {
  type: "object",
  properties: {
    intro: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { question: { type: "string" }, answer: { type: "string" } },
        required: ["question", "answer"],
      },
    },
  },
  required: ["intro", "items"],
} as const;

type Body = { action?: "draft" | "publish" | "delete"; role?: string; id?: number; published?: boolean };

export async function POST(request: Request) {
  const store = await cookies();
  if (!verifySessionToken(store.get(ADMIN_COOKIE)?.value)) return bad("Not signed in", 401);

  const db = createAdminClient();
  if (!db) return bad("Supabase isn't configured on this deployment.", 503);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("Could not read that request.");
  }

  /* ----------------------------------------------------------- publish */

  if (body.action === "publish") {
    if (!body.id) return bad("Which page?");
    const publish = body.published === true;
    const { error } = await db
      .from("question_banks")
      .update({
        published: publish,
        published_at: publish ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id);
    if (error) return bad(`Could not update: ${error.message}`, 502);
    return Response.json({ ok: true });
  }

  /* ------------------------------------------------------------ delete */

  if (body.action === "delete") {
    if (!body.id) return bad("Which page?");
    const { error } = await db.from("question_banks").delete().eq("id", body.id);
    if (error) return bad(`Could not delete: ${error.message}`, 502);
    return Response.json({ ok: true });
  }

  /* ------------------------------------------------------------- draft */

  const role = (body.role ?? "").trim().slice(0, 80);
  if (!role) return bad("Which role?");
  const slug = toSlug(role);
  if (!slug) return bad("That role name has no usable URL in it.");

  const existing = await db.from("question_banks").select("id").eq("slug", slug).maybeSingle();
  if (existing.data) return bad("There is already a page for that role.", 409);

  const result = await llmJson({
    name: "question_bank",
    meta: { feature: "interview_questions" },
    temperature: 0.6,
    maxTokens: 8000,
    timeoutMs: 110_000,
    system: [
      `You are writing a reference page: "${role} interview questions", for candidates in India.`,
      "",
      "`intro`: 60-90 words on what interviews for this role actually test and how they are usually run. Concrete. No 'in today's competitive world'.",
      "",
      "`items`: exactly 20 question-and-answer pairs.",
      "- Questions must be ones a real interviewer asks for this role. Mix the practical, the behavioural and the two or three technical ones that always come up.",
      "- Order them the way an interview runs: opening questions first, deeper ones later.",
      "- `answer` is 90-140 words, written in the first person as a strong candidate would say it out loud. Specific, with a real example where the question invites one.",
      "- Never invent a company name, a salary figure or a statistic.",
      "- No bullet points inside an answer, no markdown, no headings. Plain sentences.",
      "- Indian context where it matters: notice periods, CTC, relocation.",
    ].join("\n"),
    user: `Role: ${role}`,
    schema: SCHEMA as unknown as Record<string, unknown>,
  });

  if (!result.ok) return bad(result.error, 502);

  const data = result.data as { intro?: unknown; items?: unknown };
  const items = (Array.isArray(data.items) ? data.items : [])
    .map((i) => {
      const row = i as Record<string, unknown>;
      return {
        question: String(row.question ?? "").trim(),
        answer: String(row.answer ?? "").trim(),
      };
    })
    .filter((i) => i.question.length > 8 && i.answer.length > 40);

  if (items.length < 5) return bad("The draft came back too thin to be worth a page.", 502);

  const { data: created, error } = await db
    .from("question_banks")
    .insert({
      role,
      slug,
      intro: String(data.intro ?? "").trim() || null,
      published: false,
    })
    .select("id")
    .single();

  if (error || !created) return bad(`Could not save: ${error?.message ?? "unknown"}`, 502);

  const bankId = (created as { id: number }).id;
  const rows = items.map((i, n) => ({ bank_id: bankId, position: n + 1, ...i }));

  const inserted = await db.from("question_bank_items").insert(rows);
  if (inserted.error) {
    await db.from("question_banks").delete().eq("id", bankId);
    return bad("Could not save the questions.", 502);
  }

  return Response.json({ ok: true, id: bankId, count: rows.length });
}
