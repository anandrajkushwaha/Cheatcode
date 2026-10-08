import { requireAdmin } from "@/lib/admin/guard";
import { adminDisplayName } from "@/lib/admin/who";
import { createAppAdminClient } from "@/lib/supabase/app";
import { refreshGovt } from "@/lib/govt/refresh";
import { insertTolerant } from "@/lib/govt/db-error";
import {
  FEE_CATEGORIES,
  GATED_FIELDS,
  ORGANISATION_TYPES,
  QUALIFICATIONS,
  STATES,
  makeSlug,
} from "@/lib/govt/types";

export const dynamic = "force-dynamic";

/**
 * The recruitment page behind the notices.
 *
 *   { action: "save",   id?, organisation, name, ... , status }
 *   { action: "status", id, status }
 *   { action: "delete", id }            owner only
 *
 * Two things here are not negotiable, and both are about the six gated
 * fields — last date, start date, fee, vacancies, age range.
 *
 * First, a gated field is stored only together with a note of where it came
 * from, written into `evidence`. The public page renders one of these values
 * only if its name is in that column, so a number typed with no source
 * recorded simply does not appear — which is the behaviour we want, because
 * the alternative is a page quietly asserting a last date nobody can check.
 *
 * Second, the slug is minted once and never recomputed. These URLs are the
 * entire SEO case for the feature; a slug that follows a tidied title is a
 * dead Google result and a 404 for everyone who bookmarked it.
 */

const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

type Body = {
  action?: string;
  id?: string;
  organisation?: string;
  organisationType?: string;
  name?: string;
  year?: number | string | null;
  qualificationLevels?: string[];
  qualificationText?: string;
  states?: string[];
  isAllIndia?: boolean;
  ageMin?: number | string | null;
  ageMax?: number | string | null;
  vacancies?: number | string | null;
  applicationStart?: string;
  applicationEnd?: string;
  applyUrl?: string;
  fee?: Record<string, number | string>;
  examDateFrom?: string;
  examDateTo?: string;
  dateNote?: string;
  selectionProcess?: string[];
  about?: string;
  /** The notification the gated numbers were read off. */
  evidenceUrl?: string;
  status?: string;
};

const STATUSES = new Set(["draft", "published", "closed", "withdrawn"]);
const LINK = /^https?:\/\/[^\s]+$/i;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

function dateProblem(iso: string, label: string): string | null {
  if (!ISO.test(iso)) return `${label} needs to be a real date.`;
  if (Number.isNaN(Date.parse(`${iso}T00:00:00Z`))) return `${label} does not exist as a date.`;
  const year = Number(iso.slice(0, 4));
  if (year < 2015 || year > 2040) return `${label} is outside the range this is for.`;
  return null;
}

export async function POST(request: Request) {
  const guard = await requireAdmin("govt");
  if (!guard.ok) return guard.response;
  const { session } = guard;

  const db = createAppAdminClient();
  if (!db) return bad("Supabase isn't configured on this deployment.", 503);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("Could not read that request.");
  }

  if (body.action === "status") {
    if (!body.id) return bad("Which recruitment?");
    if (!STATUSES.has(body.status ?? "")) return bad("Unknown status.");

    const { data, error } = await db
      .from("govt_exams")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", body.id)
      .select("slug")
      .maybeSingle();
    if (error) return bad(error.message, 500);

    refreshGovt((data as { slug: string } | null)?.slug ?? null);
    return Response.json({ ok: true });
  }

  if (body.action === "delete") {
    if (session.role !== "owner") {
      return bad("Only the owner can delete. Withdraw it instead — that takes it off the page.", 403);
    }
    if (!body.id) return bad("Which recruitment?");

    const { data } = await db.from("govt_exams").select("slug").eq("id", body.id).maybeSingle();

    // Notices outlive the recruitment they hung off: exam_id is ON DELETE SET
    // NULL, so they stay on their kind page with their official link intact
    // rather than vanishing along with it.
    const { error } = await db.from("govt_exams").delete().eq("id", body.id);
    if (error) return bad(error.message, 500);

    refreshGovt((data as { slug: string } | null)?.slug ?? null);
    return Response.json({ ok: true });
  }

  if (body.action !== "save") return bad("Unknown action.");

  // ----------------------------------------------------------- validate
  const organisation = (body.organisation ?? "").replace(/\s+/g, " ").trim();
  const name = (body.name ?? "").replace(/\s+/g, " ").trim();
  const organisationType = (body.organisationType ?? "state").trim();
  const year = num(body.year);
  const status = body.status ?? "draft";

  if (organisation.length < 2) return bad("Which organisation? SSC, BPSC, RRB, and so on.");
  if (organisation.length > 80) return bad("Keep the organisation short — the abbreviation is enough.");
  if (name.length < 4) return bad("Give the recruitment its own name, as the notification writes it.");
  if (name.length > 160) return bad("Keep the recruitment name under 160 characters.");
  if (!(ORGANISATION_TYPES as readonly string[]).includes(organisationType)) {
    return bad("Pick what kind of organisation this is.");
  }
  if (year !== null && (year < 2015 || year > 2040)) return bad("That year is outside the range this is for.");
  if (!STATUSES.has(status)) return bad("Unknown status.");

  const qualificationLevels = (body.qualificationLevels ?? []).filter((q) =>
    (QUALIFICATIONS as readonly string[]).includes(q),
  );
  const states = (body.states ?? []).filter((s) => (STATES as readonly string[]).includes(s));
  const selectionProcess = (body.selectionProcess ?? [])
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((s) => s.slice(0, 80));

  const applyUrl = (body.applyUrl ?? "").trim();
  if (applyUrl && !LINK.test(applyUrl)) return bad("The apply link must start with http:// or https://");

  const evidenceUrl = (body.evidenceUrl ?? "").trim();
  if (evidenceUrl && !LINK.test(evidenceUrl)) {
    return bad("The notification link must start with http:// or https://");
  }

  const dates: Record<string, string | null> = {};
  for (const [key, label] of [
    ["applicationStart", "The application start date"],
    ["applicationEnd", "The last date"],
    ["examDateFrom", "The exam date"],
    ["examDateTo", "The exam end date"],
  ] as const) {
    const raw = (body[key] ?? "").trim();
    if (!raw) {
      dates[key] = null;
      continue;
    }
    const problem = dateProblem(raw, label);
    if (problem) return bad(problem);
    dates[key] = raw;
  }
  if (dates.applicationStart && dates.applicationEnd && dates.applicationEnd < dates.applicationStart) {
    return bad("The last date is before the start date.");
  }

  const ageMin = num(body.ageMin);
  const ageMax = num(body.ageMax);
  if (ageMin !== null && (ageMin < 14 || ageMin > 60)) return bad("That minimum age does not look right.");
  if (ageMax !== null && (ageMax < 14 || ageMax > 70)) return bad("That maximum age does not look right.");
  if (ageMin !== null && ageMax !== null && ageMax < ageMin) return bad("The maximum age is below the minimum.");

  const vacancies = num(body.vacancies);
  if (vacancies !== null && (vacancies < 0 || vacancies > 1_000_000)) {
    return bad("That vacancy count does not look right.");
  }

  const fee: Record<string, number> = {};
  for (const [k, v] of Object.entries(body.fee ?? {})) {
    if (!(FEE_CATEGORIES as readonly string[]).includes(k)) continue;
    const n = num(v);
    if (n === null) continue;
    if (n < 0 || n > 100_000) return bad("One of those fees does not look right.");
    fee[k] = n;
  }
  const feeByCategory = Object.keys(fee).length ? fee : null;

  // -------------------------------------------------------- the evidence
  //
  // One link covers every gated field on the row, because in practice they
  // all come off the same PDF. Without it they are dropped rather than
  // stored-and-hidden: a column holding a last date the page refuses to show
  // is a trap for the next person to read this table.
  const gatedValues: Record<string, unknown> = {
    application_start: dates.applicationStart,
    application_end: dates.applicationEnd,
    fee_by_category: feeByCategory,
    vacancies,
    age_min: ageMin,
    age_max: ageMax,
  };
  const filled = GATED_FIELDS.filter((f) => gatedValues[f] !== null && gatedValues[f] !== undefined);
  if (filled.length > 0 && !evidenceUrl) {
    return bad(
      "Paste the link to the official notification. The last date, fee, vacancies and age limits " +
        "are only shown to readers when the page can say where they came from.",
    );
  }

  const who = await adminDisplayName(session);
  const at = new Date().toISOString();
  const evidence: Record<string, { by: string; at: string; url: string }> = {};
  for (const f of filled) evidence[f] = { by: who, at, url: evidenceUrl };

  const fields = {
    organisation,
    organisation_type: organisationType,
    name,
    year,
    qualification_levels: qualificationLevels,
    qualification_text: (body.qualificationText ?? "").trim() || null,
    states,
    is_all_india: Boolean(body.isAllIndia),
    age_min: ageMin,
    age_max: ageMax,
    vacancies,
    application_start: dates.applicationStart,
    application_end: dates.applicationEnd,
    apply_url: applyUrl || null,
    fee_by_category: feeByCategory,
    exam_date_from: dates.examDateFrom,
    exam_date_to: dates.examDateTo,
    date_note: (body.dateNote ?? "").replace(/\s+/g, " ").trim() || null,
    selection_process: selectionProcess,
    about: (body.about ?? "").trim() || null,
    evidence,
    status,
    updated_at: at,
  };

  if (body.id) {
    // The slug is not in `fields`, and that is the whole point: an edit may
    // fix a typo in the name, and the URL that Google has indexed must not
    // move because of it.
    const { data, error } = await db
      .from("govt_exams")
      .update(fields)
      .eq("id", body.id)
      .select("slug")
      .maybeSingle();
    if (error) return bad(friendly(error.message), 500);

    const slug = (data as { slug: string } | null)?.slug ?? null;
    refreshGovt(slug);
    return Response.json({ ok: true, id: body.id, slug });
  }

  const slug = await mintSlug(db, organisation, name, year);
  if (!slug) {
    return bad(
      "Could not make a web address from that organisation and name. Give the recruitment a " +
        "fuller name — 'Combined Graduate Level 2026' rather than 'CGL'.",
    );
  }

  const { data, error } = await insertTolerant<{ id: string; slug: string }>(
    (row) => db.from("govt_exams").insert(row).select("id, slug").single(),
    { ...fields, slug, posted_by: who },
  );
  if (error) return bad(friendly(error.message), 500);

  refreshGovt(data?.slug ?? slug);
  return Response.json({ ok: true, id: data?.id, slug: data?.slug ?? slug });
}

/**
 * A free address for this recruitment, or null.
 *
 * makeSlug refuses reserved words and organisation-only slugs; the loop here
 * handles the other collision — a board running the same recruitment two
 * years running, where the second row would otherwise fail on the unique
 * index with a message about constraints.
 */
async function mintSlug(
  db: NonNullable<ReturnType<typeof createAppAdminClient>>,
  organisation: string,
  name: string,
  year: number | null,
): Promise<string | null> {
  const base = makeSlug(organisation, name, year);
  if (!base) return null;

  for (let n = 1; n <= 20; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const { data } = await db.from("govt_exams").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return null;
}

function friendly(message: string): string {
  if (/duplicate|unique/i.test(message)) {
    return "A recruitment with that web address already exists. Open it from the list instead.";
  }
  if (/posted_by|column .* does not exist|schema cache/i.test(message)) {
    return "The tables are a version behind — run supabase/schemas/105_govt_manual_posting.sql.";
  }
  if (/violates check constraint/i.test(message)) {
    return "The database refused one of those values. Check the organisation type and the status.";
  }
  return message;
}
