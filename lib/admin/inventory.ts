import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Every URL this site owns.
 *
 * The analytics tables can only ever tell you about pages somebody opened.
 * The question worth answering is the other one — which pages nobody opened —
 * and that cannot be derived from a table of visits. So the list of pages is
 * built from the things that create them: the route files for the fixed ones,
 * and the database for everything generated from a row.
 *
 * It is the same set of sources app/sitemap.ts walks, plus the signed-in
 * screens, which have no sitemap because they are not meant to be indexed but
 * are very much meant to be used.
 */

export type PageGroup = "Article" | "Insight" | "Question bank" | "Tool" | "Site" | "App";

export type InventoryPage = {
  /** The canonical path, exactly as page_views records it. */
  path: string;
  title: string;
  group: PageGroup;
  /** Posts only: whether it is actually live. A draft with no views is fine. */
  status?: string;
  publishedAt?: string | null;
};

/** The fixed public pages. Written out rather than globbed: a route file is
 *  not always a page somebody can reach, and a guessed URL in this list would
 *  show up forever as a page nobody visits. */
const SITE_PAGES: InventoryPage[] = [
  { path: "/", title: "Home", group: "Site" },
  { path: "/blog", title: "Guides — index", group: "Site" },
  { path: "/tools", title: "Free tools — index", group: "Tool" },
  { path: "/tools/resume-ats-checker", title: "Resume ATS checker", group: "Tool" },
  { path: "/tools/in-hand-salary-calculator", title: "In-hand salary calculator", group: "Tool" },
  { path: "/interview-questions", title: "Interview questions — index", group: "Site" },
  { path: "/become-a-mentor", title: "Become a mentor", group: "Site" },
  { path: "/authors/cheatcode-team", title: "Author — Cheatcode team", group: "Site" },
  { path: "/signin", title: "Sign in", group: "Site" },
  { path: "/privacy", title: "Privacy", group: "Site" },
  { path: "/terms", title: "Terms", group: "Site" },
  { path: "/refunds", title: "Refunds", group: "Site" },
];

/** The signed-in product. Not in the sitemap, on purpose — but a screen
 *  nobody opens is the more expensive kind of empty page. */
const APP_PAGES: InventoryPage[] = [
  { path: "/app", title: "App — Home", group: "App" },
  { path: "/app/agent", title: "App — Career agent", group: "App" },
  { path: "/app/resume", title: "App — Résumés", group: "App" },
  { path: "/app/resume/templates", title: "App — Templates", group: "App" },
  { path: "/app/resume/builder", title: "App — Résumé builder", group: "App" },
  { path: "/app/interviews", title: "App — Mock interviews", group: "App" },
  { path: "/app/interviews/[id]", title: "App — Interview session", group: "App" },
  { path: "/app/interviews/[id]/feedback", title: "App — Interview feedback", group: "App" },
  { path: "/app/jobs", title: "App — Jobs", group: "App" },
  { path: "/app/tools", title: "App — Tools", group: "App" },
  { path: "/app/tools/ats", title: "App — ATS checker", group: "App" },
  { path: "/app/tools/salary", title: "App — Salary calculator", group: "App" },
  { path: "/app/blogs", title: "App — Tips", group: "App" },
  { path: "/app/insights", title: "App — Insights", group: "App" },
  { path: "/app/profile", title: "App — Profile", group: "App" },
  { path: "/app/upgrade", title: "App — Upgrade", group: "App" },
];

export async function getInventory(): Promise<InventoryPage[]> {
  const db = createAdminClient();
  const pages: InventoryPage[] = [...SITE_PAGES, ...APP_PAGES];
  if (!db) return pages;

  const [posts, cats, banks, insights] = await Promise.all([
    db.from("posts").select("slug,title,status,published_at").limit(5000),
    db.from("categories").select("slug,name").limit(200),
    db.from("question_banks").select("slug,role,published").limit(1000),
    db.from("insights").select("id,title,published_at,is_published").limit(1000),
  ]);

  for (const p of (posts.data ?? []) as { slug: string; title: string; status: string; published_at: string }[]) {
    pages.push({
      path: `/blog/${p.slug}`,
      title: p.title,
      group: "Article",
      status: p.status,
      publishedAt: p.published_at,
    });
  }

  for (const c of (cats.data ?? []) as { slug: string; name: string }[]) {
    pages.push({ path: `/blog/category/${c.slug}`, title: `Category — ${c.name}`, group: "Site" });
  }

  // question_banks may not exist in an older database; a failed select is an
  // empty list here rather than an error on the whole screen.
  for (const b of (banks.data ?? []) as { slug: string; role: string; published: boolean }[]) {
    pages.push({
      path: `/interview-questions/${b.slug}`,
      title: `Interview questions — ${b.role}`,
      group: "Question bank",
      status: b.published ? "published" : "draft",
    });
  }

  for (const i of (insights.data ?? []) as {
    id: string;
    title: string;
    published_at: string | null;
    is_published: boolean;
  }[]) {
    pages.push({
      path: `/insights/${i.id}`,
      title: i.title,
      group: "Insight",
      status: i.is_published ? "published" : "draft",
      publishedAt: i.published_at,
    });
  }

  return pages;
}

/**
 * A recorded path, reduced to the page it belongs to.
 *
 * Visits arrive with the real id in them — /app/interviews/8f2c… — and one
 * row per interview would be a list of thousands of pages with one view each
 * instead of one screen with thousands. Ids are collapsed back to the route;
 * slugs, which are the page, are left alone. Insight ids are the exception:
 * each insight is its own piece of content, so they stay whole.
 */
export function canonicalPath(raw: string): string {
  let p = (raw || "/").split("?")[0].split("#")[0];
  if (p.length > 1) p = p.replace(/\/+$/, "");
  if (!p.startsWith("/")) p = `/${p}`;

  p = p
    .replace(/^\/app\/interviews\/[^/]+\/feedback$/, "/app/interviews/[id]/feedback")
    .replace(/^\/app\/interviews\/[^/]+$/, "/app/interviews/[id]")
    .replace(/^\/app\/resume\/builder\/.+$/, "/app/resume/builder")
    .replace(/^\/blog\/page\/\d+$/, "/blog")
    .replace(/^\/r\/[^/]+$/, "/r/[share]");

  return p || "/";
}
