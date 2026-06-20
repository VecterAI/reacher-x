import { ConvexHttpClient } from "convex/browser";
import { unstable_cache } from "next/cache";
import { api } from "@/convex/_generated/api";
import type { Tweet } from "@/features/threads/types";
import { logger } from "@/shared/lib/logger";

const PUBLIC_TESTIMONIALS_REVALIDATE_SECONDS = 60 * 5;

const getCachedPublicTestimonials = unstable_cache(
  async (limit: number) => {
    if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
      return [] as Tweet[];
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL, {
      logger: false,
    });

    try {
      const response = await convex.action(
        api.publicSocial.getPublicTestimonials,
        {
          limit,
        }
      );
      return response.tweets as Tweet[];
    } catch (error) {
      logger.error(
        "[getPublicTestimonials] Failed to fetch public testimonials",
        error
      );
      return [] as Tweet[];
    }
  },
  ["public-testimonials"],
  {
    revalidate: PUBLIC_TESTIMONIALS_REVALIDATE_SECONDS,
  }
);

export async function getPublicTestimonials(limit = 4) {
  return await getCachedPublicTestimonials(limit);
}
