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
 * read from the Next.js build environment. At runtime a failed lookup rethrows
 * so a background refresh never replaces the last good cached offers; the
 * uncached wrapper only surfaces the error state when nothing is cached yet
 * (cold start). During build-time prerendering the failure is tolerated with a
 * short-lived error entry so deploys still succeed while Convex is down.
 * Re-run `revalidateTag("public-plan-offers")` to publish an availability
 * change before the daily refresh.
 */
export async function getPublicPlanOffers(): Promise<PublicPlanOffers> {
  try {
    return await getCachedPublicPlanOffers();
  } catch (error) {
    console.error("[getPublicPlanOffers] Failed to fetch plan offers", error);
    return { offers: [], isError: true };
  }
}

async function getCachedPublicPlanOffers(): Promise<PublicPlanOffers> {
  "use cache";
  cacheLife("days");
  cacheTag("public-plan-offers");

  try {
    return {
      offers: await fetchQuery(api.billing.getAvailableOffers),
      isError: false,
    };
  } catch (error) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
      cacheLife({ stale: 60, revalidate: 60, expire: 300 });
      return { offers: [], isError: true };
    }
    throw error;
  }
}
