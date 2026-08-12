import { ImageResponse } from "next/og";

export const alt = "Cheatcode — Talk to someone who's already done it";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: "72px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "-0.04em",
            color: "#000000",
          }}
        >
          Cheatcode
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 82,
            fontWeight: 600,
            letterSpacing: "-0.045em",
            lineHeight: 1.02,
            color: "#000000",
          }}
        >
          <span>Someone&apos;s cousin</span>
          <span>works at Google.</span>
          <span style={{ color: "#a1a1aa" }}>You have Cheatcode.</span>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 26,
            color: "#6e6e76",
          }}
        >
          cheatcodeapp.com
        </div>
      </div>
    ),
    { ...size },
  );
}
