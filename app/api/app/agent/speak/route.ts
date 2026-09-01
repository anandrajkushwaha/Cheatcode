import { getSessionUser } from "@/lib/supabase/app";
import { speak, MAX_CHARS } from "@/lib/app/tts";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Text in, audio out.
 *
 * Sits between the browser and the voice provider so the key stays here — and
 * which provider that is, is tts.ts's decision, not this route's. It is also
 * the only place that can say no: signed in, one request at a time, and a
 * hard cap on length — every character is billed, so an unbounded text field
 * pointed at this route is a bill someone else writes for us.
 *
 * The reply is mp3 bytes, not JSON. The client makes a Blob of it and plays
 * it; base64 in a JSON envelope would be a third larger for no reason.
 */

/**
 * One at a time per person.
 *
 * In-memory, so it only knows about this instance — which is enough for the
 * ordinary case, a held key or a loop, and the length cap covers the rest.
 */
const last = new Map<string, number>();
const MIN_GAP_MS = 700;

function tooSoon(userId: string): boolean {
  const now = Date.now();
  const prev = last.get(userId);
  if (prev && now - prev < MIN_GAP_MS) return true;
  last.set(userId, now);
  if (last.size > 5_000) {
    for (const [k, t] of last) if (now - t > 60_000) last.delete(k);
  }
  return false;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (tooSoon(user.id)) {
    return Response.json({ ok: false, error: "One at a time." }, { status: 429 });
  }

  let text = "";
  try {
    const body = (await request.json()) as { text?: unknown };
    if (typeof body.text === "string") text = body.text;
  } catch {
    return Response.json({ ok: false, error: "Could not read that." }, { status: 400 });
  }

  if (!text.trim()) return Response.json({ ok: false, error: "Nothing to say." }, { status: 400 });
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);

  const result = await speak(text);
  if (!result.ok) {
    // The client falls back to the browser's own voice on any failure, so this
    // is information rather than an emergency.
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }

  return new Response(result.audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(result.audio.byteLength),
      // Private: the greeting has a name in it.
      "Cache-Control": "private, max-age=3600",
      "X-Cache": result.cached ? "hit" : "miss",
    },
  });
}
