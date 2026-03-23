import { v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./lib/functionBuilders";

function resolvePolarProductId(args: {
  tier: "base" | "pro";
  billingPeriod: "monthly" | "yearly";
}) {
  const productId =
    args.tier === "base"
      ? args.billingPeriod === "monthly"
        ? process.env.POLAR_PRODUCT_BASE_MONTHLY
        : process.env.POLAR_PRODUCT_BASE_YEARLY
      : args.billingPeriod === "monthly"
        ? process.env.POLAR_PRODUCT_PRO_MONTHLY
        : process.env.POLAR_PRODUCT_PRO_YEARLY;

  if (!productId) {
    throw new Error("Polar product is not configured for that plan.");
  }

  return productId;
}

function normalizeReturnTo(returnTo?: string) {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/";
  }

  return returnTo;
}

export const startCheckoutFlow = action({
  args: {
    tier: v.union(v.literal("base"), v.literal("pro")),
    billingPeriod: v.union(v.literal("monthly"), v.literal("yearly")),
    source: v.union(
      v.literal("onboarding_plan"),
      v.literal("header_upgrade"),
      v.literal("sidebar_upgrade")
    ),
    origin: v.string(),
    returnTo: v.optional(v.string()),
    sessionId: v.optional(v.id("workspaceSetupSessions")),
  },
  returns: v.object({
    url: v.string(),
  }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    let originUrl: URL;
    try {
      originUrl = new URL(args.origin);
    } catch {
      throw new Error("A valid origin is required to start checkout.");
    }

    const successUrl = new URL("/success", originUrl.origin);
    successUrl.searchParams.set("source", args.source);
    successUrl.searchParams.set("tier", args.tier);
    successUrl.searchParams.set("billingPeriod", args.billingPeriod);
    successUrl.searchParams.set("returnTo", normalizeReturnTo(args.returnTo));
    if (args.sessionId) {
      successUrl.searchParams.set("sessionId", args.sessionId);
    }

    const productId = resolvePolarProductId(args);

    return await ctx.runAction(api.polar.generateCheckoutLink, {
      productIds: [productId],
      origin: originUrl.origin,
      successUrl: successUrl.toString(),
    });
  },
});
