import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  getWorkspaceUseCase,
  getWorkspaceDiscoveryVerb,
} from "../../shared/lib/workspaceUseCases";
import { checkProspectLimit } from "./prospectingHelpers";
import { createNotification } from "./notificationHelpers";
import { createUsageCycleKey } from "./usageDashboardCore";
import { isWorkspaceSetupCompleted } from "./workspaceSetup";

/** Runs with the capacity transition, including when the user is offline. */
export async function notifyWorkspacePlanLimitReached(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">
) {
  const workspace = await ctx.db.get(workspaceId);
  if (!isWorkspaceSetupCompleted(workspace) || workspace.deletionWorkflowId)
    return;
  const usage = await checkProspectLimit(ctx, workspaceId, workspace.userId);
  if (usage.tier === "free" || usage.limit === -1 || !usage.limitReached)
    return;

  const notificationKey = `plan-limit:${createUsageCycleKey(usage)}`;
  const existing = await ctx.db
    .query("outreachNotifications")
    .withIndex("by_user_workspace_key", (q) =>
      q
        .eq("userId", workspace.userId)
        .eq("workspaceId", workspaceId)
        .eq("notificationKey", notificationKey)
    )
    .first();
  // Reading or dismissing a notification must never cause it to be sent again.
  if (existing) return;
  const useCase = getWorkspaceUseCase(workspace.useCaseKey);
  await createNotification(ctx, {
    userId: workspace.userId,
    workspaceId,
    notificationKey,
    type: "plan_limit_reached",
    title: `${useCase.entityPlural} limit reached`,
    message: `${workspace.name} has used ${usage.currentCount} of ${usage.limit} ${useCase.entityPlural.toLowerCase()} this cycle. Agent has paused ${getWorkspaceDiscoveryVerb(useCase.key)} new ${useCase.entityPlural.toLowerCase()}. Upgrade your plan or wait for the next cycle.`,
    targetHref: "/usage",
    actionLabel: "View usage",
  });
}
