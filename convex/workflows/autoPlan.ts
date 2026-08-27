import { vOnCompleteArgs } from "@convex-dev/workpool";
import { internalMutation } from "../lib/functionBuilders";
import { getProspectActivePlan } from "../lib/outreachCore";
import {
  dismissNotificationsByKey,
  getProspectDisplayFields,
  upsertNotificationByKey,
} from "../lib/notificationHelpers";
import {
  buildAutoPlanFailureNotificationTitle,
  classifyAutoPlanFailure,
} from "../lib/autoPlanCore";
import { getProspectDisplayLabel } from "../lib/prospectIdentityCore";
import { autoPlanWorkCompletionContextValidator } from "../validators";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { completeTenantJob } from "../lib/tenantSchedulerHelpers";

function buildAutoPlanFailureNotificationKey(prospectId: string) {
  return `auto-plan-failed:${prospectId}`;
}

export const handleAutoPlanWorkComplete = internalMutation({
  args: vOnCompleteArgs(autoPlanWorkCompletionContextValidator),
  handler: async (ctx, args) => {
    const tenantJobId = args.context.tenantJobId;
    const [prospect, run] = await Promise.all([
      ctx.db.get(args.context.prospectId),
      ctx.db.get(args.context.runId),
    ]);
    if (!prospect || !run || run.status === "completed") {
      if (tenantJobId) {
        await completeTenantJob(ctx, {
          jobId: tenantJobId,
          status: run?.status === "completed" ? "succeeded" : "failed",
          errorMessage:
            run?.status === "completed"
              ? undefined
              : "Automatic plan state was missing",
        });
      }
      return null;
    }

    const persistedPlan = await getProspectActivePlan(ctx, prospect._id);
    const hasPersistedPlan = Boolean(
      persistedPlan && persistedPlan.tasks.length > 0
    );
    const completed = args.result.kind === "success" && hasPersistedPlan;
    const now = getCurrentUTCTimestamp();
    const notificationKey = buildAutoPlanFailureNotificationKey(prospect._id);

    if (completed && persistedPlan) {
      await Promise.all([
        ctx.db.patch(run._id, {
          status: "completed",
          planId: persistedPlan.plan._id,
          threadId: persistedPlan.plan.threadId,
          errorCode: undefined,
          errorMessage: undefined,
          retryable: undefined,
          completedAt: now,
          updatedAt: now,
        }),
        ctx.db.patch(prospect._id, {
          planGenerationStatus: "completed",
          updatedAt: now,
        }),
        dismissNotificationsByKey(ctx, {
          userId: prospect.userId,
          workspaceId: prospect.workspaceId,
          notificationKey,
        }),
      ]);
      if (tenantJobId) {
        await completeTenantJob(ctx, {
          jobId: tenantJobId,
          status: "succeeded",
        });
      }
      return null;
    }

    const errorMessage =
      args.result.kind === "failed"
        ? args.result.error
        : args.result.kind === "canceled"
          ? "Automatic planning was canceled"
          : "Automatic planning completed without a persisted plan and tasks";
    const failure = classifyAutoPlanFailure(errorMessage);
    const displayFields = getProspectDisplayFields(prospect);
    const prospectName = getProspectDisplayLabel(prospect);

    await Promise.all([
      ctx.db.patch(run._id, {
        status: "failed",
        errorCode: failure.code,
        errorMessage,
        retryable: failure.retryable,
        completedAt: now,
        updatedAt: now,
      }),
      ctx.db.patch(prospect._id, {
        planGenerationStatus:
          prospect.status === "archived" ? "idle" : "failed",
        updatedAt: now,
      }),
      upsertNotificationByKey(ctx, {
        userId: prospect.userId,
        workspaceId: prospect.workspaceId,
        type: "error",
        title: buildAutoPlanFailureNotificationTitle(prospectName),
        message: failure.userMessage,
        notificationKey,
        targetHref: failure.targetHref,
        actionLabel: failure.actionLabel,
        prospectId: prospect._id,
        ...displayFields,
      }),
    ]);

    console.error("[AutoPlanWorkpool] Automatic plan generation failed", {
      workId: String(args.workId),
      runId: String(run._id),
      prospectId: String(prospect._id),
      errorCode: failure.code,
      error: errorMessage,
    });

    if (tenantJobId) {
      await completeTenantJob(ctx, {
        jobId: tenantJobId,
        status: args.result.kind === "canceled" ? "cancelled" : "failed",
        errorMessage,
      });
    }

    return null;
  },
});
