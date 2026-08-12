#!/usr/bin/env node
/**
 * Seeds Supabase with categories, authors, the keyword queue and the 40 launch articles.
 *
 *   npm run db:seed
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from .env.local.
 * Idempotent — safe to run more than once. Existing rows are updated, not duplicated.
 *
 * Run 02_content.sql in the Supabase SQL Editor first; this script only moves data,
 * it does not create tables.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- load .env.local without a dependency -------------------------------
function loadEnv() {
  try {
    for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* .env.local is optional if the vars are already exported */
  }
}
loadEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;

if (!URL || !KEY) {
  console.error(
    "\n  Missing env vars.\n" +
      "  Create .env.local in the project root with:\n\n" +
      "    NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co\n" +
      "    SUPABASE_SECRET_KEY=sb_secret_xxxx\n",
  );
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function rest(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: prefer ? { ...headers, Prefer: prefer } : headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}\n${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : null;
}

const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

// Send in batches so a single request never gets too large.
async function upsert(table, rows, onConflict, batchSize = 20) {
  let done = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    await rest(`${table}?on_conflict=${onConflict}`, {
      method: "POST",
      body: chunk,
      prefer: "resolution=merge-duplicates,return=minimal",
    });
    done += chunk.length;
    process.stdout.write(`\r  ${table}: ${done}/${rows.length}`);
  }
  process.stdout.write("\n");
}

async function main() {
  console.log(`\nSeeding ${URL}\n`);

  // 1 — categories
  await upsert("categories", read("content/seed/categories.json"), "slug");

  // 2 — authors
  await upsert("authors", read("content/seed/authors.json"), "slug");

  // 3 — keyword queue
  await upsert("keyword_queue", read("content/seed/keywords.json"), "focus_keyword", 50);

  // 4 — resolve foreign keys
  const cats = await rest("categories?select=id,slug");
  const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]));
  const authors = await rest("authors?select=id,slug");
  const authorId = authors.find((a) => a.slug === "cheatcode-team")?.id ?? authors[0]?.id;

  // 5 — the 40 launch articles
  const articles = read("content/launch/articles.json").map((a) => ({
    slug: a.slug,
    post_type: a.post_type,
    status: "published",
    title: a.title,
    h1: a.h1,
    excerpt: a.excerpt,
    content_html: a.content_html,
    toc: a.toc,
    published_at: a.published_at,
    updated_at: a.published_at,
    category_id: catId[a.category_slug] ?? null,
    author_id: authorId ?? null,
    seo_title: a.seo_title,
    seo_description: a.seo_description,
    focus_keyword: a.focus_keyword,
    secondary_keywords: a.secondary_keywords ?? [],
    faq: a.faq ?? [],
    entity_type: a.entity_type ?? null,
    entity_slug: a.entity_slug ?? null,
    entity_name: a.entity_name ?? null,
    related_tool_slugs: a.related_tool_slugs ?? [],
    internal_links: a.internal_links ?? [],
    word_count: a.word_count,
    data_points: a.data_points,
    quality_score: a.quality_score,
    reading_minutes: a.reading_minutes,
  }));

  await upsert("posts", articles, "slug", 5);

  // 6 — mark the queue rows those articles consumed as done
  const posts = await rest("posts?select=id,focus_keyword");
  let marked = 0;
  for (const p of posts) {
    const r = await rest(
      `keyword_queue?focus_keyword=eq.${encodeURIComponent(p.focus_keyword)}`,
      { method: "PATCH", body: { status: "done", post_id: p.id }, prefer: "return=minimal" },
    ).then(() => 1).catch(() => 0);
    marked += r;
  }

  const pending = await rest("keyword_queue?status=eq.pending&select=id");
  console.log(`
  categories   ${cats.length}
  authors      ${authors.length}
  articles     ${articles.length}
  queue done   ${marked}
  queue left   ${pending.length}   (~${Math.floor(pending.length / 6)} days at 6/day)

Done.
`);
}

main().catch((e) => {
  console.error("\nSeed failed:\n", e.message);
  process.exit(1);
});
