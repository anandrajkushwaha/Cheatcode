import { getSessionUser, createAppAdminClient } from "@/lib/supabase/app";
import { llmVision } from "@/lib/app/llm";
import { getAllowance } from "@/lib/app/allowance";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Type out what a picture of a resume says.
 *
 * The only path in this product where a document itself reaches the server,
 * and it exists because the alternative is worse. Everything with a text layer
 * is read in the browser and never uploaded; this is reached only when
 * somebody photographed their CV or scanned it, so there is no text to
 * extract and the choice is between looking at it and telling them no.
 *
 * Nothing is stored. The images pass through to the model and the text comes
 * back; what gets saved afterwards is the text, through the ordinary resume
 * route, exactly as if they had uploaded a PDF.
 *
 * It is also worth being honest that this is the expensive one. Hence: signed
 * in, four pages, a size cap, and one at a time per person.
 */

const MAX_IMAGES = 4;

/** ~12 MB of base64, which is about 9 MB of actual image. */
const MAX_CHARS = 12 * 1024 * 1024;

const INSTRUCTIONS = `You are transcribing a document image. Type out every word you can see,
in reading order, preserving line breaks and the order of sections.

Do not summarise. Do not comment. Do not add headings that are not there, and do not fix
spelling, grammar or dates — somebody is about to be given advice about this document and a
tidied-up version of it would be advice about a document that does not exist.

If a word is genuinely unreadable, write [?] in its place rather than guessing a plausible
one: a wrong company name or a wrong number is worse than a gap.

If the image is not a document — a photo of a person, a screenshot of something else — say
exactly: NOT_A_DOCUMENT`;

const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

/**
 * One at a time per person. In-memory, so it only knows about this instance,
 * which is enough for the ordinary case: a held button or a double drop.
 */
const last = new Map<string, number>();
const MIN_GAP_MS = 3_000;

function tooSoon(userId: string): boolean {
  const now = Date.now();
  const prev = last.get(userId);
  if (prev && now - prev < MIN_GAP_MS) return true;
  last.set(userId, now);
  if (last.size > 5_000) {
    for (const [k, t] of last) if (now - t > 120_000) last.delete(k);
  }
  return false;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return bad("Not signed in", 401);
  if (tooSoon(user.id)) return bad("One file at a time — give it a few seconds.", 429);

  let images: string[] = [];
  /**
   * Which conversation the file was handed over in.
   *
   * Reading a scan is the single most expensive call the product makes, and it
   * was the one call that recorded no conversation at all — so on the admin
   * screen it appeared as spend belonging to nobody's session. Verified below
   * before it is used: a client may send any id.
   */
  let conversationId: string | null = null;
  try {
    const body = (await request.json()) as { images?: unknown; conversationId?: unknown };
    if (typeof body.conversationId === "string" && body.conversationId) {
      conversationId = body.conversationId;
    }
    if (Array.isArray(body.images)) {
      images = body.images
        .filter((i): i is string => typeof i === "string" && i.startsWith("data:image/"))
        .slice(0, MAX_IMAGES);
    }
  } catch {
    return bad("Could not read that request.");
  }

  if (!images.length) return bad("No pages to read.");

  const total = images.reduce((a, i) => a + i.length, 0);
  if (total > MAX_CHARS) {
    return bad("Those pages are too large. Send fewer pages, or a smaller file.");
  }

  // The same gate as everything else that costs money. Reading a scan is a
  // model call with several images attached, which is the most expensive
  // single thing this product does.
  const allowance = await getAllowance(user.id, user.email);
  if (allowance.configured && allowance.messagesLeft <= 0) {
    return Response.json(
      {
        ok: false,
        error: allowance.paid
          ? "That's today's messages. They reset at midnight."
          : "Reading a scanned resume uses a message, and today's are gone.",
        upgrade: !allowance.paid,
      },
      { status: 402 },
    );
  }

  // Only if it is really theirs. Attributing one person's spend to another
  // person's conversation would be worse than leaving it unattributed.
  if (conversationId && !(await ownsConversation(user.id, conversationId))) {
    conversationId = null;
  }

  const result = await llmVision({
    meta: { feature: "document_read", userId: user.id, sessionId: conversationId },
    system: INSTRUCTIONS,
    text:
      images.length > 1
        ? `${images.length} pages of one document, in order. Transcribe all of them.`
        : "Transcribe this document.",
    images,
  });

  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 502 });

  const text = result.text.trim();

  if (/^NOT_A_DOCUMENT/.test(text)) {
    return bad("That doesn't look like a resume. Send the document itself and I'll read it.");
  }
  if (text.replace(/\s/g, "").length < 120) {
    return bad(
      "Almost nothing came off that image — it's probably too small or too blurry to read. " +
        "Try a straight-on photo in good light, or send the original file.",
    );
  }

  return Response.json({ ok: true, text: text.slice(0, 60_000) });
}

/** Does this conversation belong to this person? */
async function ownsConversation(userId: string, id: string): Promise<boolean> {
  const db = createAppAdminClient();
  if (!db) return false;
  try {
    const { data } = (await db
      .from("agent_conversations")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .limit(1)) as unknown as { data: { id: string }[] | null };
    return !!data?.[0];
  } catch {
    return false;
  }
}
