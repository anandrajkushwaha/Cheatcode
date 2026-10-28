import { ImageResponse } from "next/og";
import { Frame, GREEN, INK, MUTED, OG_SIZE, ORANGE, Pill, Tick, ogFonts } from "@/lib/seo/og";

export const alt = "Free resume ATS checker — see your score and what to fix";
export const size = OG_SIZE;
export const contentType = "image/png";

/** A score dial and the three things the checker tells you. */
export default async function OgImage() {
  const row = (ok: boolean, text: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 25, marginTop: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          flexShrink: 0,
          borderRadius: 999,
          background: ok ? "#e7f6ec" : "#fff4ec",
          color: ok ? GREEN : ORANGE,
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        {ok ? <Tick color={GREEN} size={20} /> : "!"}
      </div>
      <div style={{ display: "flex", color: INK }}>{text}</div>
    </div>
  );
  return new ImageResponse(
    (
      <Frame footer={<div style={{ display: "flex" }}>No sign-up · File stays on your phone</div>}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 620 }}>
            <Pill bg="#e7f6ec" fg={GREEN}>FREE ATS CHECKER</Pill>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 22, fontSize: 72, fontWeight: 700, lineHeight: 1.04, letterSpacing: "-0.045em" }}>
              <span>Will your resume</span>
              <span>pass the ATS?</span>
            </div>
            <div style={{ display: "flex", marginTop: 18, fontSize: 30, color: MUTED }}>Upload it. Get your score in 30 seconds.</div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 430,
              padding: 32,
              borderRadius: 28,
              background: "#ffffff",
              border: "1px solid #e6e6e9",
              boxShadow: "0 30px 60px -24px rgba(15, 23, 42, 0.35)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 130,
                  height: 130,
                  flexShrink: 0,
                  borderRadius: 999,
                  border: `14px solid ${GREEN}`,
                  borderRightColor: "#e6e6e9",
                  fontSize: 48,
                  fontWeight: 700,
                  color: GREEN,
                }}
              >
                78
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 24, color: MUTED }}>Your ATS score</div>
                <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>Good, 3 fixes</div>
              </div>
            </div>
            {row(true, "Sections read correctly")}
            {row(true, "Contact details found")}
            {row(false, "Add numbers to results")}
          </div>
        </div>
      </Frame>
    ),
    { ...OG_SIZE, fonts: await ogFonts() },
  );
}
