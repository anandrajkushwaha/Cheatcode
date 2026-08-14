import { cookies } from "next/headers";
import { createPublicClient } from "@/lib/supabase/public";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin/auth";
import { detectBot } from "@/lib/analytics/bot-server";

export const dynamic = "force-dynamic";

/** Map a referrer host to a readable source bucket. */
function sourceOf(host: string | null): string {
  if (!host) return "direct";
  const h = host.toLowerCase().replace(/^www\./, "");
  if (h.includes("google")) return "google";
  if (h.includes("bing")) return "bing";
  if (h.includes("duckduckgo")) return "duckduckgo";
  if (h.includes("linkedin") || h === "lnkd.in") return "linkedin";
  if (h.includes("instagram")) return "instagram";
  if (h.includes("facebook") || h === "fb.com") return "facebook";
  if (h.includes("x.com") || h.includes("twitter") || h === "t.co") return "x";
  if (h.includes("reddit")) return "reddit";
  if (h.includes("whatsapp") || h === "wa.me") return "whatsapp";
  if (h.includes("youtube")) return "youtube";
  if (h.includes("quora")) return "quora";
  if (h.includes("telegram") || h === "t.me") return "telegram";
  if (h.includes("cheatcodeapp.com")) return "internal";
  return h;
}

type Body = {
  kind?: "pageview" | "event";
  path?: string;
  event?: string;
  label?: string;
  location?: string;
  value?: number;
  params?: Record<string, unknown>;
  referrer?: string;
  sessionId?: string;
  botReason?: string | null;
};

const ok = () => new Response(null, { status: 204 });

export async function POST(request: Request) {
  const supabase = createPublicClient();
  if (!supabase) return ok();

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return ok();
  }

  const path = typeof body.path === "string" ? body.path.slice(0, 300) : null;
  if (!path || !path.startsWith("/")) return ok();

  // Admin pages are never part of site analytics.
  if (path.startsWith("/admin")) return ok();

  // Neither is your own browsing while signed in to the admin panel.
  const store = await cookies();
  if (verifySessionToken(store.get(ADMIN_COOKIE)?.value)) return ok();

  const { isBot, reason } = detectBot(request, body.botReason);

  // Referrer → source
  let referrerHost: string | null = null;
  const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 500) : "";
  if (referrer) {
    try {
      referrerHost = new URL(referrer).hostname;
    } catch {
      /* malformed referrer — ignore */
    }
  }
  const src = sourceOf(referrerHost);
  if (src === "internal") referrerHost = null;
  const source = src === "internal" ? "direct" : src;

  const ua = request.headers.get("user-agent") ?? "";
  const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop";

  const decode = (v: string | null) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v).slice(0, 80);
    } catch {
      return v.slice(0, 80);
    }
  };
  const country = request.headers.get("x-vercel-ip-country");
  const city = decode(request.headers.get("x-vercel-ip-city"));
  const region = decode(request.headers.get("x-vercel-ip-country-region"));
  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null;

  // ---------------------------------------------------------------- event
  if (body.kind === "event") {
    const event = typeof body.event === "string" ? body.event.slice(0, 64) : null;
    if (!event) return ok();

    await supabase.from("page_events").insert({
      event,
      path,
      label: typeof body.label === "string" ? body.label.slice(0, 200) : null,
      location: typeof body.location === "string" ? body.location.slice(0, 80) : null,
      value: typeof body.value === "number" && Number.isFinite(body.value) ? body.value : null,
      params: body.params && typeof body.params === "object" ? body.params : {},
      session_id: sessionId,
      source,
      country: country || null,
      city,
      device,
      is_bot: isBot,
      bot_reason: reason,
    });

    return ok();
  }

  // ---------------------------------------------------------------- page view
  await supabase.from("page_views").insert({
    path,
    referrer: referrer || null,
    referrer_host: referrerHost,
    source,
    country: country || null,
    city,
    region,
    device,
    session_id: sessionId,
    is_bot: isBot,
    bot_reason: reason,
  });

  return ok();
}
