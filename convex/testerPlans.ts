import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./lib/functionBuilders";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { normalizeEmailAddress } from "../shared/lib/utils/contact/contactUtils";
import { PLAN_LIMITS } from "./lib/planConstants";
import { refreshUserPlanFromBilling } from "./lib/planTransitionCore";
import {
  getComplimentaryGrant,
  replaceComplimentaryGrant,
  resolveGrantExpiry,
} from "./lib/planGrantCore";
import {
  paidPlanTierValidator,
  testerPlanSummaryValidator,
} from "./validators";

async function getUserByEmail(ctx: QueryCtx | MutationCtx, email: string) {
  const normalized = normalizeEmailAddress(email);
  if (!normalized) throw new Error("Email is required.");
  const exact = email.trim();
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", exact))
    .unique();
  if (user || exact === normalized) return user;
  return ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", normalized))
    .unique();
}

async function getTesterPlanSummary(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">
) {
  const [plan, grant] = await Promise.all([
    ctx.db
      .query("userPlans")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first(),
    getComplimentaryGrant(ctx, user._id),
  ]);
  return {
    userId: user._id,
    email: user.email,
    tier: plan?.tier ?? "free",
    prospectsLimit: plan?.prospectsLimit ?? PLAN_LIMITS.free.prospectsLimit,
    workspacesLimit: plan?.workspacesLimit ?? PLAN_LIMITS.free.workspacesLimit,
    externalSubscriptionId: plan?.externalSubscriptionId,
    expiresAt: plan?.expiresAt,
    updatedAt: plan?.updatedAt,
    complimentaryGrant: grant
      ? { tier: grant.tier, expiresAt: grant.expiresAt }
      : null,
  };
}

export const getTesterPlanByEmail = internalQuery({
  args: { email: v.string() },
  returns: v.union(testerPlanSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.email);
    return user ? getTesterPlanSummary(ctx, user) : null;
  },
});

/** Also extends/replaces the current grant; durationDays starts from this call. */
export const grantTesterPlanByEmail = internalMutation({
  args: {
    email: v.string(),
    tier: paidPlanTierValidator,
    durationDays: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  },
  returns: v.object({
    success: v.literal(true),
    ...testerPlanSummaryValidator.fields,
  }),
  handler: async (ctx, args) => {
    const expiresAt = resolveGrantExpiry(getCurrentUTCTimestamp(), args);
    const user = await getUserByEmail(ctx, args.email);
    if (!user) throw new Error(`User not found for email: ${args.email}`);
    await replaceComplimentaryGrant(ctx, {
      userId: user._id,
      tier: args.tier,
      expiresAt,
    });
    await refreshUserPlanFromBilling(ctx, user._id);
    return {
      success: true as const,
      ...(await getTesterPlanSummary(ctx, user)),
    };
  },
});

export const revokeTesterPlanByEmail = internalMutation({
  args: { email: v.string() },
  returns: v.object({
    success: v.literal(true),
    ...testerPlanSummaryValidator.fields,
  }),
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.email);
    if (!user) throw new Error(`User not found for email: ${args.email}`);
    const grant = await getComplimentaryGrant(ctx, user._id);
    if (grant) await ctx.db.delete(grant._id);
    await refreshUserPlanFromBilling(ctx, user._id);
    return {
      success: true as const,
      ...(await getTesterPlanSummary(ctx, user)),
    };
  },
});

export const expireGrantInternal = internalMutation({
  args: { grantId: v.id("complimentaryPlanGrants") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const grant = await ctx.db.get(args.grantId);
    if (!grant || grant.expiresAt === undefined) return null;
    if (grant.expiresAt > getCurrentUTCTimestamp()) {
      await ctx.scheduler.runAt(
        grant.expiresAt,
        internal.testerPlans.expireGrantInternal,
        args
      );
      return null;
    }
    await ctx.db.delete(grant._id);
    if (await ctx.db.get(grant.userId)) {
      await refreshUserPlanFromBilling(ctx, grant.userId);
    }
    return null;
  },
});

/** Bounded repair if a scheduled mutation failed because of a deployment bug. */
export const recoverExpiredGrantsInternal = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const grants = await ctx.db
      .query("complimentaryPlanGrants")
      .withIndex("by_expiresAt", (q) =>
        q.gt("expiresAt", undefined).lte("expiresAt", getCurrentUTCTimestamp())
      )
      .take(100);
    for (const grant of grants) {
      await ctx.scheduler.runAfter(
        0,
        internal.testerPlans.expireGrantInternal,
        { grantId: grant._id }
      );
    }
    return null;
  },
});
