import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { OWNER_COOKIE, ownerCookieOptions } from "@/lib/analytics/owner";
import { SITE } from "@/lib/seo/constants";

export const dynamic = "force-dynamic";

/**
 * Mark this device as yours, from any browser, with no login.
 *
 *   /api/analytics/exclude?on=1   stop counting this device
 *   /api/analytics/exclude?on=0   start counting it again
 *
 * Open it on your phone, on a second laptop, in a browser you only use for
 * checking the live site. There is nothing to authenticate because the only
 * thing this can do is remove someone from our own statistics.
 */
export async function GET(request: Request) {
  const on = new URL(request.url).searchParams.get("on") !== "0";
  const store = await cookies();
  store.set(OWNER_COOKIE, on ? "1" : "", ownerCookieOptions(on));

  return new Response(page(on), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * Hide this browser's *past* activity too.
 *
 * The cookie only stops new rows. This adds the visitor id to an exclusion
 * list that every admin query filters against, so the weeks of your own
 * browsing already in the table disappear from the panel as well.
 *
 * Two ways to be allowed in. An admin session is one. The owner cookie is the
 * other, and it exists because the device that most needed this — a phone —
 * is the device you are least likely to be logged into the admin panel on.
 * The worst an unauthorised caller can do is hide their own traffic from our
 * statistics, which is not a threat worth locking the phone out for.
 */
export async function POST(request: Request) {
  const store = await cookies();
  const allowed =
    verifySessionToken(store.get(ADMIN_COOKIE)?.value) || store.get(OWNER_COOKIE)?.value === "1";
  if (!allowed) {
    return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  let body: { visitorId?: string; note?: string; remove?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const visitorId = typeof body.visitorId === "string" ? body.visitorId.slice(0, 64) : "";
  if (!visitorId) {
    return Response.json({ ok: false, error: "No visitor id." }, { status: 400 });
  }

  const db = createAdminClient();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured." }, { status: 503 });
  }

  if (body.remove) {
    const { error } = await db.from("analytics_excluded").delete().eq("visitor_id", visitorId);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    const { error } = await db
      .from("analytics_excluded")
      .upsert(
        { visitor_id: visitorId, note: body.note?.slice(0, 120) ?? "admin device" },
        { onConflict: "visitor_id" },
      );
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Keep the cookie in step with the database entry.
  store.set(OWNER_COOKIE, body.remove ? "" : "1", ownerCookieOptions(!body.remove));

  return Response.json({ ok: true, excluded: !body.remove });
}

function page(on: boolean) {
  const title = on ? "This device is no longer counted" : "This device is counted again";
  const body = on
    ? "Nothing you do on this browser will appear in the analytics — not in the admin panel, and not in Google Analytics. The setting lasts two years, or until you clear cookies."
    : "This browser now counts as a normal visitor again.";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} — Cheatcode</title>
<style>
  :root{color-scheme:light}
  body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#fff;color:#000;
       font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px}
  main{max-width:44ch}
  h1{font-size:1.6rem;letter-spacing:-.03em;margin:0 0 .75rem}
  p{color:#6e6e76;margin:0 0 1.5rem}
  a{display:inline-block;background:#000;color:#fff;text-decoration:none;
    border-radius:999px;padding:.7rem 1.4rem;font-size:.9rem}
  .alt{display:block;margin-top:1rem;background:none;color:#a1a1aa;padding:0;font-size:.82rem;
       text-decoration:underline;text-underline-offset:4px}
</style></head>
<body><main>
  <h1>${title}</h1>
  <p>${body}</p>
  <p id="past" style="font-size:.82rem"></p>
  <a href="${SITE.url}">Back to the site</a>
  <a class="alt" href="/api/analytics/exclude?on=${on ? "0" : "1"}">${
    on ? "Actually, count this device" : "Stop counting this device"
  }</a>
</main>
<script>
// The cookie stops new rows; this clears what this browser already logged.
// The id lives in localStorage, which the server cannot read, so the page
// has to hand it over. Without this step the weeks of your own browsing
// already in the table stay in the numbers forever.
(function () {
  var on = ${on ? "true" : "false"};
  var note = document.getElementById("past");
  try {
    var id = localStorage.getItem("cc_vid");
    if (!id) { note.textContent = "This browser had not been counted yet, so there is no history to remove."; return; }
    fetch("/api/analytics/exclude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: id, remove: !on, note: "self-excluded device" })
    }).then(function (r) { return r.json(); }).then(function (j) {
      note.textContent = j && j.ok
        ? (on ? "Everything this browser did before now has been removed from the numbers too."
              : "Its past activity is back in the numbers.")
        : "";
    }).catch(function () {});
  } catch (e) {}
})();
</script>
</body></html>`;
}
