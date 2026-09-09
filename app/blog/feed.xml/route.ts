import { getBlogPosts } from "@/features/blog/lib/blogPosts";
import { buildBlogRss } from "@/features/blog/lib/blogFeeds";

export async function GET() {
  return new Response(buildBlogRss(await getBlogPosts()), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
