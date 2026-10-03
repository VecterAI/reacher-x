import { getBlogPost } from "@/features/blog/lib/blogPosts";
import { blogBodyMarkdown } from "@/features/blog/lib/blogContentCore";
import { markdownPostHeader } from "@/features/blog/lib/blogFeeds";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const post = await getBlogPost((await params).slug);
  if (!post) return new Response("Post not found", { status: 404 });
  return new Response(
    markdownPostHeader(post) + blogBodyMarkdown(post.content),
    {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=3600",
      },
    }
  );
}
