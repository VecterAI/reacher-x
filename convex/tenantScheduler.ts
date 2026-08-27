import { defineBatchWorkerValidators, ping } from "@convex-dev/batch-worker";
import { vOnCompleteArgs, type WorkId } from "@convex-dev/workpool";
import { v, type Infer } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  internalMutation,
  internalQuery,
  query,
} from "./lib/functionBuilders";
import { requireOwnedWorkspace } from "./lib/accessHelpers";
import { tenantExecutionPool } from "./lib/tenantExecutionPool";
import { workflow } from "./lib/workflow";
import { tenantSchedulerRateLimiter } from "./lib/tenantSchedulerRateLimiter";
import {
  DEFAULT_TENANT_BASE_SLOTS,
  DEFAULT_TENANT_BURST_SLOTS,
  DEFAULT_TENANT_JOB_LEASE_MS,
  DEFAULT_TENANT_SCHEDULER_SLOT_COUNT,
  NESTED_WORKFLOW_LEASE_MS,
  TENANT_JOB_RETENTION_MS,
  TENANT_EXECUTION_POOL_MAX_PARALLELISM,
  buildTenantKey,
  clampTenantBaseSlots,
  clampTenantBurstSlots,
  clampTenantSchedulerSlotCount,
  getTenantDispatchCap,
} from "./lib/tenantSchedulerCore";
import {
  completeTenantJob,
  markTenantJobNestedWorkflow,
} from "./lib/tenantSchedulerHelpers";
import {
  tenantJobClassValidator,
  tenantJobPayloadValidator,
  tenantSchedulerModeValidator,
} from "./validators";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

const WORKER_NAME = "tenant-fair-dispatcher-v1";
const DISPATCH_BATCH_SIZE = 8;
const LANE_SCAN_SIZE = 64;

const enqueueRouteValidator = v.union(
  v.object({
    route: v.literal("legacy"),
    jobId: v.null(),
  }),
  v.object({
    route: v.literal("shadow"),
    jobId: v.id("tenantJobs"),
  }),
  v.object({
    route: v.literal("enforced"),
    jobId: v.id("tenantJobs"),
  })
);

const dispatchCandidateValidator = v.object({
  laneId: v.id("tenantJobLanes"),
  jobId: v.id("tenantJobs"),
  tenantKey: v.string(),
  nextPriority: v.optional(v.number()),
});

const dispatchSlotValidator = v.object({
  slotId: v.id("tenantSchedulerSlots"),
  slotNumber: v.number(),
});

const {
  vQueryArgs: dispatchQueryArgs,
  vQueryReturns: dispatchQueryReturns,
  vMutationArgs: dispatchMutationArgs,
  vMutationReturns: dispatchMutationReturns,
} = defineBatchWorkerValidators({
  batch: {
    candidates: v.array(dispatchCandidateValidator),
    slots: v.array(dispatchSlotValidator),
    activeTenantCount: v.number(),
  },
});

async function getGlobalControl(ctx: Pick<MutationCtx | QueryCtx, "db">) {
  return await ctx.db
    .query("tenantSchedulerControls")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
}

async function resolveSchedulerMode(
  ctx: Pick<MutationCtx | QueryCtx, "db">,
  workspaceId?: Id<"workspaces">
): Promise<Doc<"tenantSchedulerControls">["mode"]> {
  if (workspaceId) {
    const override = await ctx.db
      .query("tenantSchedulerWorkspaceOverrides")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .unique();
    if (override) return override.mode;
  }
  const control = await getGlobalControl(ctx);
  return control?.mode ?? "legacy";
}

async function getOrCreateLane(
  ctx: Pick<MutationCtx, "db">,
  args: {
    tenantKey: string;
    workspaceId?: Id<"workspaces">;
    userId: Id<"users">;
    paused: boolean;
  }
) {
  const existing = await ctx.db
    .query("tenantJobLanes")
    .withIndex("by_tenant_key", (q) => q.eq("tenantKey", args.tenantKey))
    .unique();
  if (existing) return existing as Doc<"tenantJobLanes">;

  const now = getCurrentUTCTimestamp();
  const laneId = await ctx.db.insert("tenantJobLanes", {
    tenantKey: args.tenantKey,
    workspaceId: args.workspaceId,
    userId: args.userId,
    state: args.paused ? "paused" : "idle",
    pendingCount: 0,
    runningCount: 0,
    minPriority: Number.MAX_SAFE_INTEGER,
    lastDispatchedAt: 0,
    updatedAt: now,
  });
  const lane = await ctx.db.get("tenantJobLanes", laneId);
  if (!lane) throw new Error("Tenant scheduler lane was not created");
  return lane as Doc<"tenantJobLanes">;
}

async function pingDispatcher(ctx: MutationCtx) {
  await ping(ctx, components.batchWorker, {
    name: WORKER_NAME,
    workQuery: internal.tenantScheduler.getDispatchBatchInternal,
    workerMutation: internal.tenantScheduler.dispatchBatchInternal,
    config: { debounceMs: 25 },
  });
}

async function configurePoolSplit(ctx: MutationCtx, enforced: boolean) {
  await Promise.all([
    ctx.runMutation(components.tenantExecutionPool.config.update, {
      maxParallelism: enforced ? TENANT_EXECUTION_POOL_MAX_PARALLELISM : 0,
    }),
    ctx.runMutation(components.qualificationPool.config.update, {
      maxParallelism: enforced ? 0 : 10,
    }),
    ctx.runMutation(components.enrichmentPool.config.update, {
      maxParallelism: enforced ? 0 : 10,
    }),
    ctx.runMutation(components.previewQualificationPool.config.update, {
      maxParallelism: enforced ? 0 : 4,
    }),
    ctx.runMutation(components.previewEnrichmentPool.config.update, {
      maxParallelism: enforced ? 0 : 4,
    }),
    ctx.runMutation(components.outreachPlanPool.config.update, {
      maxParallelism: enforced ? 0 : 5,
    }),
    ctx.runMutation(components.memoryEvaluationPool.config.update, {
      maxParallelism: enforced ? 0 : 2,
    }),
  ]);
}

async function assertSchedulerDrained(
  ctx: Pick<MutationCtx, "db">,
  workspaceId?: Id<"workspaces">
) {
  const findJob = async (status: "queued" | "running") =>
    workspaceId
      ? await ctx.db
          .query("tenantJobs")
          .withIndex("by_workspace_and_status", (q) =>
            q.eq("workspaceId", workspaceId).eq("status", status)
          )
          .first()
      : await ctx.db
          .query("tenantJobs")
          .withIndex("by_status_and_lease_expires_at", (q) =>
            q.eq("status", status)
          )
          .first();
  const [queued, running] = await Promise.all([
    findJob("queued"),
    findJob("running"),
  ]);
  if (queued || running) {
    const scope = workspaceId ? `workspace ${workspaceId}` : "the deployment";
    throw new Error(
      `Cannot disable enforced tenant scheduling while ${scope} has queued or running tenant jobs`
    );
  }
}

async function validateTenantJobOwnership(
  ctx: Pick<MutationCtx, "db">,
  args: {
    workspaceId?: Id<"workspaces">;
    userId: Id<"users">;
    payload: Infer<typeof tenantJobPayloadValidator>;
  }
) {
  const payload = args.payload;
  if (payload.kind === "setup_generation") {
    const session = await ctx.db.get("workspaceSetupSessions", payload.sessionId);
    if (!session || session.userId !== args.userId) {
      throw new Error("Tenant setup job ownership mismatch");
    }
    return null;
  }

  if (!args.workspaceId || payload.workspaceId !== args.workspaceId) {
    throw new Error("Tenant job workspace scope mismatch");
  }
  const workspace = await ctx.db.get("workspaces", args.workspaceId);
  if (!workspace || workspace.userId !== args.userId) {
    throw new Error("Tenant job workspace ownership mismatch");
  }

  switch (payload.kind) {
    case "qualification":
    case "enrichment": {
      const prospect = await ctx.db.get("prospects", payload.prospectId);
      if (
        !prospect ||
        prospect.workspaceId !== args.workspaceId ||
        prospect.userId !== args.userId
      ) {
        throw new Error("Tenant prospect job ownership mismatch");
      }
      break;
    }
    case "auto_plan": {
      const [prospect, run] = await Promise.all([
        ctx.db.get("prospects", payload.prospectId),
        ctx.db.get("autoPlanRuns", payload.runId),
      ]);
      if (
        payload.userId !== args.userId ||
        !prospect ||
        prospect.workspaceId !== args.workspaceId ||
        prospect.userId !== args.userId ||
        !run ||
        run.workspaceId !== args.workspaceId ||
        run.userId !== args.userId ||
        run.prospectId !== payload.prospectId
      ) {
        throw new Error("Tenant auto-plan job ownership mismatch");
      }
      break;
    }
    case "plan_batch_item": {
      const [run, item] = await Promise.all([
        ctx.db.get("planBatchRuns", payload.runId),
        ctx.db.get("planBatchItems", payload.itemId),
      ]);
      if (
        !run ||
        run.workspaceId !== args.workspaceId ||
        run.userId !== args.userId ||
        !item ||
        item.runId !== payload.runId
      ) {
        throw new Error("Tenant plan-batch job ownership mismatch");
      }
      break;
    }
    case "memory_evaluation":
      break;
  }
  return workspace;
}

export const enqueueTenantJobInternal = internalMutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    userId: v.id("users"),
    class: tenantJobClassValidator,
    priority: v.number(),
    idempotencyKey: v.string(),
    payload: tenantJobPayloadValidator,
  },
  returns: enqueueRouteValidator,
  handler: async (ctx, args) => {
    const workspace = await validateTenantJobOwnership(ctx, args);
    const mode = await resolveSchedulerMode(ctx, args.workspaceId);
    if (mode === "legacy") {
      return { route: "legacy" as const, jobId: null };
    }

    const existing = await ctx.db
      .query("tenantJobs")
      .withIndex("by_idempotency_key", (q) =>
        q.eq("idempotencyKey", args.idempotencyKey)
      )
      .unique();
    if (existing) {
      return {
        route: mode === "shadow" ? ("shadow" as const) : ("enforced" as const),
        jobId: existing._id,
      };
    }

    const paused = workspace?.prospectingWorkflowStatus === "paused";
    const tenantKey = buildTenantKey(args);
    const lane = await getOrCreateLane(ctx, {
      tenantKey,
      workspaceId: args.workspaceId,
      userId: args.userId,
      paused,
    });
    const now = getCurrentUTCTimestamp();
    const shadow = mode === "shadow";
    const jobId = await ctx.db.insert("tenantJobs", {
      tenantKey,
      laneId: lane._id,
      workspaceId: args.workspaceId,
      userId: args.userId,
      class: args.class,
      kind: args.payload.kind,
      status: shadow ? "shadow" : "queued",
      priority: args.priority,
      idempotencyKey: args.idempotencyKey,
      payload: args.payload,
      queuedAt: now,
      completedAt: shadow ? now : undefined,
      attemptCount: 0,
      updatedAt: now,
    });

    if (shadow) {
      return { route: "shadow" as const, jobId };
    }

    await ctx.db.patch("tenantJobLanes", lane._id, {
      // An explicit scheduler pause wins even while the workspace status
      // mutation is still propagating through the stop action.
      state: paused || lane.state === "paused" ? "paused" : "ready",
      pendingCount: lane.pendingCount + 1,
      minPriority: Math.min(lane.minPriority, args.priority),
      updatedAt: now,
    });
    await pingDispatcher(ctx);
    return { route: "enforced" as const, jobId };
  },
});

export const getDispatchBatchInternal = internalQuery({
  args: dispatchQueryArgs,
  returns: dispatchQueryReturns,
  handler: async (ctx) => {
    const control = await ctx.db
      .query("tenantSchedulerControls")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const enforcedOverride = await ctx.db
      .query("tenantSchedulerWorkspaceOverrides")
      .withIndex("by_mode", (q) => q.eq("mode", "enforced"))
      .first();
    if (!control || (control.mode !== "enforced" && !enforcedOverride)) {
      return { kind: "idle" as const, timeoutMs: 30_000 };
    }

    const slots = await ctx.db
      .query("tenantSchedulerSlots")
      .withIndex("by_status_and_slot_number", (q) =>
        q
          .eq("status", "free")
          .lt("slotNumber", control.slotCount)
      )
      .take(DISPATCH_BATCH_SIZE);
    if (slots.length === 0) {
      return { kind: "idle" as const, timeoutMs: 5_000 };
    }

    const lanes = await ctx.db
      .query("tenantJobLanes")
      .withIndex("by_state_and_last_dispatched_at", (q) =>
        q.eq("state", "ready")
      )
      .take(LANE_SCAN_SIZE);

    const candidates: Array<{
      laneId: Id<"tenantJobLanes">;
      jobId: Id<"tenantJobs">;
      tenantKey: string;
      nextPriority?: number;
    }> = [];
    for (const lane of lanes) {
      const jobs = await ctx.db
        .query("tenantJobs")
        .withIndex("by_lane_and_status_and_priority_and_queued_at", (q) =>
          q.eq("laneId", lane._id).eq("status", "queued")
        )
        .take(2);
      if (!jobs[0]) continue;
      candidates.push({
        laneId: lane._id,
        jobId: jobs[0]._id,
        tenantKey: lane.tenantKey,
        nextPriority: jobs[1]?.priority,
      });
    }
    if (candidates.length === 0) {
      return { kind: "idle" as const, timeoutMs: 10_000 };
    }

    return {
      kind: "work" as const,
      batch: {
        candidates,
        slots: slots.map((slot) => ({
          slotId: slot._id,
          slotNumber: slot.slotNumber,
        })),
        activeTenantCount: new Set(
          candidates.map((candidate) => candidate.tenantKey)
        ).size,
      },
    };
  },
});

export const dispatchBatchInternal = internalMutation({
  args: dispatchMutationArgs,
  returns: dispatchMutationReturns,
  handler: async (ctx, args) => {
    const control = await ctx.db
      .query("tenantSchedulerControls")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const enforcedOverride = await ctx.db
      .query("tenantSchedulerWorkspaceOverrides")
      .withIndex("by_mode", (q) => q.eq("mode", "enforced"))
      .first();
    if (!control || (control.mode !== "enforced" && !enforcedOverride)) {
      return null;
    }

    const tenantCap = getTenantDispatchCap({
      slotCount: control.slotCount,
      activeTenantCount: args.activeTenantCount,
      baseSlotsPerTenant: control.baseSlotsPerTenant,
      burstSlotsPerTenant: control.burstSlotsPerTenant,
    });
    let dispatched = 0;
    let retryAfterMs = 0;

    for (let index = 0; index < args.slots.length; index += 1) {
      const candidate = args.candidates[index];
      const slotRef = args.slots[index];
      if (!candidate || !slotRef) break;

      const [lane, job, slot] = await Promise.all([
        ctx.db.get("tenantJobLanes", candidate.laneId),
        ctx.db.get("tenantJobs", candidate.jobId),
        ctx.db.get("tenantSchedulerSlots", slotRef.slotId),
      ]);
      if (
        !lane ||
        lane.state !== "ready" ||
        lane.runningCount >= tenantCap ||
        !job ||
        job.status !== "queued" ||
        !slot ||
        slot.status !== "free" ||
        slot.slotNumber >= control.slotCount
      ) {
        continue;
      }

      const globalRate = await tenantSchedulerRateLimiter.limit(
        ctx,
        "globalTenantJobStarts"
      );
      if (!globalRate.ok) {
        retryAfterMs = Math.max(retryAfterMs, globalRate.retryAfter ?? 1000);
        break;
      }
      const tenantRate = await tenantSchedulerRateLimiter.limit(
        ctx,
        "tenantJobStarts",
        { key: lane.tenantKey }
      );
      if (!tenantRate.ok) {
        retryAfterMs = Math.max(retryAfterMs, tenantRate.retryAfter ?? 1000);
        continue;
      }

      let workId: string;
      const payload = job.payload;
      switch (payload.kind) {
        case "setup_generation":
          workId = String(
            await tenantExecutionPool.enqueueAction(
              ctx,
              internal.setupSessions.runSetupGenerationInternal,
              { sessionId: payload.sessionId },
              {
                onComplete: internal.tenantScheduler.handleDirectWorkComplete,
                context: { jobId: job._id },
                retry: true,
              }
            )
          );
          break;
        case "qualification":
          workId = String(
            await tenantExecutionPool.enqueueAction(
              ctx,
              internal.workflows.qualification.runQualificationWorkflow,
              {
                prospectId: payload.prospectId,
                workspaceId: payload.workspaceId,
                tenantJobId: job._id,
              },
              {
                onComplete:
                  internal.tenantScheduler.handleWorkflowAdmissionComplete,
                context: { jobId: job._id },
                retry: true,
              }
            )
          );
          break;
        case "enrichment":
          workId = String(
            await tenantExecutionPool.enqueueAction(
              ctx,
              internal.workflows.enrichment.runEnrichmentWorkflow,
              {
                prospectId: payload.prospectId,
                workspaceId: payload.workspaceId,
                claimToken: payload.claimToken,
                force: payload.force,
                tenantJobId: job._id,
              },
              {
                onComplete:
                  internal.tenantScheduler.handleWorkflowAdmissionComplete,
                context: { jobId: job._id },
                retry: true,
              }
            )
          );
          break;
        case "auto_plan":
          workId = String(
            await tenantExecutionPool.enqueueAction(
              ctx,
              internal.autoPlanActions.generateGroundedAutoPlanDraft,
              {
                prospectId: payload.prospectId,
                workspaceId: payload.workspaceId,
                userId: payload.userId,
                runId: payload.runId,
              },
              {
                onComplete:
                  internal.workflows.autoPlan.handleAutoPlanWorkComplete,
                context: {
                  prospectId: payload.prospectId,
                  runId: payload.runId,
                  tenantJobId: job._id,
                },
                retry: true,
              }
            )
          );
          break;
        case "plan_batch_item":
          workId = String(
            await tenantExecutionPool.enqueueAction(
              ctx,
              internal.planBatchActions.processPlanBatchItem,
              { itemId: payload.itemId },
              {
                onComplete: internal.planBatches.handlePlanBatchItemComplete,
                context: {
                  runId: payload.runId,
                  itemId: payload.itemId,
                  tenantJobId: job._id,
                },
                retry: true,
              }
            )
          );
          break;
        case "memory_evaluation":
          workId = String(
            await tenantExecutionPool.enqueueAction(
              ctx,
              internal.workflows.memory
                .runQueuedWorkspaceMemoryEvaluationInternal,
              { workspaceId: payload.workspaceId },
              {
                onComplete:
                  internal.workflows.memory
                    .handleMemoryEvaluationQueueWorkCompletionInternal,
                context: {
                  workspaceId: payload.workspaceId,
                  tenantJobId: job._id,
                },
                retry: true,
              }
            )
          );
          break;
      }

      const now = getCurrentUTCTimestamp();
      const leaseExpiresAt = now + control.leaseDurationMs;
      const nextPendingCount = Math.max(0, lane.pendingCount - 1);
      await Promise.all([
        ctx.db.patch("tenantJobs", job._id, {
          status: "running",
          workId,
          slotId: slot._id,
          startedAt: job.startedAt ?? now,
          leaseExpiresAt,
          attemptCount: job.attemptCount + 1,
          updatedAt: now,
        }),
        ctx.db.patch("tenantSchedulerSlots", slot._id, {
          status: "claimed",
          jobId: job._id,
          tenantKey: job.tenantKey,
          claimedAt: now,
          leaseExpiresAt,
          updatedAt: now,
        }),
        ctx.db.patch("tenantJobLanes", lane._id, {
          pendingCount: nextPendingCount,
          runningCount: lane.runningCount + 1,
          minPriority:
            candidate.nextPriority ??
            (nextPendingCount > 0 ? lane.minPriority : Number.MAX_SAFE_INTEGER),
          state: nextPendingCount > 0 ? "ready" : "idle",
          lastDispatchedAt: now,
          updatedAt: now,
        }),
      ]);
      dispatched += 1;
    }

    if (dispatched === 0) {
      return { debounceMs: Math.max(250, Math.ceil(retryAfterMs || 1000)) };
    }
    return null;
  },
});

const tenantCompletionContextValidator = v.object({
  jobId: v.id("tenantJobs"),
});

export const handleDirectWorkComplete = internalMutation({
  args: vOnCompleteArgs(tenantCompletionContextValidator),
  returns: v.null(),
  handler: async (ctx, args) => {
    await completeTenantJob(ctx, {
      jobId: args.context.jobId,
      status:
        args.result.kind === "success"
          ? "succeeded"
          : args.result.kind === "canceled"
            ? "cancelled"
            : "failed",
      errorMessage:
        args.result.kind === "failed" ? args.result.error : undefined,
    });
    return null;
  },
});

export const handleWorkflowAdmissionComplete = internalMutation({
  args: vOnCompleteArgs(tenantCompletionContextValidator),
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.result.kind !== "success") {
      await completeTenantJob(ctx, {
        jobId: args.context.jobId,
        status: args.result.kind === "canceled" ? "cancelled" : "failed",
        errorMessage:
          args.result.kind === "failed" ? args.result.error : undefined,
      });
      return null;
    }

    const returnValue = args.result.returnValue as { workflowId?: string };
    if (!returnValue.workflowId) {
      await completeTenantJob(ctx, {
        jobId: args.context.jobId,
        status: "succeeded",
      });
      return null;
    }

    await markTenantJobNestedWorkflow(ctx, {
      jobId: args.context.jobId,
      workflowId: returnValue.workflowId,
      leaseExpiresAt: getCurrentUTCTimestamp() + NESTED_WORKFLOW_LEASE_MS,
    });
    return null;
  },
});

export const wakeDispatcherInternal = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await pingDispatcher(ctx);
    return null;
  },
});

export const completeJobInternal = internalMutation({
  args: {
    jobId: v.id("tenantJobs"),
    status: v.union(
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    errorMessage: v.optional(v.string()),
  },
  returns: v.object({ completed: v.boolean() }),
  handler: async (ctx, args) => await completeTenantJob(ctx, args),
});

export const cancelJobByExternalIdInternal = internalMutation({
  args: { workId: v.string() },
  returns: v.object({ handled: v.boolean() }),
  handler: async (ctx, { workId }) => {
    const jobId = ctx.db.normalizeId("tenantJobs", workId);
    if (!jobId) return { handled: false };
    const job = await ctx.db.get("tenantJobs", jobId);
    if (!job) return { handled: false };
    if (job.status === "queued") {
      const lane = await ctx.db.get("tenantJobLanes", job.laneId);
      const now = getCurrentUTCTimestamp();
      await ctx.db.patch("tenantJobs", job._id, {
        status: "cancelled",
        completedAt: now,
        updatedAt: now,
      });
      if (lane) {
        const nextJob = await ctx.db
          .query("tenantJobs")
          .withIndex("by_lane_and_status_and_priority_and_queued_at", (q) =>
            q.eq("laneId", lane._id).eq("status", "queued")
          )
          .first();
        const pendingCount = Math.max(0, lane.pendingCount - 1);
        await ctx.db.patch("tenantJobLanes", lane._id, {
          pendingCount,
          minPriority: nextJob?.priority ?? Number.MAX_SAFE_INTEGER,
          state:
            lane.state === "paused"
              ? "paused"
              : pendingCount > 0
                ? "ready"
                : "idle",
          updatedAt: now,
        });
      }
      return { handled: true };
    }
    if (job.status === "running" && job.workId) {
      await tenantExecutionPool.cancel(ctx, job.workId as WorkId);
    }
    return { handled: true };
  },
});

export const setControlInternal = internalMutation({
  args: {
    mode: tenantSchedulerModeValidator,
    slotCount: v.optional(v.number()),
    baseSlotsPerTenant: v.optional(v.number()),
    burstSlotsPerTenant: v.optional(v.number()),
    leaseDurationMs: v.optional(v.number()),
  },
  returns: v.object({
    mode: tenantSchedulerModeValidator,
    slotCount: v.number(),
    baseSlotsPerTenant: v.number(),
    burstSlotsPerTenant: v.number(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantSchedulerControls")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    if (existing?.mode === "enforced" && args.mode !== "enforced") {
      await assertSchedulerDrained(ctx);
    }
    const slotCount = clampTenantSchedulerSlotCount(
      args.slotCount ?? existing?.slotCount ?? DEFAULT_TENANT_SCHEDULER_SLOT_COUNT
    );
    const baseSlotsPerTenant = clampTenantBaseSlots(
      args.baseSlotsPerTenant ??
        existing?.baseSlotsPerTenant ??
        DEFAULT_TENANT_BASE_SLOTS,
      slotCount
    );
    const burstSlotsPerTenant = clampTenantBurstSlots({
      burstSlots:
        args.burstSlotsPerTenant ??
        existing?.burstSlotsPerTenant ??
        DEFAULT_TENANT_BURST_SLOTS,
      baseSlots: baseSlotsPerTenant,
      slotCount,
    });
    const now = getCurrentUTCTimestamp();
    const patch = {
      key: "global" as const,
      mode: args.mode,
      slotCount,
      baseSlotsPerTenant,
      burstSlotsPerTenant,
      leaseDurationMs:
        args.leaseDurationMs ??
        existing?.leaseDurationMs ??
        DEFAULT_TENANT_JOB_LEASE_MS,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.replace("tenantSchedulerControls", existing._id, patch);
    } else {
      await ctx.db.insert("tenantSchedulerControls", patch);
    }

    await configurePoolSplit(ctx, args.mode === "enforced");

    for (
      let slotNumber = 0;
      slotNumber < TENANT_EXECUTION_POOL_MAX_PARALLELISM;
      slotNumber += 1
    ) {
      const slot = await ctx.db
        .query("tenantSchedulerSlots")
        .withIndex("by_slot_number", (q) => q.eq("slotNumber", slotNumber))
        .unique();
      if (!slot) {
        await ctx.db.insert("tenantSchedulerSlots", {
          slotNumber,
          status: "free",
          updatedAt: now,
        });
      }
    }
    if (args.mode === "enforced") await pingDispatcher(ctx);
    return {
      mode: args.mode,
      slotCount,
      baseSlotsPerTenant,
      burstSlotsPerTenant,
    };
  },
});

export const setWorkspaceOverrideInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    mode: v.optional(tenantSchedulerModeValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantSchedulerWorkspaceOverrides")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .unique();
    if (
      existing?.mode === "enforced" &&
      args.mode !== "enforced"
    ) {
      await assertSchedulerDrained(ctx, args.workspaceId);
    }
    if (!args.mode) {
      if (existing) await ctx.db.delete(existing._id);
      const control = await getGlobalControl(ctx);
      const anotherEnforcedOverride = await ctx.db
        .query("tenantSchedulerWorkspaceOverrides")
        .withIndex("by_mode", (q) => q.eq("mode", "enforced"))
        .first();
      await configurePoolSplit(
        ctx,
        control?.mode === "enforced" || Boolean(anotherEnforcedOverride)
      );
      return null;
    }
    const now = getCurrentUTCTimestamp();
    if (existing) {
      await ctx.db.patch(existing._id, { mode: args.mode, updatedAt: now });
    } else {
      await ctx.db.insert("tenantSchedulerWorkspaceOverrides", {
        workspaceId: args.workspaceId,
        mode: args.mode,
        updatedAt: now,
      });
    }
    if (args.mode === "enforced") {
      await configurePoolSplit(ctx, true);
      await pingDispatcher(ctx);
    }
    return null;
  },
});

export const pauseWorkspaceInternal = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
  handler: async (ctx, { workspaceId }) => {
    const lane = await ctx.db
      .query("tenantJobLanes")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .unique();
    if (lane) {
      await ctx.db.patch(lane._id, {
        state: "paused",
        updatedAt: getCurrentUTCTimestamp(),
      });
    }
    return null;
  },
});

export const resumeWorkspaceInternal = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
  handler: async (ctx, { workspaceId }) => {
    const lane = await ctx.db
      .query("tenantJobLanes")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .unique();
    if (lane) {
      await ctx.db.patch(lane._id, {
        state: lane.pendingCount > 0 ? "ready" : "idle",
        updatedAt: getCurrentUTCTimestamp(),
      });
      if (lane.pendingCount > 0) await pingDispatcher(ctx);
    }
    return null;
  },
});

export const reapExpiredJobsInternal = internalMutation({
  args: {},
  returns: v.object({ reaped: v.number(), hasMore: v.boolean() }),
  handler: async (ctx) => {
    const now = getCurrentUTCTimestamp();
    const jobs = await ctx.db
      .query("tenantJobs")
      .withIndex("by_status_and_lease_expires_at", (q) =>
        q.eq("status", "running").lt("leaseExpiresAt", now)
      )
      .take(20);
    for (const job of jobs) {
      try {
        if (job.nestedWorkflowId) {
          await workflow.cancel(ctx, job.nestedWorkflowId as any);
        } else if (job.workId) {
          await tenantExecutionPool.cancel(ctx, job.workId as WorkId);
        }
      } catch (error) {
        console.warn(
          `[TenantScheduler] Failed to cancel expired work for job ${job._id}: ${String(error)}`
        );
      }
      await completeTenantJob(ctx, {
        jobId: job._id,
        status: "failed",
        errorMessage: "Tenant job lease expired",
      });
    }
    return { reaped: jobs.length, hasMore: jobs.length === 20 };
  },
});

export const cleanupCompletedJobsInternal = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number(), hasMore: v.boolean() }),
  handler: async (ctx) => {
    const cutoff = getCurrentUTCTimestamp() - TENANT_JOB_RETENTION_MS;
    const terminalStatuses = [
      "shadow",
      "succeeded",
      "failed",
      "cancelled",
    ] as const;
    let deleted = 0;

    for (const status of terminalStatuses) {
      const jobs = await ctx.db
        .query("tenantJobs")
        .withIndex("by_status_and_completed_at", (q) =>
          q.eq("status", status).lt("completedAt", cutoff)
        )
        .take(25);
      for (const job of jobs) {
        await ctx.db.delete(job._id);
      }
      deleted += jobs.length;
    }

    return { deleted, hasMore: deleted === terminalStatuses.length * 25 };
  },
});

const controlStatusValidator = v.union(
  v.null(),
  v.object({
    mode: tenantSchedulerModeValidator,
    slotCount: v.number(),
    baseSlotsPerTenant: v.number(),
    burstSlotsPerTenant: v.number(),
    leaseDurationMs: v.number(),
  })
);

export const getControlStatusInternal = internalQuery({
  args: {},
  returns: v.object({
    control: controlStatusValidator,
    slots: v.object({
      configured: v.number(),
      free: v.number(),
      claimed: v.number(),
    }),
    lanes: v.object({
      ready: v.number(),
      paused: v.number(),
      sampleTruncated: v.boolean(),
    }),
    jobs: v.object({
      queued: v.number(),
      running: v.number(),
      sampleTruncated: v.boolean(),
    }),
    enforcedOverrides: v.number(),
  }),
  handler: async (ctx) => {
    const [control, slots, readyLanes, pausedLanes, queuedJobs, runningJobs] =
      await Promise.all([
        getGlobalControl(ctx),
        ctx.db.query("tenantSchedulerSlots").take(100),
        ctx.db
          .query("tenantJobLanes")
          .withIndex("by_state_and_last_dispatched_at", (q) =>
            q.eq("state", "ready")
          )
          .take(1001),
        ctx.db
          .query("tenantJobLanes")
          .withIndex("by_state_and_last_dispatched_at", (q) =>
            q.eq("state", "paused")
          )
          .take(1001),
        ctx.db
          .query("tenantJobs")
          .withIndex("by_status_and_lease_expires_at", (q) =>
            q.eq("status", "queued")
          )
          .take(1001),
        ctx.db
          .query("tenantJobs")
          .withIndex("by_status_and_lease_expires_at", (q) =>
            q.eq("status", "running")
          )
          .take(1001),
      ]);
    const enforcedOverrides = await ctx.db
      .query("tenantSchedulerWorkspaceOverrides")
      .withIndex("by_mode", (q) => q.eq("mode", "enforced"))
      .take(101);

    return {
      control: control
        ? {
            mode: control.mode,
            slotCount: control.slotCount,
            baseSlotsPerTenant: control.baseSlotsPerTenant,
            burstSlotsPerTenant: control.burstSlotsPerTenant,
            leaseDurationMs: control.leaseDurationMs,
          }
        : null,
      slots: {
        configured: slots.length,
        free: slots.filter((slot) => slot.status === "free").length,
        claimed: slots.filter((slot) => slot.status === "claimed").length,
      },
      lanes: {
        ready: Math.min(readyLanes.length, 1000),
        paused: Math.min(pausedLanes.length, 1000),
        sampleTruncated:
          readyLanes.length > 1000 || pausedLanes.length > 1000,
      },
      jobs: {
        queued: Math.min(queuedJobs.length, 1000),
        running: Math.min(runningJobs.length, 1000),
        sampleTruncated:
          queuedJobs.length > 1000 || runningJobs.length > 1000,
      },
      enforcedOverrides: Math.min(enforcedOverrides.length, 100),
    };
  },
});

export const getWorkspaceSchedulerStatus = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({
    mode: tenantSchedulerModeValidator,
    state: v.union(
      v.literal("not_initialized"),
      v.literal("idle"),
      v.literal("ready"),
      v.literal("paused")
    ),
    queuedCount: v.number(),
    runningCount: v.number(),
    globalSlots: v.number(),
    baseSlotsPerTenant: v.number(),
    burstSlotsPerTenant: v.number(),
  }),
  handler: async (ctx, { workspaceId }) => {
    await requireOwnedWorkspace(ctx, workspaceId);
    const [control, override, lane] = await Promise.all([
      ctx.db
        .query("tenantSchedulerControls")
        .withIndex("by_key", (q) => q.eq("key", "global"))
        .unique(),
      ctx.db
        .query("tenantSchedulerWorkspaceOverrides")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .unique(),
      ctx.db
        .query("tenantJobLanes")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .unique(),
    ]);
    const state: "not_initialized" | "idle" | "ready" | "paused" =
      lane?.state ?? "not_initialized";
    return {
      mode: override?.mode ?? control?.mode ?? "legacy",
      state,
      queuedCount: lane?.pendingCount ?? 0,
      runningCount: lane?.runningCount ?? 0,
      globalSlots: control?.slotCount ?? DEFAULT_TENANT_SCHEDULER_SLOT_COUNT,
      baseSlotsPerTenant:
        control?.baseSlotsPerTenant ?? DEFAULT_TENANT_BASE_SLOTS,
      burstSlotsPerTenant:
        control?.burstSlotsPerTenant ?? DEFAULT_TENANT_BURST_SLOTS,
    };
  },
});
