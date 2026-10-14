import { ImageResponse } from "next/og";
import { LOGO_PATH } from "@/lib/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";


/** Apple-Touch-Icon: Marke in Creme auf Markengrün (wie das Favicon). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a5c3a",
        }}
      >
        <svg width="180" height="180" viewBox="0 0 1024 1024">
          <g transform="translate(502 501) scale(1.62) translate(-502 -501)">
            <path fill="#fcfdfc" d={LOGO_PATH} />
          </g>
        </svg>
      </div>
    ),
    { ...size },
  );
}
