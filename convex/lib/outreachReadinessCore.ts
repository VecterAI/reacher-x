import { ConvexError, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { outreachReadinessValidator } from "../validators";
import { toStoredXConnectionStatus } from "./xConnectionStateCore";
import { PLATFORM_REGISTRY } from "../../shared/lib/platforms/registry";

export type OutreachReadiness = Infer<typeof outreachReadinessValidator>;
type ReadinessTask = { type: string; status?: string; supersededAt?: number };

export async function getOutreachReadiness(
  ctx: Pick<QueryCtx, "db">,
  userId: Id<"users">,
  platform: Doc<"prospects">["platform"],
  tasks: ReadinessTask[]
): Promise<OutreachReadiness> {
  const needsAccount = tasks.some(
    (task) =>
      task.supersededAt === undefined &&
      task.status !== "completed" &&
      task.status !== "skipped" &&
      task.type !== "wait" &&
      task.type !== "ask_human"
  );
  if (!needsAccount) return { requiredPlatforms: [], missingPlatforms: [] };
  let connected: boolean;
  if (platform === "linkedin") {
    const account = await ctx.db
      .query("linkedinAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    connected = account?.status === "connected";
  } else {
    const account = await ctx.db
      .query("xAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    connected = toStoredXConnectionStatus(account).isConnected;
  }
  return {
    requiredPlatforms: [platform],
    missingPlatforms: connected ? [] : [platform],
  };
}

export async function getPlanReadiness(
  ctx: Pick<QueryCtx, "db">,
  plan: Doc<"outreachPlans">
) {
  const prospect = await ctx.db.get("prospects", plan.prospectId);
  if (!prospect) throw new Error("Prospect not found");
  const tasks = await ctx.db
    .query("outreachTasks")
    .withIndex("by_plan_order", (q) => q.eq("planId", plan._id))
    .collect();
  return getOutreachReadiness(ctx, plan.userId, prospect.platform, tasks);
}

export async function requirePlanAccounts(
  ctx: Pick<QueryCtx, "db">,
  plan: Doc<"outreachPlans">
) {
  const readiness = await getPlanReadiness(ctx, plan);
  if (readiness.missingPlatforms.length) {
    throw new ConvexError({
      code: "account_required",
      message: `Connect ${readiness.missingPlatforms.map((p) => PLATFORM_REGISTRY[p].label).join(" and ")} before approving this plan.`,
      ...readiness,
    });
  }
  return readiness;
}
