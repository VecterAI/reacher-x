import { cacheLife, cacheTag } from "next/cache";
import { createBrandOgImageBytes } from "@/shared/lib/utils/opengraph/ogImageCore";
import { getBlogPost } from "@/features/blog/lib/blogPosts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return new Response("Post not found", { status: 404 });
  const image = await cachedPostOgImage(post.title, slug);
  return new Response(image.bytes, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": image.cacheControl,
    },
  });
}

// Social images only change with a deploy, so one render per article per day
// is plenty. Lookups stay outside the cached section so unknown slugs keep
// returning dynamic 404s instead of a cached miss.
async function cachedPostOgImage(title: string, slug: string) {
  "use cache";
  cacheTag("og-images", `og-image:${slug}`);
  cacheLife({ stale: 300, revalidate: 86_400, expire: 604_800 });
  return createBrandOgImageBytes(title);
}
