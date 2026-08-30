import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BUCKET = "post-media";
const MAX_BYTES = 8 * 1024 * 1024;

// Deliberately not a general image list: SVG can carry script, and this file
// is served from our own origin, so an SVG upload is a stored XSS.
const ALLOWED = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const bad = (error: string, status = 400, hint?: string) =>
  Response.json({ ok: false, error, hint }, { status });

export async function POST(request: Request) {
  const store = await cookies();
  if (!verifySessionToken(store.get(ADMIN_COOKIE)?.value)) return bad("Not signed in", 401);

  const db = createAdminClient();
  if (!db) return bad("Supabase isn't configured on this deployment.", 503);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("Could not read that upload.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return bad("No file arrived.");
  if (file.size === 0) return bad("That file is empty.");
  if (file.size > MAX_BYTES) {
    return bad(
      `That image is ${(file.size / 1048576).toFixed(1)}MB. Keep it under 8MB — anything ` +
        "larger will slow the article down for readers on mobile data.",
    );
  }

  const ext = ALLOWED.get(file.type);
  if (!ext) {
    return bad(
      `${file.type || "That file type"} isn't allowed. Use PNG, JPEG, WebP or GIF.`,
      400,
      file.type === "image/svg+xml"
        ? "SVG can contain scripts and would be served from your own domain, so it is blocked on purpose."
        : undefined,
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `${stamp}/${rand}.${ext}`;

  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });

  if (error) {
    const missing = /bucket/i.test(error.message) && /not found|does not exist/i.test(error.message);
    return Response.json(
      {
        ok: false,
        error: missing
          ? `The "${BUCKET}" storage bucket doesn't exist yet.`
          : `Upload failed: ${error.message}`,
        hint: missing
          ? "Run supabase/schemas/11_authoring.sql, or create a public bucket named post-media in " +
            "Supabase → Storage. Until then you can paste an image URL instead."
          : undefined,
      },
      { status: 502 },
    );
  }

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return Response.json({ ok: true, url: data.publicUrl, path });
}
