import { createPublicClient } from "@/lib/supabase/public";

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

export async function POST(request: Request) {
  const supabase = createPublicClient();
  if (!supabase) return new Response(null, { status: 204 });

  let body: { path?: string; referrer?: string; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 204 });
  }

  const path = typeof body.path === "string" ? body.path.slice(0, 300) : null;
  if (!path || !path.startsWith("/")) return new Response(null, { status: 204 });

  // Never record admin traffic — it would drown out real numbers.
  if (path.startsWith("/admin")) return new Response(null, { status: 204 });

  let referrerHost: string | null = null;
  const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 500) : "";
  if (referrer) {
    try {
      referrerHost = new URL(referrer).hostname;
    } catch {
      /* malformed referrer — ignore */
    }
  }

  const ua = request.headers.get("user-agent") ?? "";
  const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop";

  // Vercel adds this at the edge; absent in local dev.
  const country = request.headers.get("x-vercel-ip-country");

  const src = sourceOf(referrerHost);
  if (src === "internal") {
    // Same-site navigation: still a page view, but not a traffic source.
    referrerHost = null;
  }

  await supabase.from("page_views").insert({
    path,
    referrer: referrer || null,
    referrer_host: referrerHost,
    source: src === "internal" ? "direct" : src,
    country: country || null,
    device,
    session_id: typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null,
  });

  return new Response(null, { status: 204 });
}
