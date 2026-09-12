import { v } from "convex/values";
import { query, mutation } from "./lib/functionBuilders";
import { workspacePlanUsageValidator } from "./validators";
import { getOwnedWorkspace, requireUser } from "./lib/accessHelpers";
import { getUserFromIdentity } from "./lib/userUtils";
import { getOrCreateUserPlan } from "./lib/planCore";
import { polar } from "./polar";
import { computeUsageCycleWindow } from "./lib/planCycleUtils";
import { createUsageCycleKey } from "./lib/usageDashboardCore";
import { getWorkspaceReportingMetricSums } from "./lib/workspaceReportingAggregate";
import { isWorkspaceReportingAggregateReady } from "./lib/workspaceReportingRollout";
import { isWorkspaceSetupCompleted } from "./lib/workspaceSetup";
import {
  getWorkspaceUseCase,
  getWorkspaceDiscoveryVerb,
} from "../shared/lib/workspaceUseCases";
import { getPlanUsageNoticeKey } from "../shared/lib/planUsagePresentation";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

export const getCurrent = query({
  args: { workspaceId: v.id("workspaces"), nowMs: v.number() },
  returns: v.union(workspacePlanUsageValidator, v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) return null;
    const workspace = await getOwnedWorkspace(ctx, args.workspaceId, user._id);
    if (!isWorkspaceSetupCompleted(workspace) || workspace.deletionWorkflowId)
      return null;
    const [plan, subscription, ready] = await Promise.all([
      getOrCreateUserPlan(ctx, user._id),
      polar.getCurrentSubscription(ctx, { userId: user._id }),
      isWorkspaceReportingAggregateReady(ctx.db, workspace._id),
    ]);
    const window = computeUsageCycleWindow({
      now: args.nowMs,
      tier: plan.tier,
      subscription,
    });
    // The same aggregate, metric, and inclusive cycle bounds as /usage.
    const used = ready
      ? ((
          await getWorkspaceReportingMetricSums(ctx, {
            workspaceId: workspace._id,
            dataset: "usage",
            queries: [
              {
                metric: "qualifiedProspectsCount",
                startMs: window.cycleStart,
                endMs: window.cycleEnd + 1,
              },
            ],
          })
        )[0] ?? 0)
      : null;
    const noticeKey = getPlanUsageNoticeKey(
      createUsageCycleKey(window),
      plan.prospectsLimit
    );
    const useCase = getWorkspaceUseCase(workspace.useCaseKey);
    return {
      workspaceId: workspace._id,
      workspaceName: workspace.name,
      entityPlural: useCase.entityPlural,
      discoveryVerb: getWorkspaceDiscoveryVerb(useCase.key),
      tier: plan.tier,
      used,
      limit: plan.prospectsLimit,
      cycleEnd: window.cycleEnd,
      noticeKey,
      noticeDismissed: workspace.dismissedPlanUsageNoticeKey === noticeKey,
      limitReached:
        plan.tier !== "free" &&
        plan.prospectsLimit !== -1 &&
        (used === null
          ? workspace.prospectingWorkflowStatus === "limit_reached"
          : used >= plan.prospectsLimit),
    };
  },
});

export const dismissNotice = mutation({
  args: { workspaceId: v.id("workspaces"), noticeKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const workspace = await getOwnedWorkspace(ctx, args.workspaceId, user._id);
    if (!workspace) throw new Error("Workspace not found");
    const [plan, subscription] = await Promise.all([
      getOrCreateUserPlan(ctx, user._id),
      polar.getCurrentSubscription(ctx, { userId: user._id }),
    ]);
    const window = computeUsageCycleWindow({
      now: getCurrentUTCTimestamp(),
      tier: plan.tier,
      subscription,
    });
    const key = getPlanUsageNoticeKey(
      createUsageCycleKey(window),
      plan.prospectsLimit
    );
    // A stale tab cannot dismiss a notice for a different cycle or plan.
    if (args.noticeKey === key) {
      await ctx.db.patch(workspace._id, { dismissedPlanUsageNoticeKey: key });
    }
    return null;
  },
});
