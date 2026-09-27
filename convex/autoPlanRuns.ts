import { v } from "convex/values";
import { internalMutation, internalQuery } from "./lib/functionBuilders";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  AUTO_PLAN_MAX_RUNS_PER_RECOVERY_WINDOW,
  AUTO_PLAN_RECOVERY_FAILURE_CODES,
  AUTO_PLAN_RECOVERY_MAX_SCAN_ATTEMPTS,
  AUTO_PLAN_RECOVERY_SCAN_WINDOWS,
  buildAutoPlanFailureNotificationTitle,
  classifyAutoPlanFailure,
  hasAutoPlanRecoveryCapacity,
  isAutoPlanFailureRecoveryEligible,
} from "./lib/autoPlanCore";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { resolveProspectTwitterIdentity } from "../shared/lib/twitter/prospectTwitterIdentity";
import {
  getProspectDisplayFields,
  upsertNotificationByKey,
} from "./lib/notificationHelpers";
import { getProspectDisplayLabel } from "./lib/prospectIdentityCore";
import { isWorkspaceAutomationActive } from "./lib/workspaceSystem";
import { getWorkspaceWritingStyleContext } from "./lib/workspaceStyleProfileCore";

type AutoPlanRecoveryCandidate = {
  sourceRunId: Id<"autoPlanRuns">;
  prospectId: Id<"prospects">;
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
};

async function hasRecoveryCapacityForProspect(
  ctx: Pick<QueryCtx, "db">,
  prospectId: Id<"prospects">,
  now: number
): Promise<boolean> {
  const recentRuns = await ctx.db
    .query("autoPlanRuns")
    .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
    .order("desc")
    .take(AUTO_PLAN_MAX_RUNS_PER_RECOVERY_WINDOW);

  return hasAutoPlanRecoveryCapacity(
    recentRuns.map((run) => run._creationTime),
    now
  );
}

async function claimAutoPlanRecoveryRun(
  ctx: MutationCtx,
  args: {
    run: Doc<"autoPlanRuns">;
    now: number;
    expectedWorkspaceId?: Id<"workspaces">;
  }
): Promise<AutoPlanRecoveryCandidate | null> {
  const { run, now, expectedWorkspaceId } = args;
  const prospect = await ctx.db.get(run.prospectId);
  if (
    !prospect ||
    (expectedWorkspaceId && prospect.workspaceId !== expectedWorkspaceId) ||
    prospect.planGenerationStatus !== "failed"
  ) {
    return null;
  }

  const workspace = await ctx.db.get(prospect.workspaceId);
  if (!workspace || !isWorkspaceAutomationActive(workspace)) {
    return null;
  }

  if (run.errorCode === "writing_style_unavailable") {
    const styleContext = await getWorkspaceWritingStyleContext(ctx.db, {
      workspaceId: prospect.workspaceId,
      platform: prospect.platform === "linkedin" ? "linkedin" : "twitter",
    });
    if (styleContext.status !== "ready") {
      return null;
    }
  }

  const hasCapacity = await hasRecoveryCapacityForProspect(
    ctx,
    prospect._id,
    now
  );
  if (!hasCapacity) {
    await ctx.db.patch(run._id, {
      recoveryRetriedAt: now,
      recoveryExhaustedAt: now,
      updatedAt: now,
    });
    const displayFields = getProspectDisplayFields(prospect);
    const prospectLabel = getProspectDisplayLabel(prospect);
    await upsertNotificationByKey(ctx, {
      userId: prospect.userId,
      workspaceId: prospect.workspaceId,
      type: "error",
      title: buildAutoPlanFailureNotificationTitle(prospectLabel),
      message:
        "Automatic retries stopped after repeated failures. Try again from this profile after the issue is resolved.",
      notificationKey: `auto-plan-failed:${prospect._id}`,
      prospectId: prospect._id,
      ...displayFields,
    });
    return null;
  }

  await ctx.db.patch(run._id, { recoveryRetriedAt: now, updatedAt: now });
  return {
    sourceRunId: run._id,
    prospectId: prospect._id,
    workspaceId: prospect.workspaceId,
    userId: prospect.userId,
  };
}

export const markAutoPlanRunStarted = internalMutation({
  args: { runId: v.id("autoPlanRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (!run || run.status === "completed") {
      return null;
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(runId, {
      status: "running",
      attemptCount: run.attemptCount + 1,
      startedAt: run.startedAt ?? now,
      updatedAt: now,
    });
    return null;
  },
});

export const attachAutoPlanWorkId = internalMutation({
  args: {
    runId: v.id("autoPlanRuns"),
    workId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { runId, workId }) => {
    const run = await ctx.db.get(runId);
    if (!run || run.status !== "queued") {
      return null;
    }

    await ctx.db.patch(runId, {
      workId,
      updatedAt: getCurrentUTCTimestamp(),
    });
    return null;
  },
});

export const failAutoPlanRunToStart = internalMutation({
  args: {
    runId: v.id("autoPlanRuns"),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { runId, errorMessage }) => {
    const run = await ctx.db.get(runId);
    if (!run || run.status === "completed") {
      return null;
    }

    const now = getCurrentUTCTimestamp();
    const failure = classifyAutoPlanFailure(errorMessage);
    await ctx.db.patch(runId, {
      status: "failed",
      errorCode: failure.code,
      errorMessage,
      retryable: failure.retryable,
      completedAt: now,
      updatedAt: now,
    });

    const prospect = await ctx.db.get(run.prospectId);
    if (prospect) {
      await ctx.db.patch(prospect._id, {
        planGenerationStatus:
          prospect.status === "archived" ? "idle" : "failed",
        updatedAt: now,
      });
      const displayFields = getProspectDisplayFields(prospect);
      const prospectLabel = getProspectDisplayLabel(prospect);
      await upsertNotificationByKey(ctx, {
        userId: prospect.userId,
        workspaceId: prospect.workspaceId,
        type: "error",
        title: buildAutoPlanFailureNotificationTitle(prospectLabel),
        message: failure.userMessage,
        notificationKey: `auto-plan-failed:${prospect._id}`,
        targetHref: failure.targetHref,
        actionLabel: failure.actionLabel,
        prospectId: prospect._id,
        ...displayFields,
      });
    }
    return null;
  },
});

export const claimFailedAutoPlanRecoveryBatch = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const failedRuns = await ctx.db
      .query("autoPlanRuns")
      .withIndex("by_workspace_and_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "failed")
      )
      .order("desc")
      .take(Math.max(1, Math.min(args.limit * 3, 600)));
    const now = getCurrentUTCTimestamp();
    const claimed: AutoPlanRecoveryCandidate[] = [];
    const seenProspects = new Set<string>();

    for (const run of failedRuns) {
      if (
        claimed.length >= args.limit ||
        run.recoveryRetriedAt ||
        !isAutoPlanFailureRecoveryEligible(run.errorCode) ||
        seenProspects.has(String(run.prospectId))
      ) {
        continue;
      }
      seenProspects.add(String(run.prospectId));
      const candidate = await claimAutoPlanRecoveryRun(ctx, {
        run,
        now,
        expectedWorkspaceId: args.workspaceId,
      });
      if (candidate) claimed.push(candidate);
    }

    return claimed;
  },
});

export const claimFailedAutoPlanRecoveryBatchGlobal = internalMutation({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit, 100));
    const now = getCurrentUTCTimestamp();
    const claimed: AutoPlanRecoveryCandidate[] = [];
    const seenProspects = new Set<string>();
    const attemptedRunIds = new Set<string>();

    for (
      let window = 1;
      window <= AUTO_PLAN_RECOVERY_SCAN_WINDOWS;
      window += 1
    ) {
      const runsPerCode = await Promise.all(
        AUTO_PLAN_RECOVERY_FAILURE_CODES.map((errorCode) =>
          ctx.db
            .query("autoPlanRuns")
            .withIndex("by_status_error_and_recovery", (q) =>
              q
                .eq("status", "failed")
                .eq("errorCode", errorCode)
                .eq("recoveryRetriedAt", undefined)
            )
            .order("desc")
            .take(limit * window)
        )
      );
      const failedRuns = runsPerCode
        .flat()
        .sort((left, right) => right.updatedAt - left.updatedAt);

      for (const run of failedRuns) {
        if (
          claimed.length >= limit ||
          attemptedRunIds.size >= AUTO_PLAN_RECOVERY_MAX_SCAN_ATTEMPTS
        ) {
          break;
        }
        const runKey = String(run._id);
        if (attemptedRunIds.has(runKey)) {
          continue;
        }
        attemptedRunIds.add(runKey);
        if (
          !isAutoPlanFailureRecoveryEligible(run.errorCode) ||
          seenProspects.has(String(run.prospectId))
        ) {
          continue;
        }
        seenProspects.add(String(run.prospectId));
        const candidate = await claimAutoPlanRecoveryRun(ctx, { run, now });
        if (candidate) claimed.push(candidate);
      }

      if (
        claimed.length >= limit ||
        attemptedRunIds.size >= AUTO_PLAN_RECOVERY_MAX_SCAN_ATTEMPTS
      ) {
        break;
      }
      const hasUnscannedRuns = runsPerCode.some(
        (runs) => runs.length >= limit * window
      );
      if (!hasUnscannedRuns) {
        break;
      }
    }

    return claimed;
  },
});

const AUTO_PLAN_RECOVERY_PROBE_SCAN_LIMIT = 25;

type AutoPlanRecoveryProbeTarget = {
  prospectId: Id<"prospects">;
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
};

async function findAutoPlanRecoveryProbeTarget(
  ctx: Pick<QueryCtx, "db">,
  runs: Doc<"autoPlanRuns">[],
  examinedRunIds: Set<string>
): Promise<AutoPlanRecoveryProbeTarget | null> {
  const now = getCurrentUTCTimestamp();

  for (const run of runs) {
    if (examinedRunIds.size >= AUTO_PLAN_RECOVERY_MAX_SCAN_ATTEMPTS) {
      break;
    }
    if (examinedRunIds.has(String(run._id))) {
      continue;
    }
    examinedRunIds.add(String(run._id));
    const prospect = await ctx.db.get(run.prospectId);
    if (!prospect || prospect.planGenerationStatus !== "failed") {
      continue;
    }

    const workspace = await ctx.db.get(prospect.workspaceId);
    if (!workspace || !isWorkspaceAutomationActive(workspace)) {
      continue;
    }
    if (!(await hasRecoveryCapacityForProspect(ctx, prospect._id, now))) {
      continue;
    }
    if (run.errorCode === "writing_style_unavailable") {
      const styleContext = await getWorkspaceWritingStyleContext(ctx.db, {
        workspaceId: prospect.workspaceId,
        platform: prospect.platform === "linkedin" ? "linkedin" : "twitter",
      });
      if (styleContext.status !== "ready") {
        continue;
      }
    }
    if (prospect.platform !== "twitter") {
      continue;
    }
    const identity = resolveProspectTwitterIdentity(prospect);
    if (!identity.username && !identity.userId) {
      continue;
    }
    return {
      prospectId: prospect._id,
      workspaceId: prospect.workspaceId,
      userId: prospect.userId,
    };
  }

  return null;
}

export const getAutoPlanRecoveryProbeTarget = internalQuery({
  args: {},
  handler: async (ctx) => {
    const examinedRunIds = new Set<string>();

    for (
      let window = 1;
      window <= AUTO_PLAN_RECOVERY_SCAN_WINDOWS;
      window += 1
    ) {
      const runsPerCode = await Promise.all(
        AUTO_PLAN_RECOVERY_FAILURE_CODES.map((errorCode) =>
          ctx.db
            .query("autoPlanRuns")
            .withIndex("by_status_error_and_recovery", (q) =>
              q
                .eq("status", "failed")
                .eq("errorCode", errorCode)
                .eq("recoveryRetriedAt", undefined)
            )
            .order("desc")
            .take(AUTO_PLAN_RECOVERY_PROBE_SCAN_LIMIT * window)
        )
      );
      const runs = runsPerCode
        .flat()
        .sort((left, right) => right.updatedAt - left.updatedAt);

      const target = await findAutoPlanRecoveryProbeTarget(
        ctx,
        runs,
        examinedRunIds
      );
      if (target) {
        return target;
      }

      if (examinedRunIds.size >= AUTO_PLAN_RECOVERY_MAX_SCAN_ATTEMPTS) {
        break;
      }

      const hasUnscannedRuns = runsPerCode.some(
        (codeRuns) =>
          codeRuns.length >= AUTO_PLAN_RECOVERY_PROBE_SCAN_LIMIT * window
      );
      if (!hasUnscannedRuns) {
        break;
      }
    }

    return null;
  },
});

export const releaseFailedAutoPlanRecoveryClaim = internalMutation({
  args: { runId: v.id("autoPlanRuns") },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (!run || run.status !== "failed") {
      return null;
    }
    await ctx.db.patch(runId, {
      recoveryRetriedAt: undefined,
      updatedAt: getCurrentUTCTimestamp(),
    });
    return null;
  },
});
