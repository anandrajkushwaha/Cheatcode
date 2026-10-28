import "server-only";
import { SITE } from "./constants";

/**
 * IndexNow: tell Bing (and Yandex, Seznam, Naver) the moment a URL changes.
 *
 * ChatGPT search answers from Bing's index, and chatgpt.com sends us more
 * sign-ups than Google does — so a guide Bing has not crawled yet is a guide
 * ChatGPT cannot cite. One POST to api.indexnow.org reaches every engine in
 * the protocol. The key is public by design: it proves we own the host
 * because the same string is served at /<key>.txt (public/).
 *
 * Called on publish (app/api/admin/post) and once a day for anything updated
 * since (app/api/seo/indexnow). Only production pings; previews and local
 * runs would announce URLs that don't exist.
 */

export const INDEXNOW_KEY = "393acbc1bbc2d0cf24cd397131c5db56";

export async function pingIndexNow(paths: string[]): Promise<{ ok: boolean; status: number; sent: number }> {
  const urls = [...new Set(paths)].map((p) => (p.startsWith("http") ? p : `${SITE.url}${p}`));
  if (!urls.length || process.env.VERCEL_ENV !== "production") return { ok: true, status: 0, sent: 0 };
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(SITE.url).host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE.url}/${INDEXNOW_KEY}.txt`,
        urlList: urls.slice(0, 10_000),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    // 200 and 202 both mean received.
    return { ok: res.ok, status: res.status, sent: urls.length };
  } catch {
    return { ok: false, status: 0, sent: urls.length };
  }
}
