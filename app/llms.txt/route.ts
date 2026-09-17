import { getBlogPosts } from "@/features/blog/lib/blogPosts";
import { buildAgentReadingIndex } from "@/features/landing/lib/agentReadinessCore";
export async function GET() {
  return new Response(buildAgentReadingIndex(await getBlogPosts()), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
