import { createBrandOgImage } from "@/shared/lib/utils/opengraph/ogImageCore";

export async function GET() {
  return createBrandOgImage("Blog");
}
