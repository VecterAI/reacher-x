// convex/polar.ts
// Polar subscription management
// @see https://www.convex.dev/components/polar

import { Polar } from "@convex-dev/polar";
import { api, components, internal } from "./_generated/api";
import { internalMutation, query } from "./lib/functionBuilders";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { parseIsoToTimestamp } from "../shared/lib/utils/time/timeUtils";
import { getUserFromIdentity } from "./lib/userUtils";
import { upgradePlan } from "./lib/planCore";
import type { PlanTier } from "./lib/planConstants";

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
    currentPeriodEnd: v.optional(v.string()), // ISO date string
    polarCustomerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get product IDs from environment variables
    const baseMonthlyId = process.env.POLAR_PRODUCT_BASE_MONTHLY;
    const baseYearlyId = process.env.POLAR_PRODUCT_BASE_YEARLY;
    const proMonthlyId = process.env.POLAR_PRODUCT_PRO_MONTHLY;
    const proYearlyId = process.env.POLAR_PRODUCT_PRO_YEARLY;

    /**
     * Maps Polar product UUIDs to internal plan tiers.
     *
     * Environment variables provide the product UUIDs from Polar dashboard:
     * - POLAR_PRODUCT_BASE_MONTHLY / POLAR_PRODUCT_BASE_YEARLY → "base" tier
     * - POLAR_PRODUCT_PRO_MONTHLY / POLAR_PRODUCT_PRO_YEARLY → "pro" tier
     *
     * If the productId doesn't match any known UUID, defaults to "free" tier.
     */
    const tierMap: Record<string, PlanTier> = {};
    if (baseMonthlyId) tierMap[baseMonthlyId] = "base";
    if (baseYearlyId) tierMap[baseYearlyId] = "base";
    if (proMonthlyId) tierMap[proMonthlyId] = "pro";
    if (proYearlyId) tierMap[proYearlyId] = "pro";

    // If cancelled or no productId, revert to free
    const tier = args.productId ? (tierMap[args.productId] ?? "free") : "free";

    // Convert ISO date string to timestamp using centralized utility
    // Per AGENT_CONTEXT.txt: Use date-fns via timeUtils for reliable date parsing
    let expiresAt: number | undefined;
    if (args.currentPeriodEnd) {
      expiresAt = parseIsoToTimestamp(args.currentPeriodEnd);
      if (expiresAt === undefined) {
        console.warn(
          `[Polar] Invalid currentPeriodEnd date: ${args.currentPeriodEnd}`
        );
      }
    }

    console.info(
      `[Polar] Syncing subscription for user ${args.userId}: productId=${args.productId}, tier=${tier}, status=${args.status}, expiresAt=${expiresAt}`
    );

    await upgradePlan(
      ctx,
      args.userId,
      tier,
      args.subscriptionId,
      expiresAt,
      args.polarCustomerId
    );

    await ctx.runMutation(
      internal.workspaces.reconcileWorkspaceEntitlementsForUserInternal,
      {
        userId: args.userId,
      }
    );
  },
});
