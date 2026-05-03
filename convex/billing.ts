import { Polar } from "@polar-sh/sdk";
import { v } from "convex/values";
import { api, components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
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

function createPolarSdk() {
  const accessToken = process.env.POLAR_ORGANIZATION_TOKEN;
  if (!accessToken) {
    throw new Error("Polar organization token is not configured.");
  }
  const server =
    process.env.POLAR_SERVER === "production" ? "production" : "sandbox";
  return new Polar({ accessToken, server });
}

/**
 * `@convex-dev/polar` always POSTs a new Polar customer when the component DB
 * has no row for this user. Polar returns 422 if that email already exists.
 * Link the existing Polar customer (lookup by email) into the component first.
 */
async function ensurePolarCustomerLinkedForUser(
  ctx: ActionCtx,
  user: { _id: Id<"users">; email: string }
) {
  const existing = await ctx.runQuery(
    components.polar.lib.getCustomerByUserId,
    {
      userId: user._id,
    }
  );
  if (existing) {
    return;
  }

  const email = user.email.trim();
  if (!email) {
    return;
  }

  const polarSdk = createPolarSdk();
  const page = await polarSdk.customers.list({ email, limit: 1 });
  const polarCustomer = page.result.items[0];
  if (!polarCustomer) {
    return;
  }

  await ctx.runMutation(components.polar.lib.insertCustomer, {
    id: polarCustomer.id,
    userId: user._id,
  });
}

export const startCheckoutFlow = action({
  args: {
    tier: v.union(v.literal("base"), v.literal("pro")),
    billingPeriod: v.union(v.literal("monthly"), v.literal("yearly")),
    source: v.union(
      v.literal("onboarding_plan"),
      v.literal("header_upgrade"),
      v.literal("sidebar_upgrade"),
      v.literal("plans_page_upgrade")
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

    const user = await ctx.runQuery(api.polar.getCurrentUserInfo);
    await ensurePolarCustomerLinkedForUser(ctx, user);

    return await ctx.runAction(api.polar.generateCheckoutLink, {
      productIds: [productId],
      origin: originUrl.origin,
      successUrl: successUrl.toString(),
    });
  },
});

/**
 * Opens the Polar customer portal. The Convex Polar component does not accept a
 * custom return URL; redirect targets are configured in Polar when applicable.
 */
export const startCustomerPortalFlow = action({
  args: {},
  returns: v.object({
    url: v.string(),
  }),
  handler: async (ctx): Promise<{ url: string }> => {
    return await ctx.runAction(api.polar.generateCustomerPortalUrl, {});
  },
});

export const listSubscriptionHistory = action({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    rows: v.array(
      v.object({
        id: v.string(),
        planLabel: v.string(),
        totalAmount: v.number(),
        currency: v.string(),
        billingReason: v.string(),
        status: v.string(),
        createdAt: v.number(),
      })
    ),
    page: v.number(),
    totalPages: v.number(),
    totalCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const plan = await ctx.runQuery(api.plans.getCurrentPlan);
    if (!plan?.polarCustomerId) {
      return { rows: [], page: 1, totalPages: 0, totalCount: 0 };
    }

    const page = Math.max(1, args.page ?? 1);
    const limit = Math.min(100, Math.max(1, args.limit ?? 5));

    const polar = createPolarSdk();
    const iter = await polar.orders.list({
      customerId: plan.polarCustomerId,
      // Polar currently returns HTTP 500 when product_billing_type is sent,
      // even though the unfiltered customer orders endpoint works.
      page,
      limit,
    });

    const batch = iter.result;
    const items = batch.items;
    const totalCount = batch.pagination.totalCount;
    const totalPages =
      totalCount === 0 ? 0 : Math.max(1, Math.ceil(totalCount / limit));

    const rows = items.map((order) => ({
      id: order.id,
      planLabel: order.product?.name ?? order.description ?? "Subscription",
      totalAmount: order.totalAmount,
      currency: order.currency,
      billingReason: String(order.billingReason),
      status: String(order.status),
      createdAt: order.createdAt.getTime(),
    }));

    return { rows, page, totalPages, totalCount };
  },
});
