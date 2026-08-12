import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * The ingest token can do exactly one thing: submit an article.
 * It is deliberately not the Supabase secret key — if it leaks, the blast
 * radius is a stray blog post, not the database.
 */
export function requireIngestSecret(request: Request): Response | null {
  const expected = process.env.INGEST_SECRET;
  if (!expected) {
    return Response.json(
      { ok: false, error: "INGEST_SECRET is not set on the server." },
      { status: 503 },
    );
  }

  const provided =
    request.headers.get("x-ingest-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && timingSafeEqual(a, b);

  if (!ok) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
