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

/** OS from client hints when available, user agent otherwise. */
function osOf(request: Request, ua: string): string {
  const hint = request.headers.get("sec-ch-ua-platform")?.replace(/"/g, "").trim();
  if (hint && hint !== "Unknown") return hint === "macOS" ? "macOS" : hint;

  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/CrOS/i.test(ua)) return "Chrome OS";
  if (/Linux/i.test(ua)) return "Linux";
  return "unknown";
}

/** Order matters: several browsers include "Chrome" or "Safari" in their UA. */
function browserOf(ua: string): string {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
  if (/UCBrowser/i.test(ua)) return "UC Browser";
  if (/Firefox\/|FxiOS/i.test(ua)) return "Firefox";
  if (/CriOS/i.test(ua)) return "Chrome";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua)) return "Safari";
  return "unknown";
}

function deviceOf(request: Request, ua: string): string {
  if (/iPad/i.test(ua)) return "tablet";
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return "tablet";
  if (request.headers.get("sec-ch-ua-mobile") === "?1") return "mobile";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  return "desktop";
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
  visitorId?: string;
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
  const device = deviceOf(request, ua);
  const os = osOf(request, ua);
  const browser = browserOf(ua);

  const decode = (v: string | null) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v).slice(0, 80);
    } catch {
      return v.slice(0, 80);
    }
  };
  /**
   * The site sits behind Cloudflare, so Vercel's x-vercel-ip-* headers now
   * describe Cloudflare's edge rather than the visitor. Cloudflare's own
   * headers are the authoritative source here; the Vercel ones are kept as a
   * fallback so nothing breaks if the proxy is ever switched to DNS-only.
   *
   * cf-ipcountry ships by default. cf-ipcity and cf-region require the
   * "Add visitor location headers" managed transform to be turned on
   * (Cloudflare -> Rules -> Settings -> Managed Transforms) — free on all plans.
   */
  const geo = (...names: string[]) => {
    for (const name of names) {
      const v = request.headers.get(name);
      // XX = Cloudflare could not resolve the IP, T1 = Tor exit node.
      if (v && v !== "XX" && v !== "T1") return v;
    }
    return null;
  };

  const country = geo("cf-ipcountry", "x-vercel-ip-country");
  const city = decode(geo("cf-ipcity", "x-vercel-ip-city"));
  const region = decode(geo("cf-region", "x-vercel-ip-country-region"));
  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null;
  const visitorId =
    typeof body.visitorId === "string" ? body.visitorId.slice(0, 64) : null;

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
      visitor_id: visitorId,
      source,
      country: country || null,
      city,
      device,
      os,
      browser,
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
    os,
    browser,
    session_id: sessionId,
    visitor_id: visitorId,
    is_bot: isBot,
    bot_reason: reason,
  });

  return ok();
}
