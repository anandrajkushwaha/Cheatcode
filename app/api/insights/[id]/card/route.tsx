import { ImageResponse } from "next/og";
import { getInsight } from "@/lib/insights/query";

/**
 * An insight as a picture, for WhatsApp, Instagram and LinkedIn.
 *
 *   /api/insights/<id>/card          1080×1350 — status, story, feed post
 *   /api/insights/<id>/card?f=og     1200×630  — the preview under a shared link
 *
 * Everything a stranger needs is on the image itself: the headline, the 70
 * words, where it came from, and where to find more. A picture passed around
 * without its caption still says who made it and what the source was.
 *
 * Public on purpose — it only ever renders a published insight, and the
 * whole point is that people who are not signed in can see it.
 */
export const runtime = "nodejs";
export const revalidate = 3600;

const CREAM = "#fcfaee";
const INK = "#121224";
const MUTED = "#5b5b66";

/**
 * A bold weight for the headline. The built-in font has only a regular
 * weight, which makes a title look like body text. Fetched once and cached;
 * if Google Fonts cannot be reached the card still renders in the default.
 */
async function boldFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch("https://fonts.googleapis.com/css2?family=Inter:wght@700", {
        cache: "force-cache",
      })
    ).text();
    const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url, { cache: "force-cache" })).arrayBuffer();
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getInsight(id);
  if (!item) return new Response("Not found", { status: 404 });

  const og = new URL(request.url).searchParams.get("f") === "og";
  const width = og ? 1200 : 1080;
  const height = og ? 630 : 1350;
  const bold = await boldFont();

  const tag = item.category === "guide" ? "TIPS" : "TREND";
  const tagStyle =
    item.category === "guide"
      ? { background: "#e8efff", color: "#1f5bff" }
      : { background: "#fff1dc", color: "#b35f00" };
  const date = new Date(item.at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const showImage = Boolean(item.imageUrl) && !og;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: CREAM,
          fontFamily: "Geist",
        }}
      >
        {showImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl!}
            alt=""
            width={width}
            height={500}
            style={{ width: "100%", height: 500, objectFit: "cover" }}
          />
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            padding: og ? "56px 64px" : showImage ? "44px 72px 56px" : "72px 72px 64px",
          }}
        >
          {/* The text sits in the middle of whatever space is left, so a card
              without an image is not a paragraph with a hole under it. */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                display: "flex",
                ...tagStyle,
                borderRadius: 999,
                padding: og ? "6px 16px" : "8px 20px",
                fontSize: og ? 20 : 24,
                letterSpacing: 3,
              }}
            >
              {tag}
            </div>
            <div style={{ display: "flex", fontSize: og ? 20 : 24, color: MUTED }}>{date}</div>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: og ? 22 : 30,
              fontSize: og ? 50 : showImage ? 56 : 66,
              lineHeight: 1.15,
              color: INK,
              fontFamily: bold ? "InterBold" : "Geist",
              letterSpacing: -1,
            }}
          >
            {item.title}
          </div>

          {!og && (
            <div
              style={{
                display: "flex",
                marginTop: 28,
                fontSize: showImage ? 31 : 36,
                lineHeight: 1.5,
                color: "#33333d",
              }}
            >
              {item.summary}
            </div>
          )}

          </div>

          <div
            style={{
              display: "flex",
              paddingTop: 28,
              borderTop: "2px solid #e6dfbf",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", maxWidth: "60%" }}>
              {item.sourceName && (
                <div style={{ display: "flex", fontSize: og ? 20 : 24, color: MUTED }}>
                  {`Source: ${item.sourceName}`}
                </div>
              )}
              <div style={{ display: "flex", fontSize: og ? 20 : 24, color: MUTED, marginTop: 6 }}>
                Read more on cheatcodeapp.com
              </div>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: og ? 34 : 40,
                color: INK,
                fontFamily: bold ? "InterBold" : "Geist",
                letterSpacing: -1,
              }}
            >
              Cheatcode
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      fonts: bold ? [{ name: "InterBold", data: bold, weight: 700, style: "normal" }] : undefined,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  );
}
