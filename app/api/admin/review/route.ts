import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Testimonials: write side.
 *
 * One route rather than four, because every call does the same two things
 * first — check the admin cookie and get a service-key client — and splitting
 * that across files is how one of them ends up missing a check.
 *
 * ------------------------------------------------------------------ order
 *
 * `position` is renormalised to 0, 10, 20 … on every write. The alternative
 * is clever: sparse keys, fractional indices, insert-between arithmetic. The
 * list is a handful of quotes on one landing page, so clever buys nothing and
 * costs a class of bug where two rows end up sharing a position and the order
 * quietly depends on which one Postgres feels like returning first.
 *
 * ---------------------------------------------------------------- deleting
 *
 * Delete is a real delete. A testimonial is somebody's name and words next to
 * our product — when we are asked to take it down, it should come off, not be
 * hidden behind a flag that a later query forgets to filter on.
 */

const MAX = { name: 80, role: 80, quote: 900, url: 600 };

const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

type Body = {
  action?: "save" | "move" | "publish" | "delete";
  id?: number;
  name?: string;
  role?: string;
  quote?: string;
  avatarUrl?: string | null;
  published?: boolean;
  direction?: "up" | "down";
};

function clean(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Rewrite every row's position to its index, so the order is never ambiguous. */
async function renumber(db: NonNullable<ReturnType<typeof createAdminClient>>) {
  const { data, error } = await db
    .from("reviews")
    .select("id")
    .order("position", { ascending: true })
    .order("id", { ascending: true });

  if (error || !data) return;

  await Promise.all(
    data.map((row, i) =>
      db.from("reviews").update({ position: i * 10 }).eq("id", (row as { id: number }).id),
    ),
  );
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const db = createAdminClient();
  if (!db) return bad("Supabase isn't configured on this deployment.", 503);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("Could not read that request.");
  }

  const action = body.action ?? "save";

  /* ------------------------------------------------------------------ save */

  if (action === "save") {
    const name = clean(body.name, MAX.name);
    const role = clean(body.role, MAX.role);
    const quote = clean(body.quote, MAX.quote);

    if (!name) return bad("A name is required.");
    if (!quote) return bad("The quote can't be empty.");

    const avatar = clean(body.avatarUrl, MAX.url);
    // Anything that is not an http(s) address or a path on this site is
    // dropped rather than stored — a javascript: or data: URL here would end
    // up in an <img src> on a page we serve.
    const avatar_url =
      avatar && (/^https?:\/\//i.test(avatar) || avatar.startsWith("/")) ? avatar : null;

    const fields = {
      name,
      role,
      quote,
      avatar_url,
      published: body.published === true,
      updated_at: new Date().toISOString(),
    };

    if (body.id) {
      const { error } = await db.from("reviews").update(fields).eq("id", body.id);
      if (error) return bad(`Could not save: ${error.message}`, 502);
      return Response.json({ ok: true, id: body.id });
    }

    // New rows go to the end. The admin can move it up straight after.
    const { data: last } = await db
      .from("reviews")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = ((last as { position: number | null } | null)?.position ?? -10) + 10;

    const { data, error } = await db
      .from("reviews")
      .insert({ ...fields, position })
      .select("id")
      .single();

    if (error) return bad(`Could not save: ${error.message}`, 502);
    return Response.json({ ok: true, id: (data as { id: number }).id });
  }

  /* --------------------------------------------------------------- publish */

  if (action === "publish") {
    if (!body.id) return bad("Which one?");
    const { error } = await db
      .from("reviews")
      .update({ published: body.published === true, updated_at: new Date().toISOString() })
      .eq("id", body.id);
    if (error) return bad(`Could not update: ${error.message}`, 502);
    return Response.json({ ok: true });
  }

  /* ------------------------------------------------------------------ move */

  if (action === "move") {
    if (!body.id) return bad("Which one?");
    await renumber(db);

    const { data, error } = await db
      .from("reviews")
      .select("id, position")
      .order("position", { ascending: true })
      .order("id", { ascending: true });

    if (error || !data) return bad("Could not read the current order.", 502);

    const rows = data as { id: number; position: number }[];
    const i = rows.findIndex((r) => r.id === body.id);
    if (i === -1) return bad("That review no longer exists.", 404);

    const j = body.direction === "up" ? i - 1 : i + 1;
    // Already at the end: not an error, just nothing to do.
    if (j < 0 || j >= rows.length) return Response.json({ ok: true });

    const a = rows[i];
    const b = rows[j];

    const [r1, r2] = await Promise.all([
      db.from("reviews").update({ position: b.position }).eq("id", a.id),
      db.from("reviews").update({ position: a.position }).eq("id", b.id),
    ]);

    if (r1.error || r2.error) return bad("Could not reorder.", 502);
    return Response.json({ ok: true });
  }

  /* ---------------------------------------------------------------- delete */

  if (action === "delete") {
    if (!body.id) return bad("Which one?");
    const { error } = await db.from("reviews").delete().eq("id", body.id);
    if (error) return bad(`Could not delete: ${error.message}`, 502);
    await renumber(db);
    return Response.json({ ok: true });
  }

  return bad("Unknown action.");
}
