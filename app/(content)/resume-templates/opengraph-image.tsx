import { ImageResponse } from "next/og";
import { TEMPLATES } from "@/lib/app/resume-templates";
import { Frame, GREEN, MiniResume, MUTED, OG_SIZE, Pill, SKY, ogFonts } from "@/lib/seo/og";

export const alt = "Free resume templates — ATS-friendly, with and without photo";
export const size = OG_SIZE;
export const contentType = "image/png";

/** A fan of three drawn templates beside the count. */
export default async function OgImage() {
  return new ImageResponse(
    (
      <Frame footer={<div style={{ display: "flex" }}>Edit online · Download PDF</div>}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 560 }}>
            <Pill bg="#e8f1fe" fg={SKY}>100% FREE</Pill>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 22, fontSize: 76, fontWeight: 700, lineHeight: 1.02, letterSpacing: "-0.045em" }}>
              <span>{TEMPLATES.length} resume</span>
              <span>templates</span>
            </div>
            <div style={{ display: "flex", marginTop: 18, fontSize: 30, color: MUTED, lineHeight: 1.35 }}>
              ATS-friendly. Freshers & experienced. With or without photo.
            </div>
          </div>
          <div style={{ display: "flex", position: "relative", width: 520, height: 420 }}>
            <div style={{ display: "flex", position: "absolute", left: 0, top: 40, transform: "rotate(-8deg)" }}>
              <MiniResume width={220} accent={GREEN} photo />
            </div>
            <div style={{ display: "flex", position: "absolute", left: 270, top: 40, transform: "rotate(8deg)" }}>
              <MiniResume width={220} accent="#c2410c" />
            </div>
            <div style={{ display: "flex", position: "absolute", left: 130, top: 10 }}>
              <MiniResume width={250} accent={SKY} />
            </div>
          </div>
        </div>
      </Frame>
    ),
    { ...OG_SIZE, fonts: await ogFonts() },
  );
}
