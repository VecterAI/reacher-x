import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getBlogPost } from "@/features/blog/lib/blogPosts";
import { getBlogCategory } from "@/features/blog/lib/blogHelpers";

let fontData: Promise<Buffer> | undefined;
function getFontData() {
  return (fontData ??= readFile(
    path.join(
      process.cwd(),
      "node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf"
    )
  ));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const post = await getBlogPost((await params).slug);
  if (!post) return new Response("Post not found", { status: 404 });
  const font = await getFontData();
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "64px",
        color: "#fafafa",
        background: "#0a0a0a",
        fontFamily: "Geist",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 28,
        }}
      >
        <span>△ ReacherX</span>
        <span style={{ color: "#a3a3a3" }}>
          {getBlogCategory(post.category)?.label}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: post.title.length > 85 ? 52 : 68,
          fontWeight: 600,
          lineHeight: 1.1,
          maxWidth: 1050,
        }}
      >
        {post.title}
      </div>
      <div
        style={{
          display: "flex",
          borderTop: "1px solid #333",
          paddingTop: 24,
          justifyContent: "space-between",
          fontSize: 22,
          color: "#a3a3a3",
        }}
      >
        <span>Find the people you need.</span>
        <span>reacherx.com/blog</span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "Geist", data: font, weight: 600, style: "normal" }],
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=86400, stale-while-revalidate=3600",
      },
    }
  );
}
