import { createBrandOgImage } from "@/shared/lib/utils/opengraph/ogImageCore";
import { getBlogPost } from "@/features/blog/lib/blogPosts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const post = await getBlogPost((await params).slug);
  if (!post) return new Response("Post not found", { status: 404 });
  return createBrandOgImage(post.title);
}
