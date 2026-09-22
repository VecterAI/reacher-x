import { createBrandOgImage } from "@/shared/lib/utils/opengraph/ogImageCore";
import { MARKETING_COPY } from "@/features/landing/lib/marketingContentHelpers";

export async function GET() {
  return createBrandOgImage(MARKETING_COPY.home.headline);
}
