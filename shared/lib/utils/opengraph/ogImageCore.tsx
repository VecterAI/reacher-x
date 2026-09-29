import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { REACHERX_ICON_GLYPH_PATH } from "@/shared/ui/components/icons";

const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const OG_BACKGROUND = "#000000";
const OG_FOREGROUND = "#ffffff";

let fontData: Promise<Buffer> | undefined;

function loadGeistRegular() {
  return (fontData ??= readFile(
    path.join(
      process.cwd(),
      "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf"
    )
  ));
}

function ogHeadlineFontSize(headline: string) {
  if (headline.length <= 44) return 64;
  if (headline.length <= 88) return 54;
  return 44;
}

export async function createBrandOgImage(headline: string): Promise<Response> {
  const font = await loadGeistRegular();
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px",
        backgroundColor: OG_BACKGROUND,
        fontFamily: "Geist",
      }}
    >
      <div style={{ display: "flex" }}>
        <svg width={48} height={48} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="3" fill={OG_FOREGROUND} />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d={REACHERX_ICON_GLYPH_PATH}
            fill={OG_BACKGROUND}
          />
        </svg>
      </div>
      <div
        style={{
          display: "flex",
          maxWidth: 920,
          fontSize: ogHeadlineFontSize(headline),
          fontWeight: 400,
          lineHeight: 1.05,
          letterSpacing: "-0.04em",
          color: OG_FOREGROUND,
        }}
      >
        {headline}
      </div>
    </div>,
    {
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      fonts: [{ name: "Geist", data: font, weight: 500, style: "normal" }],
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=86400, stale-while-revalidate=3600",
      },
    }
  );
}
