import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedResume } from "@/lib/app/account";
import { matchCity } from "@/lib/geo/cities";

/**
 * Fill the profile from the resume that was just read.
 *
 * The rule, and the only rule that matters here: **never overwrite something
 * the person put there themselves.** A resume is a snapshot, often months
 * old, and someone who has already typed "Senior Product Designer" into their
 * profile because that is the job they want next must not have it silently
 * replaced by the title on a PDF from last year. So every field is written
 * only when it is currently empty.
 *
 * That also makes re-uploading safe. Upload a corrected resume and the fields
 * you have edited stay edited; the ones you never touched catch up.
 */

type Patch = Record<string, unknown>;

export type Filled = {
  fields: string[];
  /** True when this looked like the first upload on an untouched profile. */
  wasEmpty: boolean;
};

export async function fillProfileFromResume(
  supabase: SupabaseClient,
  userId: string,
  parsed: ParsedResume,
): Promise<Filled> {
  const { data: current } = await supabase
    .from("profiles")
    .select(
      "full_name,headline,current_title,current_company,years_experience," +
        "preferred_cities,target_roles,onboarded_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (!current) return { fields: [], wasEmpty: false };

  const profile = current as unknown as {
    full_name: string | null;
    headline: string | null;
    current_title: string | null;
    current_company: string | null;
    years_experience: number | null;
    preferred_cities: string[] | null;
    target_roles: string[] | null;
    onboarded_at: string | null;
  };

  const patch: Patch = {};
  const fields: string[] = [];

  const put = (key: string, value: unknown) => {
    patch[key] = value;
    fields.push(key);
  };

  // --- who they are -------------------------------------------------------
  if (isBlank(profile.full_name)) {
    const name = clean(parsed.full_name, 120);
    // A resume header sometimes holds a headline rather than a name. Two to
    // four words with no digits is the shape of a person's name.
    if (name && /^[\p{L}][\p{L}'.\- ]{1,80}$/u.test(name) && name.split(/\s+/).length <= 4) {
      put("full_name", name);
    }
  }

  if (isBlank(profile.headline)) {
    const headline = clean(parsed.headline, 140);
    if (headline) put("headline", headline);
  }

  // --- what they do now ---------------------------------------------------
  const current_role =
    (parsed.roles ?? []).find((r) => r?.is_current) ?? (parsed.roles ?? [])[0] ?? null;

  if (isBlank(profile.current_title)) {
    const title = clean(current_role?.title, 120);
    if (title) put("current_title", title);
  }
  if (isBlank(profile.current_company)) {
    const company = clean(current_role?.company, 120);
    if (company) put("current_company", company);
  }

  // --- how long -----------------------------------------------------------
  // Zero is a real answer here — a fresher — so the check is for null, not
  // for falsy. `!profile.years_experience` would re-fill every fresher's
  // profile on every upload.
  if (profile.years_experience === null || profile.years_experience === undefined) {
    const years = parsed.years_experience;
    if (typeof years === "number" && Number.isFinite(years) && years >= 0 && years <= 50) {
      put("years_experience", Math.round(years * 10) / 10);
    }
  }

  // --- where --------------------------------------------------------------
  if (!profile.preferred_cities?.length) {
    const city = parsed.location ? matchCity(parsed.location) : null;
    // One city, from where they already live. A guess about where somebody
    // would move is exactly the kind of guess that quietly hides jobs, so
    // this fills the obvious one and leaves the rest to them.
    if (city) put("preferred_cities", [city]);
  }

  // --- what they want next ------------------------------------------------
  // Their current title is the best available guess at the job they want, and
  // an empty target means matching has nothing to rank against at all. It is
  // a starting point, not a decision — the agent asks properly later.
  if (!profile.target_roles?.length) {
    const title = clean(current_role?.title, 120);
    if (title) put("target_roles", [title]);
  }

  if (fields.length === 0) return { fields: [], wasEmpty: false };

  if (!profile.onboarded_at) patch.onboarded_at = new Date().toISOString();

  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) return { fields: [], wasEmpty: false };

  return {
    fields,
    wasEmpty:
      isBlank(profile.full_name) &&
      isBlank(profile.current_title) &&
      !profile.target_roles?.length,
  };
}

/* ------------------------------------------------------------------ bits */

const isBlank = (v: string | null | undefined) => !v || !v.trim();

function clean(v: string | null | undefined, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, " ");
  if (!s || s.toLowerCase() === "null" || s.length < 2) return null;
  return s.slice(0, max);
}
