import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";

/**
 * The pieces every share image is built from (opengraph-image.tsx files).
 *
 * A link pasted into WhatsApp, LinkedIn or Discord shows this 1200×630 card,
 * and it is the only thing that decides whether anybody taps. So each kind of
 * page gets its own card that says what is behind the link — the guide's
 * title, the ATS score, the templates — in the brand's type and colours,
 * instead of one generic line on every URL.
 */

export const OG_SIZE = { width: 1200, height: 630 };

export const INK = "#0b0b0f";
export const MUTED = "#6e6e76";
export const SKY = "#1f6fe0";
export const GREEN = "#1a7f37";
export const ORANGE = "#c2410c";

// Static Inter (the site's body face), from @fontsource/inter. The variable
// fonts in app/fonts break the image renderer, which reads static files only.
let fontData: Promise<[Buffer, Buffer]> | null = null;
export async function ogFonts() {
  fontData ??= Promise.all([
    readFile(join(process.cwd(), "lib/seo/fonts/inter-latin-400-normal.woff")),
    readFile(join(process.cwd(), "lib/seo/fonts/inter-latin-700-normal.woff")),
  ]);
  const [regular, bold] = await fontData;
  return [
    { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: bold, weight: 700 as const, style: "normal" as const },
  ];
}

/** A tick, drawn — the font has no ✓. */
export function Tick({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5l3.2 3L13 4.5" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The brand mark: the black "C" tile and the word. */
export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 46,
          height: 46,
          borderRadius: 12,
          background: dark ? "#ffffff" : INK,
          color: dark ? INK : "#ffffff",
          fontSize: 30,
          fontWeight: 700,
        }}
      >
        C
      </div>
      <div style={{ display: "flex", fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", color: dark ? "#ffffff" : INK }}>
        Cheatcode
      </div>
    </div>
  );
}

export function Pill({ children, bg, fg }: { children: ReactNode; bg: string; fg: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignSelf: "flex-start",
        alignItems: "center",
        padding: "10px 22px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 24,
        fontWeight: 700,
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}

/** The white card with the brand on top and the address underneath. */
export function Frame({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 64px",
        background: "linear-gradient(135deg, #ffffff 0%, #ffffff 55%, #e8f1fe 100%)",
        fontFamily: "Inter",
        color: INK,
      }}
    >
      <Brand />
      {children}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 24, color: MUTED }}>
        <div style={{ display: "flex" }}>cheatcodeapp.com</div>
        {footer ?? <div style={{ display: "flex" }}>Free for freshers in India</div>}
      </div>
    </div>
  );
}

/** A small drawn resume page — lines for text, a header block, a photo when asked. */
export function MiniResume({ accent = SKY, photo = false, width = 300 }: { accent?: string; photo?: boolean; width?: number }) {
  const h = Math.round(width * 1.38);
  const line = (w: string, c = "#d4d4d8", hh = 8) => (
    <div style={{ display: "flex", width: w, height: hh, borderRadius: 4, background: c, marginTop: 9 }} />
  );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        height: h,
        padding: Math.round(width * 0.09),
        background: "#ffffff",
        borderRadius: 14,
        border: "1px solid #e6e6e9",
        boxShadow: "0 24px 60px -20px rgba(15, 23, 42, 0.35)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {photo && <div style={{ display: "flex", width: width * 0.2, height: width * 0.2, borderRadius: 999, background: "#cbd5e1" }} />}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          {line("70%", INK, 13)}
          {line("45%", accent, 8)}
        </div>
      </div>
      <div style={{ display: "flex", height: 3, background: accent, marginTop: 16, borderRadius: 2 }} />
      {line("35%", accent, 9)}
      {line("100%")}
      {line("92%")}
      {line("80%")}
      {line("35%", accent, 9)}
      {line("100%")}
      {line("88%")}
      {line("60%")}
      {line("35%", accent, 9)}
      {line("95%")}
      {line("70%")}
    </div>
  );
}
