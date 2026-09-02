import { createAppServerClient, getSessionUser } from "@/lib/supabase/app";
import { parseResume, flatten } from "@/lib/app/parse-resume";
import { fillProfileFromResume } from "@/lib/app/autofill";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

type Body = {
  fileName?: string;
  fileType?: string;
  text?: string;
  atsScore?: number;
  atsResult?: unknown;
  /**
   * Make this the one the agent talks about.
   *
   * Set when a file is handed to the agent in conversation. Somebody who has
   * just dropped a document in front of it and asked "what do you think"
   * means *this* document — grounding the answer on a resume they uploaded
   * last month would be answering a question nobody asked.
   */
  primary?: boolean;
};

/**
 * Save a resume and read it.
 *
 * The file itself never arrives here. The browser already extracts the text —
 * that code exists, it works, and keeping the PDF on the client means a
 * document full of personal data is not sitting in server logs or storage
 * because it was convenient. Only the text crosses the wire.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return bad("Not signed in", 401);

  const supabase = await createAppServerClient();
  if (!supabase) return bad("Accounts aren't configured on this deployment.", 503);

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return bad("Could not read that request.");
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (text.trim().length < 120) {
    return bad(
      "Almost no text came out of that file. It is very likely an image or a scan — which is " +
        "exactly what an applicant tracking system sees too. Export a real PDF and try again.",
    );
  }

  // Written before parsing, so a model failure still leaves the person with a
  // saved resume and an ATS score rather than nothing at all.
  const { data: inserted, error: insertError } = await supabase
    .from("resumes")
    .insert({
      user_id: user.id,
      file_name: typeof body.fileName === "string" ? body.fileName.slice(0, 200) : null,
      file_type: typeof body.fileType === "string" ? body.fileType.slice(0, 20) : null,
      raw_text: text.slice(0, 60_000),
      ats_score: typeof body.atsScore === "number" ? Math.round(body.atsScore) : null,
      ats_result: body.atsResult ?? null,
    })
    .select("id")
    .limit(1);

  if (insertError) {
    return Response.json({ ok: false, error: insertError.message }, { status: 500 });
  }

  const id = (inserted ?? [])[0]?.id as string | undefined;
  if (!id) return bad("The resume did not save.", 500);

  // First resume becomes the primary one. A partial unique index guarantees
  // there is only ever one, so this is safe to attempt every time.
  const { count } = await supabase
    .from("resumes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) <= 1) {
    await supabase.from("resumes").update({ is_primary: true }).eq("id", id);
  } else if (body.primary) {
    // Clear first, then set. The unique index allows exactly one primary row
    // per person, so doing it the other way round fails on the constraint.
    await supabase.from("resumes").update({ is_primary: false }).eq("user_id", user.id);
    await supabase.from("resumes").update({ is_primary: true }).eq("id", id);
  }

  const parsed = await parseResume(text);

  if (!parsed.ok) {
    await supabase.from("resumes").update({ parse_error: parsed.error }).eq("id", id);
    return Response.json({ ok: true, id, parsed: null, parseError: parsed.error });
  }

  const flat = flatten(parsed.parsed);
  const { error: updateError } = await supabase
    .from("resumes")
    .update({
      parsed: parsed.parsed,
      parse_model: parsed.model,
      parsed_at: new Date().toISOString(),
      parse_error: null,
      ...flat,
    })
    .eq("id", id);

  if (updateError) {
    return Response.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  // The resume already contains most of the profile. Asking someone to retype
  // their own name and job title into a form, immediately after handing us a
  // document with both on it, is the kind of thing that makes people close the
  // tab. Only blank fields are filled — see the module for why that matters.
  const filled = await fillProfileFromResume(supabase, user.id, parsed.parsed);

  return Response.json({ ok: true, id, parsed: parsed.parsed, parseError: null, filled });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return bad("Not signed in", 401);

  const supabase = await createAppServerClient();
  if (!supabase) return bad("Accounts aren't configured.", 503);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return bad("No resume named.");

  // The RLS policy already restricts this to the owner's rows; the explicit
  // user_id is belt and braces, and makes the intent obvious when read.
  const { error } = await supabase.from("resumes").delete().eq("id", id).eq("user_id", user.id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
