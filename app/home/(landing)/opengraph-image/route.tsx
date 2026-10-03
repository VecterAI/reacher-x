import { cacheLife, cacheTag } from "next/cache";
import { createBrandOgImageBytes } from "@/shared/lib/utils/opengraph/ogImageCore";
import { MARKETING_COPY } from "@/features/landing/lib/marketingContentHelpers";

export async function GET() {
  const image = await cachedHomeOgImage();
  return new Response(image.bytes, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": image.cacheControl,
    },
  });
}

// Social images only change with a deploy, so one render per day is plenty.
async function cachedHomeOgImage() {
  "use cache";
  cacheTag("og-images", "og-image:home");
  cacheLife({ stale: 300, revalidate: 86_400, expire: 604_800 });
  return createBrandOgImageBytes(MARKETING_COPY.home.headline);
}
