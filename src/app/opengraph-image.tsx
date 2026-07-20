import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#163a26",
          backgroundImage:
            "radial-gradient(circle at 22% 22%, rgba(201,163,90,0.35), transparent 45%), radial-gradient(circle at 80% 75%, rgba(91,152,113,0.35), transparent 50%)",
          padding: 80,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 30,
            letterSpacing: 10,
            textTransform: "uppercase",
            color: "#d6b876",
            marginBottom: 28,
          }}
        >
          Hasiru Nidhi
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 76,
            color: "#fbf8f1",
            textAlign: "center",
            lineHeight: 1.15,
            maxWidth: 900,
          }}
        >
          {siteConfig.tagline}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 26,
            color: "rgba(251,248,241,0.72)",
          }}
        >
          A Nature Experience Retreat near Bengaluru
        </div>
      </div>
    ),
    { ...size }
  );
}
