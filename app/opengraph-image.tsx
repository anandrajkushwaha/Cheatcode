import { ImageResponse } from "next/og";
import { TEMPLATES } from "@/lib/app/resume-templates";
import { Frame, GREEN, MiniResume, MUTED, OG_SIZE, Pill, SKY, Tick, ogFonts } from "@/lib/seo/og";

export const alt = "Cheatcode — free resume builder, ATS check and jobs that match your resume";
export const size = OG_SIZE;
export const contentType = "image/png";

/** The card for the home page and every page without one of its own. */
export default async function OgImage() {
  return new ImageResponse(
    (
      <Frame>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 720 }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 66, fontWeight: 700, lineHeight: 1.04, letterSpacing: "-0.045em" }}>
              <span>Free resume builder</span>
              <span style={{ color: SKY }}>that gets you jobs.</span>
            </div>
            <div style={{ display: "flex", marginTop: 22, fontSize: 28, color: MUTED, lineHeight: 1.35 }}>
              Make your resume, check its ATS score and see the jobs it matches.
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 30 }}>
              <Pill bg="#e7f6ec" fg={GREEN}>
                <Tick color={GREEN} />
                ATS score
              </Pill>
              <Pill bg="#e8f1fe" fg={SKY}>{TEMPLATES.length} templates</Pill>
              <Pill bg="#fff4ec" fg="#c2410c">Matching jobs</Pill>
            </div>
          </div>
          <div style={{ display: "flex", position: "relative", width: 340, height: 400, alignItems: "center", justifyContent: "center" }}>
            <div style={{ display: "flex", transform: "rotate(4deg)" }}>
              <MiniResume width={270} />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "absolute",
                left: 0,
                bottom: 18,
                padding: "16px 24px",
                borderRadius: 20,
                background: "#ffffff",
                border: "2px solid #e7f6ec",
                boxShadow: "0 20px 40px -16px rgba(15, 23, 42, 0.35)",
              }}
            >
              <div style={{ display: "flex", fontSize: 20, color: MUTED }}>ATS score</div>
              <div style={{ display: "flex", fontSize: 54, fontWeight: 700, color: GREEN, lineHeight: 1 }}>92</div>
            </div>
          </div>
        </div>
      </Frame>
    ),
    { ...OG_SIZE, fonts: await ogFonts() },
  );
}
