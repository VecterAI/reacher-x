import { getBlogPosts } from "@/features/blog/lib/blogPosts";
import { buildBlogMarkdownIndex } from "@/features/blog/lib/blogFeeds";
export async function GET() {
  return new Response(
    `# ReacherX\n\nReacherX helps you find the people you need.\n\n- [Home](https://reacherx.com/home)\n- [Use cases](https://reacherx.com/use-cases)\n- [Pricing](https://reacherx.com/pricing)\n\n${buildBlogMarkdownIndex(await getBlogPosts())}`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=3600",
      },
    }
  );
}
