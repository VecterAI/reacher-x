import { getBlogPosts } from "@/features/blog/lib/blogPosts";
import { buildBlogMarkdownIndex } from "@/features/blog/lib/blogFeeds";
export async function GET() {
  return new Response(buildBlogMarkdownIndex(await getBlogPosts()), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
