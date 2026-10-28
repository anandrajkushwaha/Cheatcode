import { ImageResponse } from "next/og";
import { getPostBySlug } from "@/lib/queries/posts";
import { Frame, MUTED, OG_SIZE, Pill, SKY, ogFonts } from "@/lib/seo/og";

export const alt = "A free career guide from Cheatcode";
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * The guide's own card: its title, big, beside its cover.
 *
 * The cover alone (what links used to show) is a photo with no words on it —
 * in a WhatsApp chat nobody can tell what the guide is about. The title is
 * what gets the tap.
 */
export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug).catch(() => null);
  const title = post?.title ?? "Career guides for freshers in India";
  const cover = post?.cover_image ? await asDataUrl(post.cover_image) : null;
  const fontSize = title.length <= 45 ? 68 : title.length <= 75 ? 56 : 46;

  return new ImageResponse(
    (
      <Frame
        footer={
          <div style={{ display: "flex" }}>
            {post?.reading_minutes ? `${post.reading_minutes} min read · ` : ""}Free guide
          </div>
        }
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 44 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            {post?.category?.name && (
              <div style={{ display: "flex" }}>
                <Pill bg="#e8f1fe" fg={SKY}>
                  {post.category.name.toUpperCase()}
                </Pill>
              </div>
            )}
            <div
              style={{
                display: "flex",
                marginTop: 24,
                fontSize,
                fontWeight: 700,
                lineHeight: 1.08,
                letterSpacing: "-0.04em",
              }}
            >
              {title}
            </div>
            {post?.author?.name && (
              <div style={{ display: "flex", marginTop: 22, fontSize: 24, color: MUTED }}>By {post.author.name}</div>
            )}
          </div>
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              width={380}
              height={380}
              style={{ width: 380, height: 380, objectFit: "cover", borderRadius: 28 }}
            />
          )}
        </div>
      </Frame>
    ),
    { ...OG_SIZE, fonts: await ogFonts() },
  );
}

/** The cover as a data URL, or null — the card must render even when storage is slow. */
async function asDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/image\/(jpeg|png)/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}
