import { ImageResponse } from "next/og";

export const alt = "ComplyVision — Evidence-backed Legal Metrology Review";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", height: "100%", padding: 72, background: "#082f49", color: "#ffffff" }}>
      <div style={{ display: "flex", fontSize: 24, color: "#fbbf24", marginBottom: 42 }}>SEE. VERIFY. COMPLY.</div>
      <div style={{ display: "flex", fontSize: 96, fontWeight: 700 }}>ComplyVision</div>
      <div style={{ display: "flex", fontSize: 30, marginTop: 24 }}>Evidence-backed Legal Metrology Review</div>
      <div style={{ display: "flex", width: 96, height: 6, background: "#fbbf24", marginTop: 42 }} />
    </div>,
    size,
  );
}
