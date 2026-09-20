import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Human resume reviews: the request, and the queue.
 *
 * One open request per person at a time. Not a rate limit dressed up — it is
 * what the product actually promises. Somebody with four open requests is
 * four people waiting, and the second one is always "sorry, use this version
 * instead", which is an edit rather than a new review.
 */

export type ReviewRequest = {
  id: string;
  status: "open" | "done" | "cancelled";
  targetRole: string | null;
  note: string | null;
  createdAt: string;
  doneAt: string | null;
};

const MISSING = "87_resume_reviews.sql";

/** Their most recent request, so the screen can say where it stands. */
export async function getMyReview(userId: string): Promise<ReviewRequest | null> {
  const db = createAppAdminClient();
  if (!db) return null;

  const { data, error } = await db
    .from("resume_reviews")
    .select("id, status, target_role, note, created_at, done_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    status: (row.status as ReviewRequest["status"]) ?? "open",
    targetRole: (row.target_role as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
    doneAt: (row.done_at as string | null) ?? null,
  };
}

export async function requestReview(opts: {
  userId: string;
  email: string | null;
  fullName: string | null;
  resumeId: string | null;
  draftId: string | null;
  targetRole: string;
  note: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = createAppAdminClient();
  if (!db) return { ok: false, error: "Not configured." };

  const open = await db
    .from("resume_reviews")
    .select("id")
    .eq("user_id", opts.userId)
    .eq("status", "open")
    .maybeSingle();

  if (open.error && /does not exist/i.test(open.error.message)) {
    return { ok: false, error: `Reviews aren't set up yet — run supabase/schemas/${MISSING}.` };
  }
  if (open.data) {
    return { ok: false, error: "You already have a review in the queue. We'll email you about that one." };
  }

  const { data, error } = await db
    .from("resume_reviews")
    .insert({
      user_id: opts.userId,
      resume_id: opts.resumeId,
      draft_id: opts.draftId,
      target_role: opts.targetRole.slice(0, 120) || null,
      note: opts.note.slice(0, 1500) || null,
      email: opts.email,
      full_name: opts.fullName,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "Could not send that. Try again." };
  return { ok: true, id: (data as { id: string }).id };
}

/* ----------------------------------------------------------------- admin */

export type QueueItem = {
  id: string;
  status: string;
  email: string | null;
  fullName: string | null;
  targetRole: string | null;
  note: string | null;
  createdAt: string;
  doneAt: string | null;
  adminNote: string | null;
  /** A link to the design they built, when there is one to look at. */
  shareId: string | null;
  /** The uploaded document's plain text, for when there is no design. */
  rawText: string | null;
  fileName: string | null;
  atsScore: number | null;
};

export async function getReviewQueue(): Promise<
  { ok: true; data: QueueItem[] } | { ok: false; missing: string }
> {
  const db = createAdminClient();
  if (!db) return { ok: false, missing: MISSING };

  const { data, error } = await db
    .from("resume_reviews")
    .select(
      "id, status, email, full_name, target_role, note, created_at, done_at, admin_note, " +
        "resume_drafts(share_id), resumes(raw_text, file_name, ats_score)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return { ok: false, missing: MISSING };

  return {
    ok: true,
    data: ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
      const draft = r.resume_drafts as { share_id?: string | null } | null;
      const resume = r.resumes as
        | { raw_text?: string | null; file_name?: string | null; ats_score?: number | null }
        | null;

      return {
        id: String(r.id),
        status: String(r.status ?? "open"),
        email: (r.email as string | null) ?? null,
        fullName: (r.full_name as string | null) ?? null,
        targetRole: (r.target_role as string | null) ?? null,
        note: (r.note as string | null) ?? null,
        createdAt: String(r.created_at ?? ""),
        doneAt: (r.done_at as string | null) ?? null,
        adminNote: (r.admin_note as string | null) ?? null,
        shareId: draft?.share_id ?? null,
        rawText: resume?.raw_text ?? null,
        fileName: resume?.file_name ?? null,
        atsScore: resume?.ats_score ?? null,
      };
    }),
  };
}

export async function markReview(
  id: string,
  patch: { status?: string; adminNote?: string },
): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;

  const fields: Record<string, unknown> = {};
  if (patch.status) {
    fields.status = patch.status;
    fields.done_at = patch.status === "done" ? new Date().toISOString() : null;
  }
  if (patch.adminNote !== undefined) fields.admin_note = patch.adminNote.slice(0, 2000) || null;

  if (Object.keys(fields).length === 0) return true;

  const { error } = await db.from("resume_reviews").update(fields).eq("id", id);
  return !error;
}
