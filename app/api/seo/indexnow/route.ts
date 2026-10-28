import { getPostSlugsUpdatedSince } from "@/lib/queries/posts";
import { pingIndexNow } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * The daily IndexNow ping (Vercel Cron, vercel.json): every guide published
 * or edited in the last day, plus the pages that change with them. Publishing
 * from the admin already pings its own article; this catches scheduled posts
 * going live, edits made straight in the database and anything a ping missed.
 */
export async function GET(request: Request) {
  const cron = process.env.CRON_SECRET;
  if (!cron || request.headers.get("authorization") !== `Bearer ${cron}`) {
    return Response.json({ ok: false, error: "Not authorised" }, { status: 401 });
  }
  const since = new Date(Date.now() - 26 * 3_600_000).toISOString();
  const slugs = await getPostSlugsUpdatedSince(since);
  const paths = slugs.length ? ["/blog", "/llms.txt", ...slugs.map((s) => `/blog/${s}`)] : [];
  return Response.json({ ...(await pingIndexNow(paths)), slugs: slugs.length });
}
