import { ImageResponse } from "next/og";

export const alt = "VouchGuard AI — Audit the Commons leaderboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#07100a",
          color: "#f5fff4",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: "linear-gradient(135deg, #07100a 0%, #0b130d 58%, #07100a 100%)",
          }}
        />

        <div style={{ position: "absolute", right: -90, top: -110, width: 520, height: 520, borderRadius: 999, border: "2px solid #33520d", display: "flex" }} />
        <div style={{ position: "absolute", right: 5, top: -10, width: 330, height: 330, borderRadius: 999, border: "2px solid #4c7d10", display: "flex" }} />
        <div style={{ position: "absolute", right: 90, top: 75, width: 160, height: 160, borderRadius: 999, border: "2px solid #7bc215", display: "flex" }} />

        <div
          style={{
            position: "absolute",
            right: 123,
            top: 108,
            width: 94,
            height: 94,
            borderRadius: 28,
            background: "#a7ff19",
            color: "#07100a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 38,
            fontWeight: 900,
            letterSpacing: -2,
          }}
        >
          VG
        </div>

        <div style={{ position: "absolute", left: 64, top: 48, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "#a7ff19", color: "#07100a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18 }}>V</div>
          <div style={{ fontSize: 24, fontWeight: 800, display: "flex" }}>VouchGuard <span style={{ color: "#a7ff19", marginLeft: 7 }}>AI</span></div>
        </div>

        <div style={{ position: "absolute", left: 64, top: 150, width: 770, display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#a7ff19", fontSize: 18, fontWeight: 800, letterSpacing: 3, marginBottom: 18, display: "flex" }}>COMMONS RANK INTELLIGENCE</div>
          <div style={{ fontSize: 68, lineHeight: 0.96, fontWeight: 900, letterSpacing: -4, display: "flex", flexDirection: "column" }}>
            <span>Audit the Commons</span>
            <span style={{ color: "#a7ff19" }}>leaderboard.</span>
          </div>
          <div style={{ marginTop: 28, fontSize: 24, lineHeight: 1.35, color: "#c8d7ca", width: 720, display: "flex" }}>
            See who climbed naturally — and whose rank may be distorted by coordinated vouches, slash attacks, bots or Sybil-like networks.
          </div>
        </div>

        <div style={{ position: "absolute", left: 64, bottom: 55, display: "flex", gap: 12 }}>
          {[
            "SUPPORT INTEGRITY",
            "SLASH ATTACK RISK",
            "RANK RELIABILITY",
          ].map((label) => (
            <div key={label} style={{ border: "1px solid #385039", borderRadius: 999, padding: "10px 16px", color: "#d8e7da", fontSize: 15, fontWeight: 700, display: "flex" }}>{label}</div>
          ))}
        </div>

        <div style={{ position: "absolute", right: 62, bottom: 57, color: "#7f9181", fontSize: 17, display: "flex" }}>
          vouchguard-ai.vercel.app
        </div>
      </div>
    ),
    size,
  );
}
