import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "uso.ai — See where your AI usage goes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "radial-gradient(closest-side at 50% 30%, #2a2475 0%, #08090a 70%)",
          color: "#f7f8f8",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="56" height="56" viewBox="0 0 32 32" fill="none">
            <path
              d="M 8 8 L 8 17 A 8 8 0 0 0 24 17 L 24 8"
              stroke="#7170ff"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="16" cy="17" r="1.8" fill="#7170ff" />
          </svg>
          <span
            style={{
              fontSize: 36,
              fontWeight: 500,
              letterSpacing: "-0.04em",
            }}
          >
            uso<span style={{ opacity: 0.6 }}>.ai</span>
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 500,
              letterSpacing: "-0.022em",
              lineHeight: 1.05,
              maxWidth: 1000,
            }}
          >
            See where your AI usage goes.
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#8a8f98",
              letterSpacing: "-0.005em",
              maxWidth: 900,
            }}
          >
            A menu bar dashboard for Claude, ChatGPT, Cursor, and Gemini.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
