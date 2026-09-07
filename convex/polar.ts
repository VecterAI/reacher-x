// convex/polar.ts
// Polar subscription management
// @see https://www.convex.dev/components/polar

import { Polar } from "@convex-dev/polar";
import { api, components } from "./_generated/api";
import { internalMutation, query } from "./lib/functionBuilders";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getUserFromIdentity } from "./lib/userUtils";
import { refreshUserPlanFromBilling } from "./lib/planTransitionCore";
import { getWideEventLogger } from "./lib/wideEventLogger";

// ============================================================================
// Polar Client Initialization
// ============================================================================

/**
 * Polar client for subscription management.
 *
 * Environment variables (set in Convex dashboard):
 * - POLAR_ORGANIZATION_TOKEN - Your Polar org token
 * - POLAR_WEBHOOK_SECRET - Webhook secret from Polar dashboard
 * - POLAR_SERVER - "sandbox" or "production"
 * - POLAR_PRODUCT_* - Product UUIDs for tier mapping
 *
 * @see https://www.convex.dev/components/polar
 */
export const polar = new Polar(components.polar, {
  // Product keys for Polar's internal tracking (optional)
  // We use product UUIDs directly in syncSubscriptionToUserPlan
  products: {
    hobbyMonthly: process.env.POLAR_PRODUCT_HOBBY_MONTHLY ?? "",
    hobbyYearly: process.env.POLAR_PRODUCT_HOBBY_YEARLY ?? "",
    baseMonthly: process.env.POLAR_PRODUCT_BASE_MONTHLY ?? "",
    baseYearly: process.env.POLAR_PRODUCT_BASE_YEARLY ?? "",
    proMonthly: process.env.POLAR_PRODUCT_PRO_MONTHLY ?? "",
    proYearly: process.env.POLAR_PRODUCT_PRO_YEARLY ?? "",
  },
  // Provide user info for subscription lookups
  getUserInfo: async (ctx) => {
    const user: { _id: Id<"users">; email: string } = await ctx.runQuery(
      api.polar.getCurrentUserInfo
    );
    return {
      userId: user._id,
      email: user.email,
    };
  },
  // Config set via env vars (POLAR_ORGANIZATION_TOKEN, POLAR_WEBHOOK_SECRET, POLAR_SERVER)
});

// ============================================================================
// Export API Functions
// ============================================================================

/**
 * Exported API functions for frontend use.
 * @see https://www.convex.dev/components/polar#api-functions
 */
export const {
  // Get products configured by key
  getConfiguredProducts,
  // List all non-archived products
  listAllProducts,
  // Generate checkout link for given product IDs
  generateCheckoutLink,
  // Generate customer portal URL for subscription management
  generateCustomerPortalUrl,
  // Change current subscription to a different product
  changeCurrentSubscription,
  // Cancel current subscription
  cancelCurrentSubscription,
} = polar.api();

// ============================================================================
// Queries
// ============================================================================

/**
 * Get current user info for Polar integration.
 * Used by the Polar client's getUserInfo callback.
 */
export const getCurrentUserInfo = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) throw new Error("User not found");

    return { _id: user._id, email: user.email };
  },
});

/**
 * Get current user's subscription status.
 * Returns null if no active subscription.
 *
 * @see https://www.convex.dev/components/polar#getcurrentsubscription
 */
export const getSubscription = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) return null;

    return polar.getCurrentSubscription(ctx, { userId: user._id });
  },
});

// ============================================================================
// Internal Mutations (called from webhooks)
// ============================================================================

/**
 * Sync Polar subscription to userPlans table.
 * Called from webhook handlers when subscription changes.
 *
 * IMPORTANT: The productId parameter is the actual Polar product UUID,
 * NOT the product key name. We map UUIDs to tiers using env vars.
 */
export const syncSubscriptionToUserPlan = internalMutation({
  args: {
    userId: v.id("users"),
    productId: v.optional(v.string()), // Polar product UUID
    subscriptionId: v.optional(v.string()),
    status: v.optional(v.string()),
    currentPeriodStart: v.optional(v.string()), // ISO date string
    currentPeriodEnd: v.optional(v.string()), // ISO date string
    polarCustomerId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // The Polar component persists each webhook before this callback and rejects
    // stale updates. Re-read it so a late event cannot roll back current billing.
    await refreshUserPlanFromBilling(ctx, args.userId);
    getWideEventLogger(ctx)?.set({
      billing: { provider: "polar" },
      subscription: { id: args.subscriptionId, status: args.status },
      user: { id: String(args.userId) },
    });
    return null;
  },
});
