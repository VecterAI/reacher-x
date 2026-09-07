import type { PlanTier } from "./planConstants";

/** Shared mapping for webhooks and restoring billing after a grant ends. */
export function getPolarPlanTier(productId?: string): PlanTier {
  if (!productId) return "free";
  if (
    productId === process.env.POLAR_PRODUCT_HOBBY_MONTHLY ||
    productId === process.env.POLAR_PRODUCT_HOBBY_YEARLY
  )
    return "hobby";
  if (
    productId === process.env.POLAR_PRODUCT_BASE_MONTHLY ||
    productId === process.env.POLAR_PRODUCT_BASE_YEARLY
  )
    return "base";
  if (
    productId === process.env.POLAR_PRODUCT_PRO_MONTHLY ||
    productId === process.env.POLAR_PRODUCT_PRO_YEARLY
  )
    return "pro";
  return "free";
}

export function hasPolarPlanAccess(status?: string): boolean {
  // Preserve the existing past-due grace period. Cancellation at period end
  // keeps status active; a revoked/ended subscription has status canceled.
  return status === "active" || status === "trialing" || status === "past_due";
}
