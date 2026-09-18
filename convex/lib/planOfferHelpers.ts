import { ConvexError } from "convex/values";
import { env } from "../_generated/server";
import {
  parsePlanOffers,
  isPlanOfferAvailable,
  type PlanOffer,
} from "../../shared/lib/billing/planOfferHelpers";

export function getAvailablePlanOffers(): PlanOffer[] {
  return parsePlanOffers(env.AVAILABLE_PLAN_OFFERS);
}

export function getPlanOfferProductId(offer: PlanOffer): string | undefined {
  return process.env[
    `POLAR_PRODUCT_${offer.tier.toUpperCase()}_${offer.billingPeriod.toUpperCase()}`
  ];
}

export function assertPlanOfferAvailable(offer: PlanOffer) {
  if (
    !isPlanOfferAvailable(
      getAvailablePlanOffers(),
      offer.tier,
      offer.billingPeriod
    )
  ) {
    throw new ConvexError(
      "This plan is no longer available. Please choose an available plan."
    );
  }
}

export function assertProductOffersAvailable(productIds: string[]) {
  const offers = getAvailablePlanOffers();
  if (
    !productIds.length ||
    productIds.some(
      (id) =>
        !id || !offers.some((offer) => getPlanOfferProductId(offer) === id)
    )
  ) {
    throw new ConvexError(
      "This plan is no longer available. Please choose an available plan."
    );
  }
}
