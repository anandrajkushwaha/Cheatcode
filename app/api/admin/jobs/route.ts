import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin/auth";
import { createAppAdminClient } from "@/lib/supabase/app";
import { runIngest } from "@/lib/jobs/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

const PROVIDERS = new Set(["greenhouse", "lever", "ashby", "jsearch"]);

/**
 * Job boards, from the dashboard.
 *
 * The same run the cron does, behind the admin cookie instead of a secret.
 * That matters more than it sounds: the alternative was pasting a bearer
 * token into a terminal, which meant the secret had to be readable, written
 * down, and typed — three chances to leak it for a button that should just
 * exist.
 */
export async function POST(request: Request) {
  const store = await cookies();
  if (!verifySessionToken(store.get(ADMIN_COOKIE)?.value)) return bad("Not signed in", 401);

  const db = createAppAdminClient();
  if (!db) return bad("Supabase isn't configured on this deployment.", 503);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad("Could not read that request.");
  }

  const action = String(body.action ?? "");

  switch (action) {
    /* ------------------------------------------------------------- sync */
    case "sync": {
      const sourceId = typeof body.id === "string" ? body.id : undefined;
      // A single board is a quick retry after fixing a slug; the whole set is
      // capped so the request cannot outlive the function.
      const result = await runIngest(db, sourceId ? { sourceId } : { limit: 12 });
      revalidatePath("/admin/jobs");
      return Response.json(result);
    }

    /* -------------------------------------------------------------- add */
    case "add": {
      const provider = String(body.provider ?? "").trim();
      const token = String(body.token ?? "").trim();
      const company = String(body.company_name ?? "").trim();

      if (!PROVIDERS.has(provider)) return bad("Pick a provider.");
      if (!company) return bad("Give it a name.");

      const isQuery = provider === "jsearch";
      const searchQuery = String(body.search_query ?? "").trim();

      if (isQuery && !searchQuery) return bad("Write the search query.");
      if (!isQuery && !token) return bad("The board slug is missing.");

      const { data, error } = await db
        .from("job_sources")
        .insert({
          provider,
          // A saved query has no slug of its own, so one is derived from the
          // name — the unique index is on (provider, token) either way.
          token: (isQuery ? slugify(company) : token).slice(0, 120),
          company_name: company.slice(0, 120),
          search_query: isQuery ? searchQuery.slice(0, 160) : null,
          search_country: isQuery ? String(body.search_country ?? "in").slice(0, 2) : "in",
          search_remote: isQuery ? Boolean(body.search_remote) : false,
          careers_url: typeof body.careers_url === "string" ? body.careers_url.slice(0, 300) : null,
        })
        .select("id")
        .limit(1);

      if (error) {
        const duplicate = /duplicate key|unique/i.test(error.message);
        return bad(duplicate ? "That board is already on the list." : error.message, 400);
      }

      // Pull it immediately so a wrong slug is obvious now rather than at 4am.
      const id = (data ?? [])[0]?.id as string | undefined;
      const result = id ? await runIngest(db, { sourceId: id }) : null;

      revalidatePath("/admin/jobs");
      return Response.json({ ok: true, id, result });
    }

    /* ----------------------------------------------------------- toggle */
    case "toggle": {
      const id = String(body.id ?? "");
      if (!id) return bad("No board named.");
      const { error } = await db
        .from("job_sources")
        .update({ is_active: Boolean(body.is_active) })
        .eq("id", id);
      if (error) return bad(error.message, 500);
      revalidatePath("/admin/jobs");
      return Response.json({ ok: true });
    }

    /* ----------------------------------------------------------- remove */
    case "remove": {
      const id = String(body.id ?? "");
      if (!id) return bad("No board named.");
      // The foreign key cascades, so this takes its jobs with it. That is the
      // intent: a board removed on purpose should not leave orphans behind.
      const { error } = await db.from("job_sources").delete().eq("id", id);
      if (error) return bad(error.message, 500);
      revalidatePath("/admin/jobs");
      return Response.json({ ok: true });
    }

    default:
      return bad("Unknown action.");
  }
}

/** "Software engineer · Pune" -> "software-engineer-pune". */
function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || `query-${Date.now()}`
  );
}
