import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The public question bank.
 *
 * Read with the anon client, because these pages are served to people who are
 * not signed in and the RLS policy already restricts it to published rows.
 * Using the service key here would work and would mean one missing `.eq()`
 * away from serving drafts.
 */

export type BankItem = { question: string; answer: string };

export type QuestionBank = {
  id: number;
  role: string;
  slug: string;
  intro: string | null;
  published: boolean;
  items: BankItem[];
};

export type BankSummary = { role: string; slug: string; count: number };

export function toSlug(role: string): string {
  return role
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Every live page, for the index and the sitemap. */
export async function getPublishedBanks(): Promise<BankSummary[]> {
  const db = createPublicClient();
  if (!db) return [];

  const { data, error } = await db
    .from("question_banks")
    .select("role, slug, question_bank_items(count)")
    .eq("published", true)
    .order("role", { ascending: true });

  if (error) {
    if (!/does not exist/i.test(error.message)) {
      console.error("[bank] list failed", error.message);
    }
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const items = r.question_bank_items as { count?: number }[] | null;
    return {
      role: String(r.role ?? ""),
      slug: String(r.slug ?? ""),
      count: items?.[0]?.count ?? 0,
    };
  });
}

/** One live page. Null for a draft or a slug that does not exist. */
export async function getBank(slug: string): Promise<QuestionBank | null> {
  const db = createPublicClient();
  if (!db) return null;

  const { data, error } = await db
    .from("question_banks")
    .select("id, role, slug, intro, published, question_bank_items(position, question, answer)")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  const raw = (row.question_bank_items ?? []) as {
    position: number;
    question: string;
    answer: string;
  }[];

  return {
    id: Number(row.id),
    role: String(row.role ?? ""),
    slug: String(row.slug ?? ""),
    intro: (row.intro as string | null) ?? null,
    published: true,
    items: [...raw]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ question: i.question, answer: i.answer })),
  };
}

/* ---------------------------------------------------------------- admin */

export async function getAllBanks(): Promise<
  { ok: true; data: (BankSummary & { published: boolean; id: number })[] } | { ok: false; missing: string }
> {
  const db = createAdminClient();
  if (!db) return { ok: false, missing: "81_question_bank.sql" };

  const { data, error } = await db
    .from("question_banks")
    .select("id, role, slug, published, question_bank_items(count)")
    .order("role", { ascending: true });

  if (error) return { ok: false, missing: "81_question_bank.sql" };

  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map((r) => {
      const items = r.question_bank_items as { count?: number }[] | null;
      return {
        id: Number(r.id),
        role: String(r.role ?? ""),
        slug: String(r.slug ?? ""),
        published: Boolean(r.published),
        count: items?.[0]?.count ?? 0,
      };
    }),
  };
}

export async function getBankForAdmin(id: number): Promise<QuestionBank | null> {
  const db = createAdminClient();
  if (!db) return null;

  const { data, error } = await db
    .from("question_banks")
    .select("id, role, slug, intro, published, question_bank_items(position, question, answer)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  const raw = (row.question_bank_items ?? []) as {
    position: number;
    question: string;
    answer: string;
  }[];

  return {
    id: Number(row.id),
    role: String(row.role ?? ""),
    slug: String(row.slug ?? ""),
    intro: (row.intro as string | null) ?? null,
    published: Boolean(row.published),
    items: [...raw].sort((a, b) => a.position - b.position).map((i) => ({
      question: i.question,
      answer: i.answer,
    })),
  };
}
