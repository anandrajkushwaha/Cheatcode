import { getSessionUser } from "@/lib/supabase/app";
import { isServerTool, runTool } from "@/lib/app/agent-tools";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * The only door between the spoken agent and this application's data.
 *
 * A live call runs in the browser — the model talks to it directly over
 * WebRTC, because a serverless function cannot hold a connection open for the
 * length of a conversation. So when the model calls a tool, the browser is the
 * only thing that hears it, and the browser is not to be trusted with the
 * decision about what that means.
 *
 * What arrives here is therefore treated as a request from a stranger: a tool
 * name and a bag of arguments. The name is checked against a list, the
 * arguments are cleaned by the same schema everything else writes through, and
 * the work happens as the signed-in user with row-level security underneath.
 * The browser is a courier, not an authority.
 *
 * `show_jobs` is deliberately not runnable here. It is answered in the browser
 * from cards that were already sent down with the ticket, because a round trip
 * in the middle of somebody speaking is a pause they can hear.
 */

const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return bad("Not signed in", 401);

  let body: { name?: unknown; args?: unknown };
  try {
    body = (await request.json()) as { name?: unknown; args?: unknown };
  } catch {
    return bad("Could not read that request.");
  }

  const name = typeof body.name === "string" ? body.name : "";
  if (!isServerTool(name)) {
    // Not an error worth a 500: a model inventing a tool name is a thing that
    // happens, and the answer is a result it can read rather than a failure
    // that ends the call.
    return Response.json({
      ok: false,
      summary: `There is no tool called ${name || "(nothing)"}.`,
    });
  }

  const result = await runTool(name, body.args, { userId: user.id });
  return Response.json(result);
}
