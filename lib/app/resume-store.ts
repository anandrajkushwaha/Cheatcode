import "server-only";
import { createAppAdminClient, createAppServerClient } from "@/lib/supabase/app";
import { getPrimaryResume, getProfile, type ResumeDraft } from "@/lib/app/account";
import { cleanResume, emptyResume, resumeIsEmpty, type Resume } from "@/lib/app/resume-schema";
import { scoreDraft, seedFromResume } from "@/lib/app/resume-draft";
import { templateById } from "@/lib/app/resume-templates";
import { cleanPresentation } from "@/lib/app/resume-style";
import { cleanDesign } from "@/lib/app/design";

/**
 * The one write path to somebody's resume.
 *
 * Everything that changes a resume comes through here: the builder saving an
 * edit, the agent hearing something in a call, a form being submitted, a model
 * proposing a rewrite. Before this module the draft route owned all of it and
 * the agent owned none of it, which is why a person could describe their whole
 * career out loud and have none of it survive the call.
 *
 * The primary draft *is* the resume profile. `resumes.parsed` remains a record
 * of a file somebody uploaded — never edited, so its score stays honest — and
 * the draft is the living document seeded from it.
 */

const COLUMNS =
  "id,user_id,source_resume_id,title,content,ats_score,ats_result,template,styles,photo,design,share_id,is_public,link_role,is_primary,created_at,updated_at";

/** A deployment where 50_resume_drafts.sql has not been run yet. */
export function isMissingTable(message?: string): boolean {
  return Boolean(message && /relation .*resume_drafts.* does not exist|schema cache/i.test(message));
}

/**
 * A deployment with the table but not the template column.
 *
 * Worth telling apart from a missing table, because the two need different
 * SQL run and "the builder isn't set up" sends somebody to the wrong file.
 * This is the specific cost of selecting named columns rather than `*`: a
 * column added in a later migration breaks every read until it is run. The
 * trade is worth it — `*` would mean a column added for something else
 * silently arriving in the agent's view of a resume — but only if the failure
 * says exactly what to do, which is what this is for.
 */
export function isMissingTemplateColumn(message?: string): boolean {
  return Boolean(message && /column .*template.* does not exist/i.test(message));
}

/**
 * Which file to run, for each column a later migration added.
 *
 * Ordered longest-lived first so the message names the earliest thing missing
 * — somebody who has run none of these should be told to start at 51, not at
 * 54. The names are matched against Postgres's own error text, which is why
 * they are bare column names rather than anything qualified.
 */
const ADDED_COLUMNS: [column: string, file: string][] = [
  ["template", "51_resume_template.sql"],
  ["share_id", "52_resume_share.sql"],
  ["is_public", "52_resume_share.sql"],
  ["styles", "53_resume_style.sql"],
  ["photo", "53_resume_style.sql"],
  ["link_role", "54_resume_access.sql"],
  ["design", "55_resume_design.sql"],
];

/** The one sentence for either, so the two read paths cannot drift. */
function setupProblem(message?: string): StoreError | null {
  for (const [column, file] of ADDED_COLUMNS) {
    if (new RegExp(`column .*\\b${column}\\b.* does not exist`, "i").test(message ?? "")) {
      return new StoreError(
        `This deployment is missing a database change — run supabase/schemas/${file}.`,
        503,
      );
    }
  }
  if (isMissingTable(message)) {
    return new StoreError(
      "The resume builder isn't set up on this deployment yet — run supabase/schemas/50_resume_drafts.sql.",
      503,
    );
  }
  return null;
}

export class StoreError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
  }
}

async function client() {
  const supabase = await createAppServerClient();
  if (!supabase) throw new StoreError("Accounts aren't configured on this deployment.", 503);
  return supabase;
}

function normalise(row: unknown): ResumeDraft {
  const draft = row as ResumeDraft;
  return {
    ...draft,
    content: cleanResume(draft.content),
    // Same gate as the content, for the same reason: everything in this blob
    // came from a browser at some point.
    styles: cleanPresentation(draft.styles),
    // Anything that is not exactly 'edit' is a view link. A null from an old
    // row, a typo, a value somebody put in the table by hand — all of them
    // land on the safe side rather than on the side that lets strangers write.
    link_role: draft.link_role === "edit" ? "edit" : "view",
    // Null stays null — it is how "never converted" is told apart from "a
    // design somebody emptied", and the seeder must not refill the second.
    design: draft.design == null ? null : cleanDesign(draft.design),
  };
}

export type Role = "view" | "edit";

/** One person the owner named, and what they were given. */
export type Collaborator = { id: string; email: string; role: Role };

/** Anything that is not exactly 'edit' is 'view'. Never the other way round. */
function asRole(value: unknown): Role {
  return value === "edit" ? "edit" : "view";
}

/**
 * The one place an address is made comparable.
 *
 * Lower-cased and trimmed, because `Anand@…` and `anand@…` are the same inbox
 * and a person who was invited under one spelling and signs in under the other
 * would otherwise be locked out of a resume they were deliberately given. The
 * unique index in 54_resume_access.sql lower-cases the same way, so the two
 * cannot disagree.
 */
function normaliseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  // Deliberately loose. This is a grant, not a delivery — a typo costs the
  // owner a wasted row, and a strict pattern costs somebody with an unusual
  // but valid address their access.
  if (email.length < 3 || email.length > 320 || !email.includes("@") || /\s/.test(email)) return null;
  return email;
}

/* ------------------------------------------------------------------ read */

export async function getDraft(): Promise<ResumeDraft | null> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("resume_drafts")
    .select(COLUMNS)
    .order("is_primary", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    const setup = setupProblem(error.message);
    if (setup) throw setup;
    throw new StoreError(error.message);
  }

  const row = (data ?? [])[0];
  return row ? normalise(row) : null;
}

/* ---------------------------------------------------------------- create */

/**
 * The draft they are working on, making one if there isn't one.
 *
 * This is what makes a conversation with no uploaded resume work at all. The
 * old draft route refused to create anything from nothing, which was right for
 * a button somebody presses on the builder page and wrong for an agent being
 * told "I'm a final-year student" — there has to be somewhere to put that
 * sentence before the resume exists.
 *
 * So an empty draft is a legitimate thing to create. It seeds from an uploaded
 * resume and the profile when either has anything, and is otherwise blank and
 * waiting.
 */
export async function getOrCreateDraft(userId: string): Promise<ResumeDraft> {
  const existing = await getDraft();
  if (existing) return existing;

  const supabase = await client();
  const [resume, profile] = await Promise.all([getPrimaryResume(), getProfile()]);

  const content = resume || profile ? seedFromResume(resume, profile) : emptyResume();
  const result = scoreDraft(content);

  // Clear first, then insert: the partial unique index allows exactly one
  // primary row per person, and the other order fails on the constraint.
  await supabase.from("resume_drafts").update({ is_primary: false }).eq("user_id", userId);

  const { data, error } = await supabase
    .from("resume_drafts")
    .insert({
      user_id: userId,
      source_resume_id: resume?.id ?? null,
      title: content.full_name ? `${content.full_name} — resume` : "My resume",
      content,
      ats_score: result.score,
      ats_result: result,
      is_primary: true,
    })
    .select(COLUMNS)
    .limit(1);

  if (error) {
    const setup = setupProblem(error.message);
    if (setup) throw setup;
    throw new StoreError(error.message);
  }

  const row = (data ?? [])[0];
  if (!row) throw new StoreError("The draft did not save.");
  return normalise(row);
}

/**
 * Start a new resume in a chosen template.
 *
 * A template is a document, not a skin. Picking one used to re-paint the
 * single draft, which meant trying a second template destroyed the first —
 * fine while there were five variations of one layout, wrong now that they are
 * genuinely different documents somebody might want to keep side by side, one
 * per kind of job they are applying for.
 *
 * The content is copied from whatever they already have, so a new template
 * arrives filled in rather than blank. The copy is a copy: editing the new one
 * leaves the old one alone, which is the whole point of having both.
 *
 * The new draft becomes primary, because somebody who just chose a template is
 * about to edit that one.
 */
export async function createFromTemplate(userId: string, template: string): Promise<ResumeDraft> {
  const supabase = await client();

  // Whatever they have, in order of preference: the draft they were last
  // working on, then the uploaded resume, then nothing.
  const existing = await getDraft();
  const [resume, profile] = await Promise.all([getPrimaryResume(), getProfile()]);
  const content =
    existing?.content && !resumeIsEmpty(existing.content)
      ? existing.content
      : resume || profile
        ? seedFromResume(resume, profile)
        : emptyResume();

  // Scored in the template it will be rendered in, because a sidebar and a
  // plain column are not worth the same number.
  const result = scoreDraft(content, template);
  const name = templateById(template).name;

  await supabase.from("resume_drafts").update({ is_primary: false }).eq("user_id", userId);

  const { data, error } = await supabase
    .from("resume_drafts")
    .insert({
      user_id: userId,
      source_resume_id: resume?.id ?? null,
      // Named after the template, because a list of five rows all called
      // "My resume" is a list nobody can use.
      title: name,
      content,
      template,
      ats_score: result.score,
      ats_result: result,
      is_primary: true,
    })
    .select(COLUMNS)
    .limit(1);

  if (error) {
    const setup = setupProblem(error.message);
    if (setup) throw setup;
    throw new StoreError(error.message);
  }

  const row = (data ?? [])[0];
  if (!row) throw new StoreError("The resume did not save.");
  return normalise(row);
}

/**
 * Turn the public link on or off.
 *
 * The id is minted once and kept forever. Rotating it on every toggle would
 * look tidier and would quietly break a link somebody had already emailed to
 * an employer — switching sharing off and on again has to give back the same
 * URL, or "off" becomes a destructive act nobody was warned about.
 *
 * Sixteen bytes of `crypto.randomUUID()` without its dashes: unguessable, and
 * short enough to read out over a phone if it comes to that.
 */
export async function setSharing(
  userId: string,
  draftId: string,
  on: boolean,
  linkRole?: Role,
): Promise<ResumeDraft> {
  const supabase = await client();
  const current = await getDraftById(draftId);
  if (!current) throw new StoreError("That resume doesn't exist.", 404);

  const share_id = current.share_id ?? crypto.randomUUID().replace(/-/g, "");

  const { data, error } = await supabase
    .from("resume_drafts")
    .update({ share_id, is_public: on, link_role: linkRole ?? current.link_role })
    .eq("id", draftId)
    .eq("user_id", userId)
    .select(COLUMNS)
    .limit(1);

  if (error) {
    const setup = setupProblem(error.message);
    if (setup) throw setup;
    throw new StoreError(error.message);
  }

  const row = (data ?? [])[0];
  if (!row) throw new StoreError("That resume doesn't exist.", 404);
  return normalise(row);
}

/**
 * A shared resume, by its public id.
 *
 * The service key, deliberately: there is no session on a public page, so RLS
 * has nobody to check against. `is_public` is therefore the only thing
 * standing between a draft and the open internet, which is why it is in the
 * query rather than in a caller's `if`.
 */
export type Shared = {
  draftId: string;
  ownerId: string;
  content: Resume;
  template: string;
  title: string;
  styles: ReturnType<typeof cleanPresentation>;
  photo: string | null;
  /** The document. Null on rows written before the canvas editor. */
  design: ReturnType<typeof cleanDesign> | null;
  /** Whether the person asking may change it, and why they may. */
  canEdit: boolean;
  /** 'link' when the link itself grants it, 'invite' when they were named. */
  grantedBy: "link" | "invite" | null;
  /**
   * What the link grants anybody signed in. Needed even for a signed-out
   * visitor, so the page can offer "sign in to edit" rather than showing a
   * read-only copy to somebody who was, in fact, given a pen.
   */
  linkRole: Role;
};

export async function getShared(shareId: string, viewerEmail?: string | null): Promise<Shared | null> {
  const supabase = createAppAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("resume_drafts")
    .select("id,user_id,content,template,title,styles,photo,design,is_public,link_role")
    .eq("share_id", shareId)
    .eq("is_public", true)
    .limit(1);

  if (error) return null;
  const row = (data ?? [])[0] as
    | {
        id: string;
        user_id: string;
        content: unknown;
        template: string | null;
        title: string | null;
        styles: unknown;
        photo: string | null;
        design: unknown;
        link_role: string | null;
      }
    | undefined;
  if (!row) return null;

  /**
   * Two different ways to have been given a pen, checked in this order.
   *
   * A named invite outranks the link because it is the more specific grant and
   * because it survives the link being switched off. Both require a session:
   * `viewerEmail` is read from the signed-in user server-side, never from
   * anything the browser sent, so "can edit" is never something a visitor can
   * claim about themselves.
   */
  const email = normaliseEmail(viewerEmail);
  let grantedBy: Shared["grantedBy"] = null;

  if (email) {
    const invite = await supabase
      .from("resume_collaborators")
      .select("role")
      .eq("draft_id", row.id)
      .eq("email", email)
      .limit(1);
    if (asRole((invite.data ?? [])[0]?.role) === "edit") grantedBy = "invite";
    else if (asRole(row.link_role) === "edit") grantedBy = "link";
  }

  return {
    draftId: row.id,
    ownerId: row.user_id,
    content: cleanResume(row.content),
    template: row.template ?? "",
    title: row.title ?? "Resume",
    styles: cleanPresentation(row.styles),
    photo: row.photo ?? null,
    design: row.design == null ? null : cleanDesign(row.design),
    canEdit: grantedBy !== null,
    grantedBy,
    linkRole: asRole(row.link_role),
  };
}

/* ------------------------------------------------------- who else can see */

/** The guest list for one resume. Owner only — RLS enforces that, not this. */
export async function listCollaborators(draftId: string): Promise<Collaborator[]> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("resume_collaborators")
    .select("id,email,role")
    .eq("draft_id", draftId)
    .order("created_at", { ascending: true })
    .limit(50);

  // A deployment that has not run 54 yet has no guest list, which is not the
  // same as a broken page: sharing by link still works, so the dialog opens
  // with an empty list rather than an error.
  if (error) return [];
  return (data ?? []).map((r) => {
    const row = r as { id: string; email: string; role: string };
    return { id: row.id, email: row.email, role: asRole(row.role) };
  });
}

/**
 * Invite one person, or change what an already-invited person may do.
 *
 * Upsert on (draft_id, email) rather than insert: inviting somebody twice is a
 * thing people do, and the second invite should quietly become "actually, make
 * them an editor" instead of a unique-violation error message.
 *
 * No email is sent from here. That is not an oversight — a resume link landing
 * in somebody's inbox unannounced from a service they have never heard of is
 * indistinguishable from spam, and the owner is about to paste the link into a
 * conversation they are already having.
 */
export async function addCollaborator(
  userId: string,
  draftId: string,
  rawEmail: string,
  role: Role,
): Promise<Collaborator[]> {
  const email = normaliseEmail(rawEmail);
  if (!email) throw new StoreError("That doesn't look like an email address.", 400);

  const owner = await getDraftById(draftId);
  if (!owner || owner.user_id !== userId) throw new StoreError("That resume doesn't exist.", 404);

  const supabase = await client();
  const { error } = await supabase
    .from("resume_collaborators")
    .upsert(
      { draft_id: draftId, owner_id: userId, email, role: asRole(role) },
      { onConflict: "draft_id,email" },
    );

  if (error) {
    if (/relation .*resume_collaborators.* does not exist|schema cache/i.test(error.message)) {
      throw new StoreError(
        "This deployment is missing a database change — run supabase/schemas/54_resume_access.sql.",
        503,
      );
    }
    throw new StoreError(error.message);
  }

  return listCollaborators(draftId);
}

/**
 * Resumes somebody else invited me to, for the list on /app/resume.
 *
 * The service key again, and for the same reason as the public route: these
 * rows belong to other people, so RLS would — correctly — return nothing. The
 * safety is that the query starts from `email = my signed-in address`, which
 * the caller reads from the session and never from a request body.
 *
 * Only what a list needs is selected. A resume the viewer has not opened yet
 * has no business having its phone number and employment history loaded into
 * a page that is going to show a title and a date.
 */
export async function listSharedWithMe(
  viewerEmail: string | null,
): Promise<{ shareId: string; title: string; role: Role; updatedAt: string }[]> {
  const email = normaliseEmail(viewerEmail);
  if (!email) return [];

  const supabase = createAppAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("resume_collaborators")
    .select("role,resume_drafts(share_id,title,is_public,updated_at)")
    .eq("email", email)
    .limit(50);

  if (error) return [];

  type Joined = {
    share_id: string | null;
    title: string | null;
    is_public: boolean;
    updated_at: string;
  };

  return (data ?? [])
    .map((r) => {
      // PostgREST hands an embedded row back as an object or a one-element
      // array depending on how it reads the relationship; both spellings mean
      // the same single draft, so both are flattened here rather than at four
      // call sites downstream.
      const row = r as unknown as { role: string; resume_drafts: Joined | Joined[] | null };
      const draft = Array.isArray(row.resume_drafts) ? (row.resume_drafts[0] ?? null) : row.resume_drafts;
      return { role: asRole(row.role), draft };
    })
    // An invite to a resume whose owner has since switched sharing off is not
    // an access this list should still be advertising.
    .filter((r) => r.draft?.share_id && r.draft.is_public)
    .map((r) => ({
      shareId: r.draft!.share_id as string,
      title: r.draft!.title ?? "Resume",
      role: r.role,
      updatedAt: r.draft!.updated_at,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Take it back from one person, without disturbing anybody else's access. */
export async function removeCollaborator(
  userId: string,
  draftId: string,
  id: string,
): Promise<Collaborator[]> {
  const supabase = await client();
  const { error } = await supabase
    .from("resume_collaborators")
    .delete()
    .eq("id", id)
    .eq("draft_id", draftId)
    .eq("owner_id", userId);

  if (error) throw new StoreError(error.message);
  return listCollaborators(draftId);
}

/**
 * A save arriving from somebody who is not the owner.
 *
 * The whole check happens here rather than in the route, because it is the
 * kind of check that must not be possible to forget: the share id is looked
 * up, the signed-in email is compared against the grant, and only then does
 * anything get written — with the service key, since RLS would otherwise
 * refuse a write to a row the writer does not own.
 *
 * The score is recomputed on the owner's behalf. A collaborator changing the
 * words and leaving yesterday's number attached would be worse than no
 * collaboration at all: the owner would send out a resume whose score no
 * longer describes it.
 */
export async function saveShared(
  shareId: string,
  viewerEmail: string | null,
  content: Resume,
  extra: { styles?: unknown; photo?: string | null; design?: unknown } = {},
): Promise<void> {
  const shared = await getShared(shareId, viewerEmail);
  if (!shared) throw new StoreError("That resume doesn't exist.", 404);
  if (!shared.canEdit) throw new StoreError("You have view access to this resume.", 403);

  const supabase = createAppAdminClient();
  if (!supabase) throw new StoreError("Accounts aren't configured on this deployment.", 503);

  const result = scoreDraft(content, shared.template);
  const patch: Record<string, unknown> = {
    content,
    ats_score: result.score,
    ats_result: result,
  };
  if (extra.styles !== undefined) patch.styles = cleanPresentation(extra.styles);
  if (extra.photo !== undefined) patch.photo = extra.photo;
  if (extra.design !== undefined) patch.design = cleanDesign(extra.design);

  const { error } = await supabase.from("resume_drafts").update(patch).eq("id", shared.draftId);
  if (error) throw new StoreError(error.message);
}

/** Every resume they have, newest first, for the list on the resume page. */
export async function listDrafts(): Promise<ResumeDraft[]> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("resume_drafts")
    .select(COLUMNS)
    .order("is_primary", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    const setup = setupProblem(error.message);
    if (setup) throw setup;
    throw new StoreError(error.message);
  }
  return (data ?? []).map(normalise);
}

/** Throw away the edits and copy the uploaded resume again. */
export async function reseedDraft(userId: string): Promise<ResumeDraft> {
  const current = await getDraft();
  if (!current) return getOrCreateDraft(userId);

  const [resume, profile] = await Promise.all([getPrimaryResume(), getProfile()]);
  return save(userId, current.id, seedFromResume(resume, profile), {
    source_resume_id: resume?.id ?? null,
  });
}

/* ----------------------------------------------------------------- write */

/**
 * A change to one or more sections.
 *
 * Replace-by-key rather than a deep merge, and that is a deliberate contract:
 * whoever sends `skills` sends the whole list. A merge would need rules for
 * matching an existing role against an incoming one — by title? by company and
 * dates? — and every one of those rules is wrong for somebody. The caller has
 * just read the object, so sending a section back whole costs it nothing and
 * removes all the ambiguity.
 */
export type ResumePatch = Partial<Resume>;

/**
 * The one thing replace-by-key can do that a person would never intend.
 *
 * A model that sends `{"roles": []}` — because it lost track, or read the
 * question as being about something else — would erase somebody's whole work
 * history mid-sentence, and they would find out when the preview went blank.
 * Emptying a list that had things in it now requires saying so explicitly.
 */
export class ClearRefused extends Error {
  constructor(readonly sections: string[]) {
    super(
      `Refusing to empty ${sections.join(" and ")}. Send confirmClear if that is really intended.`,
    );
  }
}

const LISTS = ["skills", "roles", "education", "projects", "certifications", "achievements"] as const;

export async function patchDraft(
  userId: string,
  patch: ResumePatch,
  options: { confirmClear?: boolean } = {},
): Promise<ResumeDraft> {
  const draft = await getOrCreateDraft(userId);

  const cleared = LISTS.filter((key) => {
    const incoming = patch[key];
    return Array.isArray(incoming) && incoming.length === 0 && (draft.content[key]?.length ?? 0) > 0;
  });

  if (cleared.length && !options.confirmClear) throw new ClearRefused(cleared);

  // Undefined means "not mentioned", which is different from null meaning
  // "deliberately blank" — so the spread has to drop undefined keys rather
  // than letting them overwrite.
  const merged: Record<string, unknown> = { ...draft.content };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) merged[key] = value;
  }

  return save(userId, draft.id, cleanResume(merged));
}

/** One row by id, for the places that need to know its template before writing. */
/**
 * One draft, by id.
 *
 * RLS already restricts this to the caller's own rows, so `userId` is not what
 * makes it safe — it is there for the callers that want to be able to say so
 * at the call site, and it costs nothing. Exported because the PDF route needs
 * exactly this and should not be given a wider door.
 */
export async function getDraftById(draftId: string, userId?: string): Promise<ResumeDraft | null> {
  const supabase = await client();
  let q = supabase.from("resume_drafts").select(COLUMNS).eq("id", draftId);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q.limit(1);
  const row = (data ?? [])[0];
  return row ? normalise(row) : null;
}

/** Write content and its score together, so the two can never disagree. */
export async function save(
  userId: string,
  draftId: string,
  content: Resume,
  extra: Record<string, unknown> = {},
): Promise<ResumeDraft> {
  const supabase = await client();

  /**
   * Score it in the template it is about to be in.
   *
   * `extra.template` is the one being saved right now; without it a save that
   * changes the template would store the new layout beside the old layout's
   * number. Falling back to the stored row keeps an ordinary content save
   * scoring against whatever template it is already in.
   */
  const template =
    typeof extra.template === "string" ? extra.template : ((await getDraftById(draftId))?.template ?? null);
  const result = scoreDraft(content, template);

  const { data, error } = await supabase
    .from("resume_drafts")
    .update({ content, ats_score: result.score, ats_result: result, ...extra })
    .eq("id", draftId)
    // RLS already restricts this to their own rows; the explicit user_id makes
    // that obvious when read, and costs nothing.
    .eq("user_id", userId)
    .select(COLUMNS)
    .limit(1);

  if (error) throw new StoreError(error.message);

  const row = (data ?? [])[0];
  if (!row) throw new StoreError("That draft doesn't exist.", 404);
  return normalise(row);
}

/* ---------------------------------------------------------------- absorb */

/** Flat lists of strings, where merging two sets is unambiguous. */
const SETS = ["skills", "certifications", "achievements"] as const;

/** Structured rows, where merging risks duplicating what somebody already said. */
const ROWS = ["roles", "education", "projects", "links"] as const;

const SCALARS = [
  "full_name",
  "email",
  "phone",
  "location",
  "headline",
  "summary",
  "target_role",
  "years_experience",
] as const;

export type Absorbed = {
  content: Resume;
  /** Sections the upload filled in, because the draft had nothing there. */
  added: string[];
  /** Sections the draft already had, left exactly as they were. */
  kept: string[];
};

/**
 * Fold an uploaded resume into the one being built, without losing a word.
 *
 * The hole this closes: somebody talks to the agent, a draft is created from
 * that conversation, and then they upload their old resume. Seeding only
 * happens when a draft is first created, so the file went into `resumes` and
 * never reached the document they were building — the upload silently did
 * nothing, which is the worst kind of nothing.
 *
 * The merge is conservative on purpose, and the rule is: **nothing a person
 * said is ever overwritten by a file.** They were talking to us a minute ago
 * and the file is from last year.
 *
 * So a blank field takes the upload's value. A flat list of strings — skills,
 * certifications, achievements — is unioned, because a set has no order to
 * disturb and `cleanResume` deduplicates it anyway. A list of structured rows
 * that already has anything in it is left completely alone: appending three
 * jobs from a file to one job somebody just described produces a resume with
 * the same job listed twice, and there is no reliable way to tell which two
 * rows are the same job. That case is reported instead of guessed at, so the
 * person can be asked.
 */
export function absorb(draft: Resume, incoming: Resume): Absorbed {
  const content = { ...draft };
  const added: string[] = [];
  const kept: string[] = [];

  for (const key of SCALARS) {
    const mine = draft[key];
    const theirs = incoming[key];
    if ((mine === null || mine === undefined || mine === "") && theirs !== null && theirs !== undefined) {
      // @ts-expect-error the two sides are the same key of the same type
      content[key] = theirs;
      added.push(key);
    }
  }

  for (const key of SETS) {
    const theirs = incoming[key] ?? [];
    if (!theirs.length) continue;

    const mine = draft[key] ?? [];
    // Deduplicated here rather than left to cleanResume, because the answer
    // decides whether anything was added at all. Comparing raw lengths said
    // "added" every time somebody re-uploaded the same file, which meant a
    // pointless write and a moved `updated_at` for a document that had not
    // changed by a character.
    const seen = new Set(mine.map((v) => v.toLowerCase()));
    const merged = [...mine];
    for (const value of theirs) {
      const k = value.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(value);
    }

    if (merged.length > mine.length) {
      content[key] = merged;
      added.push(key);
    }
  }

  for (const key of ROWS) {
    const theirs = incoming[key] ?? [];
    if (!theirs.length) continue;
    if ((draft[key]?.length ?? 0) === 0) {
      // @ts-expect-error the two sides are the same key of the same type
      content[key] = theirs;
      added.push(key);
    } else {
      kept.push(key);
    }
  }

  return { content: cleanResume(content), added, kept };
}

/**
 * An upload, folded into whatever they are already building.
 *
 * Called after a file is parsed. Writes nothing when there was nothing to add,
 * so re-uploading the same document twice does not touch the row or move its
 * `updated_at`.
 */
export async function absorbUpload(
  userId: string,
  parsed: unknown,
  sourceResumeId?: string | null,
): Promise<Absorbed & { draft: ResumeDraft }> {
  const draft = await getOrCreateDraft(userId);
  const result = absorb(draft.content, cleanResume(parsed));

  if (!result.added.length) return { ...result, content: draft.content, draft };

  const saved = await save(userId, draft.id, result.content, {
    ...(sourceResumeId ? { source_resume_id: sourceResumeId } : {}),
  });
  return { ...result, draft: saved };
}
