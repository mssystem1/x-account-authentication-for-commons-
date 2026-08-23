import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "18px",
          background: "#a7ff19",
          color: "#07100a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 25,
          fontWeight: 900,
          fontFamily: "Arial, Helvetica, sans-serif",
          letterSpacing: -1,
        }}
      >
        VG
      </div>
    ),
    size,
  );
}
