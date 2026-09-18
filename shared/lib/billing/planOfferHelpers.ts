import type { Infer } from "convex/values";
import type { planOfferValidator } from "@/convex/validators";
import { PAID_PLAN_TIERS, type PlanTier } from "@/convex/lib/planConstants";

export type PlanOffer = Infer<typeof planOfferValidator>;
export type BillingPeriod = PlanOffer["billingPeriod"];
export const BILLING_PERIODS = ["monthly", "yearly"] as const;
export const DEFAULT_PLAN_OFFERS =
  "base:monthly,base:yearly,pro:monthly,pro:yearly";
export const PLAN_OFFERS_UNAVAILABLE =
  "Plans are temporarily unavailable. Please try again shortly.";

/** Missing uses the launch selection. Empty or malformed values close new sales. */
export function parsePlanOffers(value: string | undefined): PlanOffer[] {
  const entries = (value ?? DEFAULT_PLAN_OFFERS)
    .trim()
    .toLowerCase()
    .split(",")
    .map((entry) => entry.trim());
  const all = PAID_PLAN_TIERS.flatMap((tier) =>
    BILLING_PERIODS.map((billingPeriod) => ({ tier, billingPeriod }))
  );
  if (
    entries.some(
      (entry) =>
        !all.some((offer) => `${offer.tier}:${offer.billingPeriod}` === entry)
    )
  )
    return [];
  return all.filter((offer) =>
    entries.includes(`${offer.tier}:${offer.billingPeriod}`)
  );
}

export function isPlanOfferAvailable(
  offers: readonly PlanOffer[],
  tier: PlanOffer["tier"],
  billingPeriod: BillingPeriod
): boolean {
  return offers.some(
    (offer) => offer.tier === tier && offer.billingPeriod === billingPeriod
  );
}

/** Existing paid access is independent of which upgrades are currently for sale. */
export function getUpgradeOffers(
  offers: readonly PlanOffer[],
  currentTier: PlanTier
): PlanOffer[] {
  const currentRank =
    currentTier === "free" ? -1 : PAID_PLAN_TIERS.indexOf(currentTier);
  return offers.filter(
    (offer) => PAID_PLAN_TIERS.indexOf(offer.tier) > currentRank
  );
}

export function getPlanOfferSelection(
  offers: readonly PlanOffer[],
  preferred: BillingPeriod
) {
  const periods = BILLING_PERIODS.filter((period) =>
    offers.some((offer) => offer.billingPeriod === period)
  );
  const billing = periods.includes(preferred)
    ? preferred
    : (periods[0] ?? preferred);
  return {
    periods,
    billing,
    tiers: PAID_PLAN_TIERS.filter((tier) =>
      isPlanOfferAvailable(offers, tier, billing)
    ),
  };
}
