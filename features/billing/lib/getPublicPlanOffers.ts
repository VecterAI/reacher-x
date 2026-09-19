import "server-only";

import { fetchQuery } from "convex/nextjs";
import { cacheLife, cacheTag } from "next/cache";

import { api } from "@/convex/_generated/api";
import type { PlanOffer } from "@/shared/lib/billing/planOfferHelpers";

export interface PublicPlanOffers {
  offers: PlanOffer[];
  isError: boolean;
}

/**
 * Load public plan availability into the pricing page's server render.
 *
 * Availability is controlled by Convex environment settings, so it cannot be
 * read from the Next.js build environment. A short cache keeps the page fast
 * while still allowing an availability change to reach the public page soon.
 */
export async function getPublicPlanOffers(): Promise<PublicPlanOffers> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  cacheTag("public-plan-offers");

  try {
    return {
      offers: await fetchQuery(api.billing.getAvailableOffers),
      isError: false,
    };
  } catch (error) {
    console.error("[getPublicPlanOffers] Failed to fetch plan offers", error);
    return { offers: [], isError: true };
  }
}
