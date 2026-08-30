import { v } from "convex/values";
import type { WorkflowId } from "@convex-dev/workflow";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../lib/functionBuilders";
import { workflow } from "../lib/workflow";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { shouldRecoverQualificationWorkflowStatusError } from "../lib/qualificationFailureCore";

export const QUALIFICATION_STALE_PENDING_MS = 15 * 60 * 1000;
const QUALIFICATION_RECOVERY_BATCH_SIZE = 25;

const recoveryResultValidator = v.object({
  checked: v.number(),
  active: v.number(),
  scheduled: v.number(),
  leasesCleared: v.number(),
  notDue: v.number(),
  skipped: v.number(),
  statusErrors: v.number(),
});

type RecoveryResult = {
  checked: number;
  active: number;
  scheduled: number;
  leasesCleared: number;
  notDue: number;
  skipped: number;
  statusErrors: number;
};

async function recoverStalePendingQualifications(
  ctx: ActionCtx,
  limit: number
): Promise<RecoveryResult> {
  const now = getCurrentUTCTimestamp();
  const candidates = await ctx.runQuery(
    internal.prospects.listStalePendingQualificationCandidatesInternal,
    {
      cutoff: now - QUALIFICATION_STALE_PENDING_MS,
      limit,
    }
  );

  const outcomes = await Promise.all(
    candidates.map(async (candidate) => {
      if (candidate.qualificationWorkflowId) {
        try {
          const status = await workflow.status(
            ctx,
            candidate.qualificationWorkflowId as WorkflowId
          );
          if (status.type === "inProgress") {
            return "active" as const;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const shouldRecover = shouldRecoverQualificationWorkflowStatusError({
            errorMessage,
            leaseUpdatedAt: candidate.updatedAt,
            now,
          });
          console.warn(
            "[QualificationRecovery] Unable to read workflow status",
            {
              prospectId: String(candidate.prospectId),
              workflowId: candidate.qualificationWorkflowId,
              error: errorMessage,
              shouldRecover,
            }
          );
          if (!shouldRecover) {
            return "status_error" as const;
          }
        }
      }

      const claim = await ctx.runMutation(
        internal.prospects.claimPendingQualificationRecoveryInternal,
        {
          prospectId: candidate.prospectId,
          expectedUpdatedAt: candidate.updatedAt,
          expectedWorkflowId: candidate.qualificationWorkflowId,
          expectedFailureAt: candidate.qualificationLastFailure?.failedAt,
          now,
        }
      );
      if (claim.scheduled) {
        return "scheduled" as const;
      }
      if (claim.reason === "lease_cleared") {
        return "lease_cleared" as const;
      }
      if (claim.reason === "not_due") {
        return "not_due" as const;
      }
      return "skipped" as const;
    })
  );

  return {
    checked: candidates.length,
    active: outcomes.filter((outcome) => outcome === "active").length,
    scheduled: outcomes.filter((outcome) => outcome === "scheduled").length,
    leasesCleared: outcomes.filter((outcome) => outcome === "lease_cleared")
      .length,
    notDue: outcomes.filter((outcome) => outcome === "not_due").length,
    skipped: outcomes.filter((outcome) => outcome === "skipped").length,
    statusErrors: outcomes.filter((outcome) => outcome === "status_error")
      .length,
  };
}

/** Bounded operational entry point for a release canary or manual recovery. */
export const recoverStalePendingQualificationsInternal = internalAction({
  args: { limit: v.optional(v.number()) },
  returns: recoveryResultValidator,
  handler: async (ctx, args) =>
    await recoverStalePendingQualifications(
      ctx,
      Math.max(
        1,
        Math.min(
          Math.floor(args.limit ?? QUALIFICATION_RECOVERY_BATCH_SIZE),
          QUALIFICATION_RECOVERY_BATCH_SIZE
        )
      )
    ),
});

export const recoverStalePendingQualificationsCron = internalAction({
  args: {},
  returns: recoveryResultValidator,
  handler: async (ctx) =>
    await recoverStalePendingQualifications(
      ctx,
      QUALIFICATION_RECOVERY_BATCH_SIZE
    ),
});
