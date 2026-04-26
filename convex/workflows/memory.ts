import { v } from "convex/values";
import { vOnCompleteArgs } from "@convex-dev/workpool";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import { internalAction, internalMutation } from "../lib/functionBuilders";
import { memoryEvaluationPool } from "../lib/memoryEvaluationPool";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";

type MemoryEvaluationEnqueueReason =
  | "missing_event"
  | "no_pending"
  | "queued"
  | "running";

type MemoryEvaluationEnqueueResult =
  | { enqueued: true; workId: string }
  | { enqueued: false; reason: MemoryEvaluationEnqueueReason };

type MemoryEvaluationProcessResult =
  | {
      status: "completed" | "ignored";
      runId: Id<"memoryEvaluatorRuns">;
    }
  | {
      status: "failed";
      runId: Id<"memoryEvaluatorRuns">;
      error: string;
    }
  | {
      status: "skipped";
      reason: string;
      error?: string;
    };

type MemoryEvaluationQueueRunResult =
  | MemoryEvaluationProcessResult
  | { status: "idle" };

async function getWorkspaceQueueRow(
  ctx: Pick<MutationCtx, "db">,
  workspaceId: Id<"workspaces">
) {
  return await ctx.db
    .query("memoryEvaluationWorkspaceQueues")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .first();
}

async function enqueueWorkspaceMemoryEvaluation(
  ctx: ActionCtx,
  workspaceId: Id<"workspaces">
): Promise<MemoryEvaluationEnqueueResult> {
  const prepared: {
    shouldEnqueue: boolean;
    reason: "no_pending" | "queued" | "running";
  } = await ctx.runMutation(
    internal.workflows.memory.prepareMemoryEvaluationQueueEnqueueInternal,
    {
      workspaceId,
    }
  );
  if (!prepared.shouldEnqueue) {
    return {
      enqueued: false as const,
      reason: prepared.reason,
    };
  }

  const workId: string = await memoryEvaluationPool.enqueueAction(
    ctx,
    internal.workflows.memory.runQueuedWorkspaceMemoryEvaluationInternal,
    {
      workspaceId,
    },
    {
      onComplete:
        internal.workflows.memory
          .handleMemoryEvaluationQueueWorkCompletionInternal,
      context: { workspaceId },
    }
  );

  await ctx.runMutation(
    internal.workflows.memory.setMemoryEvaluationQueueWorkIdInternal,
    {
      workspaceId,
      workId: String(workId),
    }
  );

  return {
    enqueued: true as const,
    workId: String(workId),
  };
}

async function processMemoryWorkflowEvent(
  ctx: ActionCtx,
  args: {
    eventId: Id<"memoryWorkflowEvents">;
    workId: string;
  }
): Promise<MemoryEvaluationProcessResult> {
  const claim:
    | { status: "missing" | "terminal" | "failed" }
    | { status: "already_processing"; workflowId?: string }
    | { status: "claimed"; runId?: Id<"memoryEvaluatorRuns"> } =
    await ctx.runMutation(
      internal.evaluator.claimMemoryWorkflowEventForEvaluationInternal,
      {
        eventId: args.eventId,
        workflowId: args.workId,
      }
    );

  if (claim.status !== "claimed" || !claim.runId) {
    return {
      status: "skipped" as const,
      reason: claim.status,
      error:
        claim.status === "failed"
          ? "Memory workflow event is already marked failed."
          : undefined,
    };
  }

  const runId = claim.runId as Id<"memoryEvaluatorRuns">;

  try {
    const plan = await ctx.runAction(
      internal.evaluator.buildMemoryEvaluationPlanInternal,
      {
        eventId: args.eventId,
      }
    );

    if (plan.status === "ignored") {
      await ctx.runMutation(
        internal.evaluator.finalizeMemoryEvaluatorRunInternal,
        {
          runId,
          eventId: args.eventId,
          status: "ignored",
          promptVersion: plan.promptVersion,
          model: plan.model,
          summary: plan.summary,
          ignoredReason: plan.ignoredReason,
          retrievalStats: plan.retrievalStats,
          promotedMemoryIds: [],
          suggestionIds: [],
          promotedMemoryCount: 0,
          suggestedMemoryCount: 0,
          queryPerformanceUpdateCount: 0,
        }
      );

      return {
        status: "ignored" as const,
        runId,
      };
    }

    if (!plan.workspaceId) {
      throw new Error("Memory evaluation plan is missing workspace context");
    }

    const applied = await ctx.runMutation(
      internal.evaluator.applyMemoryEvaluationPlanInternal,
      {
        runId,
        eventId: args.eventId,
        workspaceId: plan.workspaceId as Id<"workspaces">,
        promptVersion: plan.promptVersion,
        model: plan.model,
        summary: plan.summary,
        drafts: plan.drafts,
        queryPerformanceUpdates: plan.queryPerformanceUpdates,
        retrievalStats: plan.retrievalStats,
        telemetryRequest: plan.telemetry?.request,
        telemetryResponse: plan.telemetry?.response,
        telemetryProviderMetadata: plan.telemetry?.providerMetadata,
        telemetryUsage: plan.telemetry?.usage,
        styleMetadata: plan.styleMetadata,
      }
    );

    await ctx.runMutation(
      internal.evaluator.finalizeMemoryEvaluatorRunInternal,
      {
        runId,
        eventId: args.eventId,
        status: "completed",
        promptVersion: plan.promptVersion,
        model: plan.model,
        summary: plan.summary,
        promotedMemoryIds: applied.promotedMemoryIds,
        suggestionIds: applied.suggestionIds,
        promotedMemoryCount: applied.promotedMemoryCount,
        suggestedMemoryCount: applied.suggestedMemoryCount,
        queryPerformanceUpdateCount: applied.queryPerformanceUpdateCount,
        retrievalStats: plan.retrievalStats,
      }
    );

    return {
      status: "completed" as const,
      runId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown memory evaluator error";

    await ctx.runMutation(
      internal.evaluator.finalizeMemoryEvaluatorRunInternal,
      {
        runId,
        eventId: args.eventId,
        status: "failed",
        error: message,
      }
    );

    return {
      status: "failed" as const,
      runId,
      error: message,
    };
  }
}

export const prepareMemoryEvaluationQueueEnqueueInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const queue = await getWorkspaceQueueRow(ctx, workspaceId);
    const nextPending = await ctx.db
      .query("memoryWorkflowEvents")
      .withIndex("by_workspace_status_occurred_at", (q) =>
        q.eq("workspaceId", workspaceId).eq("status", "pending")
      )
      .first();

    const now = getCurrentUTCTimestamp();

    if (!nextPending) {
      if (queue && queue.status !== "idle") {
        await ctx.db.patch(queue._id, {
          status: "idle",
          workId: undefined,
          activeEventId: undefined,
          updatedAt: now,
          lastFinishedAt: now,
        });
      }

      return {
        shouldEnqueue: false as const,
        reason: "no_pending" as const,
      };
    }

    if (queue && (queue.status === "queued" || queue.status === "running")) {
      return {
        shouldEnqueue: false as const,
        reason: queue.status,
      };
    }

    if (queue) {
      await ctx.db.patch(queue._id, {
        status: "queued",
        activeEventId: undefined,
        lastError: undefined,
        lastEnqueuedAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("memoryEvaluationWorkspaceQueues", {
        workspaceId,
        status: "queued",
        workId: undefined,
        activeEventId: undefined,
        lastError: undefined,
        lastEnqueuedAt: now,
        lastStartedAt: undefined,
        lastFinishedAt: undefined,
        updatedAt: now,
      });
    }

    return {
      shouldEnqueue: true as const,
      reason: "queued" as const,
    };
  },
});

export const setMemoryEvaluationQueueWorkIdInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    workId: v.string(),
  },
  handler: async (ctx, { workspaceId, workId }) => {
    const queue = await getWorkspaceQueueRow(ctx, workspaceId);
    const now = getCurrentUTCTimestamp();

    if (!queue) {
      await ctx.db.insert("memoryEvaluationWorkspaceQueues", {
        workspaceId,
        status: "queued",
        workId,
        activeEventId: undefined,
        lastError: undefined,
        lastEnqueuedAt: now,
        lastStartedAt: undefined,
        lastFinishedAt: undefined,
        updatedAt: now,
      });
      return;
    }

    await ctx.db.patch(queue._id, {
      status: "queued",
      workId,
      updatedAt: now,
    });
  },
});

export const beginMemoryEvaluationQueueWorkInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const queue = await getWorkspaceQueueRow(ctx, workspaceId);
    if (!queue) {
      return {
        eventId: null,
        workId: null,
      };
    }

    const now = getCurrentUTCTimestamp();

    if (queue.status === "running" && queue.activeEventId && queue.workId) {
      return {
        eventId: queue.activeEventId,
        workId: queue.workId,
      };
    }

    const nextPending = await ctx.db
      .query("memoryWorkflowEvents")
      .withIndex("by_workspace_status_occurred_at", (q) =>
        q.eq("workspaceId", workspaceId).eq("status", "pending")
      )
      .first();

    if (!nextPending) {
      await ctx.db.patch(queue._id, {
        status: "idle",
        workId: undefined,
        activeEventId: undefined,
        updatedAt: now,
        lastFinishedAt: now,
      });

      return {
        eventId: null,
        workId: null,
      };
    }

    const workId =
      queue.workId ?? `memory-eval:${workspaceId}:${nextPending._id}`;

    await ctx.db.patch(queue._id, {
      status: "running",
      workId,
      activeEventId: nextPending._id,
      updatedAt: now,
      lastStartedAt: now,
    });

    return {
      eventId: nextPending._id,
      workId,
    };
  },
});

export const completeMemoryEvaluationQueueWorkInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    workId: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { workspaceId, workId, error }) => {
    const queue = await getWorkspaceQueueRow(ctx, workspaceId);
    if (!queue || queue.workId !== workId) {
      return {
        cleared: false as const,
        hasMorePending: false,
      };
    }

    const now = getCurrentUTCTimestamp();

    await ctx.db.patch(queue._id, {
      status: "idle",
      workId: undefined,
      activeEventId: undefined,
      lastError: error,
      updatedAt: now,
      lastFinishedAt: now,
    });

    const hasMorePending = Boolean(
      await ctx.db
        .query("memoryWorkflowEvents")
        .withIndex("by_workspace_status_occurred_at", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", "pending")
        )
        .first()
    );

    return {
      cleared: true as const,
      hasMorePending,
    };
  },
});

export const handleMemoryEvaluationQueueWorkCompletionInternal =
  internalMutation({
    args: vOnCompleteArgs(
      v.object({
        workspaceId: v.id("workspaces"),
      })
    ),
    handler: async (ctx, args) => {
      const workspaceId = args.context.workspaceId;
      const queue = await getWorkspaceQueueRow(ctx, workspaceId);
      if (!queue || queue.workId !== args.workId) {
        return { recovered: false as const };
      }

      const now = getCurrentUTCTimestamp();

      if (args.result.kind !== "success" && queue.activeEventId) {
        const activeEventId = queue.activeEventId;
        const event = await ctx.db.get(activeEventId);
        if (
          event &&
          event.status === "processing" &&
          event.evaluatorWorkflowId === args.workId
        ) {
          await ctx.db.patch(event._id, {
            status: "pending",
            evaluatorWorkflowId: undefined,
            processedAt: undefined,
            error:
              args.result.kind === "failed" ? args.result.error : "Canceled",
          });
        }

        const existingRun = await ctx.db
          .query("memoryEvaluatorRuns")
          .withIndex("by_event", (q) => q.eq("eventId", activeEventId))
          .first();
        if (existingRun && existingRun.workflowId === args.workId) {
          await ctx.db.patch(existingRun._id, {
            status: "failed",
            error:
              args.result.kind === "failed" ? args.result.error : "Canceled",
            updatedAt: now,
          });
        }
      }

      const hasMorePending = Boolean(
        await ctx.db
          .query("memoryWorkflowEvents")
          .withIndex("by_workspace_status_occurred_at", (q) =>
            q.eq("workspaceId", workspaceId).eq("status", "pending")
          )
          .first()
      );

      await ctx.db.patch(queue._id, {
        status: "idle",
        workId: undefined,
        activeEventId: undefined,
        lastError:
          args.result.kind === "failed" ? args.result.error : queue.lastError,
        updatedAt: now,
        lastFinishedAt: now,
      });

      if (hasMorePending) {
        await ctx.scheduler.runAfter(
          0,
          internal.workflows.memory.enqueueWorkspaceMemoryEvaluationInternal,
          {
            workspaceId,
          }
        );
      }

      return { recovered: true as const };
    },
  });

export const runQueuedWorkspaceMemoryEvaluationInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (
    ctx,
    { workspaceId }
  ): Promise<MemoryEvaluationQueueRunResult> => {
    const queueWork = await ctx.runMutation(
      internal.workflows.memory.beginMemoryEvaluationQueueWorkInternal,
      {
        workspaceId,
      }
    );

    if (!queueWork.eventId || !queueWork.workId) {
      return {
        status: "idle" as const,
      };
    }

    const result = await processMemoryWorkflowEvent(ctx, {
      eventId: queueWork.eventId,
      workId: queueWork.workId,
    });

    const completion = await ctx.runMutation(
      internal.workflows.memory.completeMemoryEvaluationQueueWorkInternal,
      {
        workspaceId,
        workId: queueWork.workId,
        error: "error" in result ? result.error : undefined,
      }
    );

    if (completion.hasMorePending) {
      await enqueueWorkspaceMemoryEvaluation(ctx, workspaceId);
    }

    return result;
  },
});

export const enqueueWorkspaceMemoryEvaluationInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (
    ctx,
    { workspaceId }
  ): Promise<MemoryEvaluationEnqueueResult> => {
    return await enqueueWorkspaceMemoryEvaluation(ctx, workspaceId);
  },
});

export const startMemoryEvaluationWorkflowInternal = internalAction({
  args: {
    eventId: v.id("memoryWorkflowEvents"),
  },
  handler: async (ctx, { eventId }): Promise<MemoryEvaluationEnqueueResult> => {
    const event = (await ctx.runQuery(
      internal.evaluator.getMemoryWorkflowEventByIdInternal,
      {
        eventId,
      }
    )) as Doc<"memoryWorkflowEvents"> | null;

    if (!event) {
      return {
        enqueued: false as const,
        reason: "missing_event" as const,
      };
    }

    return await enqueueWorkspaceMemoryEvaluation(ctx, event.workspaceId);
  },
});
