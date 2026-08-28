import { v } from "convex/values";
import { vOnCompleteArgs, type WorkId } from "@convex-dev/workpool";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import { internalAction, internalMutation } from "../lib/functionBuilders";
import { memoryEvaluationPool } from "../lib/memoryEvaluationPool";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { TENANT_JOB_PRIORITY } from "../lib/tenantSchedulerCore";
import { enqueueTenantJobWithRetry } from "../lib/tenantSchedulerEnqueue";
import { completeTenantJob } from "../lib/tenantSchedulerHelpers";
import {
  isMemoryEvaluationLegacyWorkStale,
  isPriorityMemoryEvaluationEvent,
  MEMORY_EVALUATION_PRIORITY_SCAN_LIMIT,
} from "../lib/memoryEvaluationQueueCore";

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

async function getNextPendingMemoryWorkflowEvent(
  ctx: Pick<MutationCtx, "db">,
  workspaceId: Id<"workspaces">
) {
  const recentStyleEvents = await ctx.db
    .query("memoryWorkflowEvents")
    .withIndex("by_workspace_event_type_occurred_at", (q) =>
      q
        .eq("workspaceId", workspaceId)
        .eq("eventType", "style_content_backfill_completed")
    )
    .order("desc")
    .take(MEMORY_EVALUATION_PRIORITY_SCAN_LIMIT);
  const priorityEvent = recentStyleEvents.find(isPriorityMemoryEvaluationEvent);
  if (priorityEvent) return priorityEvent;

  return await ctx.db
    .query("memoryWorkflowEvents")
    .withIndex("by_workspace_status_occurred_at", (q) =>
      q.eq("workspaceId", workspaceId).eq("status", "pending")
    )
    .first();
}

async function getMemoryEvaluationQueueWorkState(
  ctx: Pick<MutationCtx, "db">,
  queue: Doc<"memoryEvaluationWorkspaceQueues">,
  now: number
): Promise<"active" | "stale" | "unattached"> {
  if (!queue.workId) {
    return queue.status === "running" ? "stale" : "unattached";
  }

  if (queue.status === "idle") {
    return "stale";
  }

  const tenantJobId = ctx.db.normalizeId("tenantJobs", queue.workId);
  if (tenantJobId) {
    const tenantJob = await ctx.db.get("tenantJobs", tenantJobId);
    return tenantJob?.status === "queued" || tenantJob?.status === "running"
      ? "active"
      : "stale";
  }

  return isMemoryEvaluationLegacyWorkStale({
    queueUpdatedAt: queue.updatedAt,
    now,
  })
    ? "stale"
    : "active";
}

async function recoverStaleMemoryEvaluationQueue(
  ctx: MutationCtx,
  queue: Doc<"memoryEvaluationWorkspaceQueues">,
  now: number,
  enqueueToken: number
) {
  if (queue.workId && !ctx.db.normalizeId("tenantJobs", queue.workId)) {
    try {
      await memoryEvaluationPool.cancel(ctx, queue.workId as WorkId);
    } catch (error) {
      console.warn(
        "[MemoryEvaluationQueue] Stale pool work cancellation failed",
        {
          workspaceId: String(queue.workspaceId),
          workId: queue.workId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  if (queue.activeEventId) {
    const event = await ctx.db.get("memoryWorkflowEvents", queue.activeEventId);
    if (
      event?.status === "processing" &&
      event.evaluatorWorkflowId === queue.workId
    ) {
      await ctx.db.patch("memoryWorkflowEvents", event._id, {
        status: "pending",
        evaluatorWorkflowId: undefined,
        processedAt: undefined,
        error: "Recovered after stale memory evaluation queue work",
      });

      const evaluatorRun = await ctx.db
        .query("memoryEvaluatorRuns")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .first();
      if (
        evaluatorRun?.status === "running" &&
        evaluatorRun.workflowId === queue.workId
      ) {
        await ctx.db.patch("memoryEvaluatorRuns", evaluatorRun._id, {
          status: "failed",
          error: "Recovered after stale memory evaluation queue work",
          updatedAt: now,
        });
      }
    }
  }

  console.warn("[MemoryEvaluationQueue] Recovered stale queue work", {
    workspaceId: String(queue.workspaceId),
    queueStatus: queue.status,
    workId: queue.workId,
    activeEventId: queue.activeEventId
      ? String(queue.activeEventId)
      : undefined,
    queueUpdatedAt: queue.updatedAt,
  });

  await ctx.db.patch("memoryEvaluationWorkspaceQueues", queue._id, {
    status: "queued",
    workId: undefined,
    activeEventId: undefined,
    lastError: "Recovered stale memory evaluation queue work",
    lastEnqueuedAt: enqueueToken,
    updatedAt: now,
  });
}

async function enqueueWorkspaceMemoryEvaluation(
  ctx: ActionCtx,
  workspaceId: Id<"workspaces">
): Promise<MemoryEvaluationEnqueueResult> {
  const prepared: {
    shouldEnqueue: boolean;
    reason: "no_pending" | "queued" | "running";
    eventId: Id<"memoryWorkflowEvents"> | null;
    enqueueToken: number | null;
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
  if (!prepared.eventId || prepared.enqueueToken === null) {
    return { enqueued: false as const, reason: "missing_event" as const };
  }

  const workspace = await ctx.runQuery(internal.workspaces.getById, {
    workspaceId,
  });
  if (!workspace) {
    return { enqueued: false as const, reason: "missing_event" as const };
  }

  const tenantRoute = await enqueueTenantJobWithRetry(ctx, {
    workspaceId,
    userId: workspace.userId,
    class: "background",
    priority: TENANT_JOB_PRIORITY.background,
    idempotencyKey: `memory-evaluation:${String(workspaceId)}:${String(prepared.eventId)}:${String(prepared.enqueueToken)}`,
    payload: {
      kind: "memory_evaluation",
      workspaceId,
      enqueueToken: prepared.enqueueToken,
    },
  });
  if (tenantRoute.route === "enforced") {
    const schedulerWorkId = String(tenantRoute.jobId);
    const attachment: { attached: boolean } = await ctx.runMutation(
      internal.workflows.memory.setMemoryEvaluationQueueWorkIdInternal,
      {
        workspaceId,
        workId: schedulerWorkId,
        enqueueToken: prepared.enqueueToken,
      }
    );
    if (!attachment.attached) {
      await ctx.runMutation(
        internal.tenantScheduler.cancelJobByExternalIdInternal,
        { workId: schedulerWorkId }
      );
      return { enqueued: false as const, reason: "queued" as const };
    }
    return { enqueued: true as const, workId: schedulerWorkId };
  }

  const workId: string = await memoryEvaluationPool.enqueueAction(
    ctx,
    internal.workflows.memory.runQueuedWorkspaceMemoryEvaluationInternal,
    {
      workspaceId,
      enqueueToken: prepared.enqueueToken,
    },
    {
      onComplete:
        internal.workflows.memory
          .handleMemoryEvaluationQueueWorkCompletionInternal,
      context: { workspaceId },
    }
  );

  const attachment: { attached: boolean } = await ctx.runMutation(
    internal.workflows.memory.setMemoryEvaluationQueueWorkIdInternal,
    {
      workspaceId,
      workId: String(workId),
      enqueueToken: prepared.enqueueToken,
    }
  );

  if (!attachment.attached) {
    await memoryEvaluationPool.cancel(ctx, workId as WorkId);
    return { enqueued: false as const, reason: "queued" as const };
  }

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
  returns: v.object({
    shouldEnqueue: v.boolean(),
    reason: v.union(
      v.literal("no_pending"),
      v.literal("queued"),
      v.literal("running")
    ),
    eventId: v.union(v.id("memoryWorkflowEvents"), v.null()),
    enqueueToken: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, { workspaceId }) => {
    const queue = await getWorkspaceQueueRow(ctx, workspaceId);
    const now = getCurrentUTCTimestamp();
    const queueWorkState = queue
      ? await getMemoryEvaluationQueueWorkState(ctx, queue, now)
      : "unattached";
    const recoveredEnqueueToken =
      queue && queueWorkState === "stale"
        ? Math.max(now, (queue.lastEnqueuedAt ?? 0) + 1)
        : null;

    if (queue && recoveredEnqueueToken !== null) {
      await recoverStaleMemoryEvaluationQueue(
        ctx,
        queue,
        now,
        recoveredEnqueueToken
      );
    }

    const nextPending = await getNextPendingMemoryWorkflowEvent(
      ctx,
      workspaceId
    );

    if (
      queue &&
      queueWorkState === "active" &&
      (queue.status === "queued" || queue.status === "running")
    ) {
      return {
        shouldEnqueue: false as const,
        reason: queue.status,
        eventId: queue.activeEventId ?? nextPending?._id ?? null,
        enqueueToken: queue.lastEnqueuedAt ?? null,
      };
    }

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
        eventId: null,
        enqueueToken: null,
      };
    }

    if (queue && (queue.status === "queued" || queueWorkState === "stale")) {
      const enqueueToken =
        recoveredEnqueueToken ??
        (queue.lastEnqueuedAt === undefined ? now : queue.lastEnqueuedAt);
      if (queue.lastEnqueuedAt !== enqueueToken) {
        await ctx.db.patch(queue._id, {
          lastEnqueuedAt: enqueueToken,
          updatedAt: now,
        });
      }
      return {
        shouldEnqueue: true as const,
        reason: "queued" as const,
        eventId: nextPending._id,
        enqueueToken,
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
      eventId: nextPending._id,
      enqueueToken: now,
    };
  },
});

export const setMemoryEvaluationQueueWorkIdInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    workId: v.string(),
    enqueueToken: v.optional(v.number()),
  },
  returns: v.object({ attached: v.boolean() }),
  handler: async (ctx, { workspaceId, workId, enqueueToken }) => {
    const queue = await getWorkspaceQueueRow(ctx, workspaceId);
    const now = getCurrentUTCTimestamp();

    if (!queue) {
      return { attached: false };
    }

    if (
      (queue.status !== "queued" && queue.status !== "running") ||
      (enqueueToken !== undefined && queue.lastEnqueuedAt !== enqueueToken) ||
      (queue.workId !== undefined && queue.workId !== workId)
    ) {
      return { attached: false };
    }

    if (queue.status === "queued") {
      await ctx.db.patch(queue._id, {
        workId,
        updatedAt: now,
      });
    }
    return { attached: true };
  },
});

export const beginMemoryEvaluationQueueWorkInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    enqueueToken: v.optional(v.number()),
    workId: v.optional(v.string()),
  },
  returns: v.object({
    eventId: v.union(v.id("memoryWorkflowEvents"), v.null()),
    workId: v.union(v.string(), v.null()),
  }),
  handler: async (
    ctx,
    { workspaceId, enqueueToken, workId: expectedWorkId }
  ) => {
    const queue = await getWorkspaceQueueRow(ctx, workspaceId);
    if (
      !queue ||
      (enqueueToken !== undefined && queue.lastEnqueuedAt !== enqueueToken)
    ) {
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

    const nextPending = await getNextPendingMemoryWorkflowEvent(
      ctx,
      workspaceId
    );

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
      queue.workId ??
      expectedWorkId ??
      `memory-eval:${workspaceId}:${nextPending._id}`;

    if (isPriorityMemoryEvaluationEvent(nextPending)) {
      console.warn("[MemoryEvaluationQueue] Prioritizing repair event", {
        workspaceId: String(workspaceId),
        eventId: String(nextPending._id),
        eventType: nextPending.eventType,
      });
    }

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
        tenantJobId: v.optional(v.id("tenantJobs")),
      })
    ),
    handler: async (ctx, args) => {
      const workspaceId = args.context.workspaceId;
      const expectedWorkId = args.context.tenantJobId
        ? String(args.context.tenantJobId)
        : args.workId;
      if (args.context.tenantJobId) {
        await completeTenantJob(ctx, {
          jobId: args.context.tenantJobId,
          status:
            args.result.kind === "success"
              ? "succeeded"
              : args.result.kind === "canceled"
                ? "cancelled"
                : "failed",
          errorMessage:
            args.result.kind === "failed" ? args.result.error : undefined,
        });
      }
      const queue = await getWorkspaceQueueRow(ctx, workspaceId);
      if (!queue || queue.workId !== expectedWorkId) {
        return { recovered: false as const };
      }

      const now = getCurrentUTCTimestamp();

      if (args.result.kind !== "success" && queue.activeEventId) {
        const activeEventId = queue.activeEventId;
        const event = await ctx.db.get(activeEventId);
        if (
          event &&
          event.status === "processing" &&
          event.evaluatorWorkflowId === expectedWorkId
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
        if (existingRun && existingRun.workflowId === expectedWorkId) {
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
    enqueueToken: v.optional(v.number()),
    workId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { workspaceId, enqueueToken, workId }
  ): Promise<MemoryEvaluationQueueRunResult> => {
    const queueWork = await ctx.runMutation(
      internal.workflows.memory.beginMemoryEvaluationQueueWorkInternal,
      {
        workspaceId,
        enqueueToken,
        workId,
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
