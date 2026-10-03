import { cacheLife, cacheTag } from "next/cache";
import { createBrandOgImageBytes } from "@/shared/lib/utils/opengraph/ogImageCore";

export async function GET() {
  const image = await cachedBlogOgImage();
  return new Response(image.bytes, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": image.cacheControl,
    },
  });
}

// Social images only change with a deploy, so one render per day is plenty.
async function cachedBlogOgImage() {
  "use cache";
  cacheTag("og-images", "og-image:blog");
  cacheLife({ stale: 300, revalidate: 86_400, expire: 604_800 });
  return createBrandOgImageBytes("Blog");
}
