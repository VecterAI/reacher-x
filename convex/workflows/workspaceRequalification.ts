import { isUnresolvableWorkflowReferenceError } from "../lib/qualificationFailureCore";
import { getLearningTargetingFingerprint } from "../lib/learningTargetingHelpers";
import { vWorkflowId, type WorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import { parse } from "convex-helpers/validators";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { isRecord } from "../lib/typeGuards";
import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery } from "../lib/functionBuilders";
import { workflow } from "../lib/workflow";
import {
  MAX_REQUALIFICATION_PROSPECTS,
  assertWorkspaceRequalificationReady,
  getRequalificationSkipReason,
} from "../lib/workspaceRequalificationCore";
import {
  requalificationReadinessValidator,
  requalificationPageValidator,
  requalificationResultValidator,
} from "../validators";

/** Read-only, bounded preview. Engaged/archived prospects require a separate audit. */
export const previewPageInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    targetingFingerprint: v.string(),
    cursor: v.union(v.string(), v.null()),
  },
  returns: requalificationPageValidator,
  handler: async (
    ctx,
    args
  ): Promise<Infer<typeof requalificationPageValidator>> => {
    assertWorkspaceRequalificationReady(
      await ctx.db.get(args.workspaceId),
      args.targetingFingerprint
    );
    const page = await ctx.db
      .query("prospects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .paginate({ numItems: 25, cursor: args.cursor });
    const items = await Promise.all(
      page.page.map(async (prospect) => {
        const plan = await ctx.db
          .query("outreachPlans")
          .withIndex("by_prospect", (q) => q.eq("prospectId", prospect._id))
          .first();
        return {
          prospectId: prospect._id,
          skipReason: getRequalificationSkipReason(
            prospect,
            args.targetingFingerprint,
            plan !== null
          ),
        };
      })
    );
    return { items, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

export const resetProspectInternal = internalMutation({
  args: {
    workflowId: v.string(),
    workspaceId: v.id("workspaces"),
    prospectId: v.id("prospects"),
    targetingFingerprint: v.string(),
  },
  returns: v.object({
    reset: v.boolean(),
    skipReason: v.union(v.string(), v.null()),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{ reset: boolean; skipReason: string | null }> => {
    const workspace = assertWorkspaceRequalificationReady(
      await ctx.db.get(args.workspaceId),
      args.targetingFingerprint
    );
    if (workspace.requalificationWorkflowId !== args.workflowId)
      throw new Error("Requalification run is no longer active");
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect || prospect.workspaceId !== args.workspaceId)
      throw new Error("Prospect workspace mismatch");
    const plan = await ctx.db
      .query("outreachPlans")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospect._id))
      .first();
    const skipReason = getRequalificationSkipReason(
      prospect,
      args.targetingFingerprint,
      plan !== null
    );
    if (skipReason) return { reset: false, skipReason };
    const result = await ctx.runMutation(
      internal.prospects.updateProspectQualification,
      {
        prospectId: prospect._id,
        expectedTargetingFingerprint: args.targetingFingerprint,
        qualificationStatus: "pending",
        qualificationScore: 0,
      }
    );
    if (!result.skipped) {
      // Reserve the prospect before starting the nested workflow so ordinary
      // qualification starters observe an active workflow during the handoff.
      await ctx.db.patch(prospect._id, {
        qualificationWorkflowId: args.workflowId,
      });
    }
    return {
      reset: !result.skipped,
      skipReason: result.skipped ? "source_changed" : null,
    };
  },
});

export const workspaceRequalificationWorkflow = workflow.define({
  args: {
    workspaceId: v.id("workspaces"),
    targetingFingerprint: v.string(),
    dryRun: v.boolean(),
    maxProspects: v.number(),
    cursor: v.optional(v.string()),
  },
  returns: requalificationResultValidator,
  handler: async (
    step,
    args
  ): Promise<Infer<typeof requalificationResultValidator>> => {
    let cursor: string | null = args.cursor ?? null;
    let scanned = 0,
      eligible = 0,
      completed = 0,
      skipped = 0,
      failed = 0;
    let done = false;
    while (!done && scanned < MAX_REQUALIFICATION_PROSPECTS) {
      const page: Infer<typeof requalificationPageValidator> =
        await step.runQuery(
          internal.workflows.workspaceRequalification.previewPageInternal,
          {
            workspaceId: args.workspaceId,
            targetingFingerprint: args.targetingFingerprint,
            cursor,
          }
        );
      for (const item of page.items) {
        scanned++;
        if (item.skipReason) {
          skipped++;
          continue;
        }
        eligible++;
        if (args.dryRun) continue;
        if (eligible > args.maxProspects)
          throw new Error(
            "Requalification scope grew beyond the reviewed limit; run a new dry run"
          );
        const reset = await step.runMutation(
          internal.workflows.workspaceRequalification.resetProspectInternal,
          {
            workflowId: String(step.workflowId),
            workspaceId: args.workspaceId,
            prospectId: item.prospectId,
            targetingFingerprint: args.targetingFingerprint,
          }
        );
        if (!reset.reset) {
          skipped++;
          continue;
        }
        const result: unknown = await step.runWorkflow(
          internal.workflows.qualification.qualificationWorkflow,
          {
            workspaceId: args.workspaceId,
            prospectId: item.prospectId,
            skipEnrichment: true,
            expectedTargetingFingerprint: args.targetingFingerprint,
          }
        );
        if (isRecord(result) && result.success === true && !result.skipped)
          completed++;
        else failed++;
      }
      cursor = page.continueCursor;
      done = page.isDone;
    }
    return {
      isDone: done,
      continueCursor: done ? null : cursor,
      scanned,
      eligible,
      completed,
      skipped,
      failed,
      dryRun: args.dryRun,
    };
  },
});

export const startInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    targetingFingerprint: v.string(),
    dryRun: v.boolean(),
    maxProspects: v.number(),
    cursor: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const workspace = assertWorkspaceRequalificationReady(
      await ctx.db.get(args.workspaceId),
      args.targetingFingerprint
    );
    if (workspace.requalificationWorkflowId) {
      throw new Error(
        "A requalification run is already active; inspect or cancel it before starting another"
      );
    }
    if (
      !Number.isSafeInteger(args.maxProspects) ||
      args.maxProspects < 1 ||
      args.maxProspects > MAX_REQUALIFICATION_PROSPECTS
    )
      throw new Error("maxProspects must be an integer between 1 and 1000");
    if (
      !args.dryRun &&
      (workspace.lastRequalificationResult?.dryRun !== true ||
        workspace.lastRequalificationResult.isDone === undefined ||
        workspace.lastRequalificationStartCursor !== args.cursor ||
        workspace.lastRequalificationTargetingFingerprint !==
          args.targetingFingerprint)
    )
      throw new Error(
        "Complete and inspect a dry run for this targeting before applying requalification"
      );
    if (
      !args.dryRun &&
      workspace.lastRequalificationResult!.eligible > args.maxProspects
    )
      throw new Error(
        "Dry-run eligible count exceeds maxProspects; review the scope before applying requalification"
      );
    if (workspace.prospectingWorkflowId) {
      let inProgress = false;
      try {
        const status = await workflow.status(
          ctx,
          workspace.prospectingWorkflowId as WorkflowId
        );
        inProgress = status.type === "inProgress";
      } catch (error) {
        if (
          !isUnresolvableWorkflowReferenceError(
            error instanceof Error ? error.message : String(error)
          )
        )
          throw error;
      }
      if (inProgress)
        throw new Error("Drain the discovery workflow before requalification");
    }
    const id = await workflow.start(
      ctx,
      internal.workflows.workspaceRequalification
        .workspaceRequalificationWorkflow,
      args,
      {
        onComplete:
          internal.workflows.workspaceRequalification.handleCompleteInternal,
        context: {
          workspaceId: args.workspaceId,
          targetingFingerprint: args.targetingFingerprint,
          cursor: args.cursor,
        },
      }
    );
    await ctx.db.patch(workspace._id, {
      requalificationWorkflowId: String(id),
      lastRequalificationError: undefined,
    });
    return String(id);
  },
});

export const handleCompleteInternal = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({
      workspaceId: v.id("workspaces"),
      targetingFingerprint: v.string(),
      cursor: v.optional(v.string()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.context.workspaceId);
    if (
      !workspace ||
      workspace.requalificationWorkflowId !== String(args.workflowId)
    )
      return null;
    await ctx.db.patch(workspace._id, {
      requalificationWorkflowId: undefined,
      lastRequalificationCompletedAt: getCurrentUTCTimestamp(),
      lastRequalificationTargetingFingerprint:
        args.context.targetingFingerprint,
      lastRequalificationStartCursor: args.context.cursor,
      lastRequalificationResult:
        args.result.kind === "success"
          ? parse(requalificationResultValidator, args.result.returnValue)
          : undefined,
      lastRequalificationError:
        args.result.kind === "failed"
          ? args.result.error
          : args.result.kind === "canceled"
            ? "Requalification was canceled"
            : undefined,
    });
    return null;
  },
});

export const getReadinessInternal = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  returns: requalificationReadinessValidator,
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");
    return {
      targetingFingerprint: getLearningTargetingFingerprint(workspace),
      prospectingStatus: workspace.prospectingWorkflowStatus,
      activeWorkflowId: workspace.requalificationWorkflowId,
      lastResult: workspace.lastRequalificationResult,
      lastError: workspace.lastRequalificationError,
    };
  },
});
