import { vOnCompleteArgs, type WorkId } from "@convex-dev/workpool";
import { vResultValidator } from "@convex-dev/workpool";
import { vWorkflowId } from "@convex-dev/workflow";
import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./lib/functionBuilders";
import { getOutreachPlanPool } from "./lib/outreachPlanPool";
import {
  TENANT_ENQUEUE_RECOVERY_MAX_ATTEMPTS,
  TENANT_JOB_PRIORITY,
  getTenantEnqueueRetryDelayMs,
} from "./lib/tenantSchedulerCore";
import { recordTenantJobEnqueueFailure } from "./lib/tenantSchedulerEnqueue";
import { completeTenantJob } from "./lib/tenantSchedulerHelpers";
import {
  dismissNotificationsByKey,
  upsertNotificationByKey,
} from "./lib/notificationHelpers";
import { getProspectDisplayLabel } from "./lib/prospectIdentityCore";
import {
  createPlanBatchReferenceKey,
  normalizePlanBatchFitRange,
  normalizePlanBatchTargetName,
  resolvePlanBatchEligibility,
  getPlanBatchWorkflowEventName,
  instructionReferencesPlanBatchTarget,
  resolvePlanBatchTargetInstructions,
  selectLatestPlanBatchReferences,
  type PlanBatchAttachment,
  type PlanBatchPerProspectInstruction,
  type PlanBatchTaggedTarget,
} from "./lib/planBatchCore";
import { requireOwnedWorkspace, requireUser } from "./lib/accessHelpers";
import { getProspectActivePlanDocument } from "./lib/outreachCore";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { inferAttachmentMediaKind } from "../shared/lib/utils/media/inferAttachmentMediaKind";
import {
  planBatchOperationValidator,
  planBatchDispatchItemResultValidator,
  planBatchDispatchResultValidator,
  planBatchDispatchSelectionValidator,
  planBatchRunStatusValidator,
  planBatchScopeKindValidator,
  planBatchWorkCompletionContextValidator,
} from "./validators";
import { workflow } from "./lib/workflow";
import {
  collectAgentThreadTargetCandidates,
  consumeAgentThreadTargetSelection,
} from "./lib/agentThreadTargetSelectionHelpers";
import {
  getUserSafeErrorMessage,
  stringifyUnknownError,
} from "./lib/errorHelpers";
import {
  getPlanBatchNotificationCopy,
  type PlanBatchCopyState,
} from "../shared/lib/outreach/planBatchCopy";

const SELECTION_PAGE_SIZE = 50;
const DISPATCH_PAGE_SIZE = 25;
const PLAN_REFERENCE_CATALOG_LIMIT = 12;
type PlanBatchDispatchResult = Infer<typeof planBatchDispatchResultValidator>;
type PlanBatchDispatchSelection = Infer<
  typeof planBatchDispatchSelectionValidator
>;
type PlanBatchDispatchItemResult = Infer<
  typeof planBatchDispatchItemResultValidator
>;

function isExplicitPlanBatchScope(
  scopeKind: Doc<"planBatchRuns">["scopeKind"]
) {
  return ["tagged", "plan_group", "named"].includes(scopeKind);
}

type WorkflowId = Awaited<ReturnType<typeof workflow.start>>;

type PlanBatchItemResult =
  | {
      outcome: "succeeded";
      planId: Id<"outreachPlans">;
      threadId: string;
    }
  | {
      outcome: "skipped";
      reason: string;
      threadId?: string;
    }
  | {
      outcome: "cancelled";
      reason: string;
    };

function buildPlanBatchNotificationKey(runId: Id<"planBatchRuns">) {
  return `plan-batch:${runId}`;
}

function buildPlanBatchTargetHref(threadId: string) {
  const params = new URLSearchParams();
  params.set("threadId", threadId);
  return `/agent?${params.toString()}`;
}

async function startPlanBatchWorkflow(
  ctx: MutationCtx,
  runId: Id<"planBatchRuns">
) {
  const workflowId = await workflow.start(
    ctx,
    internal.workflows.planBatch.planBatchWorkflow,
    { runId },
    {
      onComplete: internal.planBatches.handlePlanBatchWorkflowComplete,
      context: { runId },
    }
  );
  await ctx.db.patch("planBatchRuns", runId, {
    workflowId: String(workflowId),
    updatedAt: getCurrentUTCTimestamp(),
  });
}

async function signalPlanBatchWorkflow(
  ctx: MutationCtx,
  run: Doc<"planBatchRuns">
) {
  if (!run.workflowId) return;
  try {
    await workflow.sendEvent(ctx, {
      workflowId: run.workflowId as WorkflowId,
      name: getPlanBatchWorkflowEventName(String(run._id)),
    });
  } catch (error) {
    console.warn("[PlanBatch] Failed to signal workflow state change", {
      runId: String(run._id),
      workflowId: run.workflowId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function getSmallPlanBatchTargetNames(
  ctx: Pick<MutationCtx | QueryCtx, "db">,
  run: Pick<Doc<"planBatchRuns">, "_id" | "targetCount" | "eligibleCount">
) {
  if (run.targetCount < 1 || run.targetCount > 2) {
    return [];
  }

  const items = await ctx.db
    .query("planBatchItems")
    .withIndex("by_run_and_status", (q) => q.eq("runId", run._id))
    .take(3);
  const names: string[] = [];
  for (const item of items) {
    if (item.status === "skipped") {
      continue;
    }
    if (item.prospectName) {
      names.push(item.prospectName);
      continue;
    }
    const prospect = await ctx.db.get("prospects", item.prospectId);
    names.push(getProspectDisplayLabel(prospect));
  }

  return names.slice(0, run.eligibleCount);
}

function buildPlanBatchCopyState(
  run: Doc<"planBatchRuns">,
  args: {
    status?: PlanBatchCopyState["status"];
    targetNames?: string[];
    succeededCount?: number;
    failedCount?: number;
    skippedCount?: number;
    createdCount?: number;
    updatedCount?: number;
  } = {}
): PlanBatchCopyState {
  return {
    operation: run.operation,
    scopeKind: run.scopeKind,
    status: args.status ?? run.status,
    targetCount: run.targetCount,
    eligibleCount: run.eligibleCount,
    succeededCount: args.succeededCount ?? run.succeededCount,
    failedCount: args.failedCount ?? run.failedCount,
    skippedCount: args.skippedCount ?? run.skippedCount,
    createdCount: args.createdCount ?? run.createdCount ?? 0,
    updatedCount: args.updatedCount ?? run.updatedCount ?? 0,
    targetNames: args.targetNames,
    fitScoreMin: run.fitScoreMin,
    fitScoreMax: run.fitScoreMax,
  };
}

const TERMINAL_PLAN_BATCH_STATUSES = new Set<Doc<"planBatchRuns">["status"]>([
  "completed",
  "partial",
  "failed",
  "cancelled",
]);

function isTerminalPlanBatchStatus(
  status: Doc<"planBatchRuns">["status"]
): boolean {
  return TERMINAL_PLAN_BATCH_STATUSES.has(status);
}

async function upsertPlanBatchStartedNotification(
  ctx: MutationCtx,
  run: Doc<"planBatchRuns">
) {
  const targetNames = await getSmallPlanBatchTargetNames(ctx, run);
  const copy = getPlanBatchNotificationCopy(
    buildPlanBatchCopyState(run, {
      status: "running",
      targetNames,
    })
  );
  await upsertNotificationByKey(ctx, {
    userId: run.userId,
    workspaceId: run.workspaceId,
    type: "plan_batch_started",
    title: copy.title,
    message: copy.status,
    notificationKey: buildPlanBatchNotificationKey(run._id),
    targetHref: buildPlanBatchTargetHref(run.sourceThreadId),
    actionLabel: "Open chat",
    threadId: run.sourceThreadId,
  });
}

function collectTaggedTargets(
  context: Doc<"agentMessageContexts"> | null,
  workspaceId: Id<"workspaces">
): PlanBatchTaggedTarget[] {
  if (!context || context.workspaceId !== workspaceId) {
    return [];
  }
  return collectAgentThreadTargetCandidates({
    workspaceId: String(workspaceId),
    taggedEntities: context.taggedEntities,
  });
}

async function collectBatchAttachments(
  ctx: MutationCtx,
  contexts: Array<Doc<"agentMessageContexts"> | null>,
  args: {
    userId: Id<"users">;
    workspaceId: Id<"workspaces">;
  }
): Promise<PlanBatchAttachment[]> {
  const uniqueContexts = [
    ...new Map(
      contexts
        .filter(
          (context): context is Doc<"agentMessageContexts"> => context !== null
        )
        .map((context) => [context.messageId, context])
    ).values(),
  ];
  if (uniqueContexts.length === 0) return [];

  const candidates: Array<{
    uploadId?: string | null;
    url?: string | null;
    fileName: string;
    mimeType?: string | null;
    mediaKind?: "image" | "gif" | "video" | null;
  }> = uniqueContexts.flatMap((context) => [
    ...context.attachments.map((attachment) => ({
      uploadId: attachment.uploadId,
      url: attachment.mediaUrl,
      fileName: attachment.fileName,
    })),
    ...context.taggedEntities.flatMap((entity) =>
      entity.kind === "attachment"
        ? [
            {
              uploadId: entity.entityId,
              url: entity.attachmentUrl,
              fileName: entity.label,
              mimeType: entity.attachmentMimeType,
              mediaKind: entity.attachmentMediaKind,
            },
          ]
        : []
    ),
  ]);

  const attachments: PlanBatchAttachment[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    let url = candidate.url?.trim() || null;
    let fileName = candidate.fileName;
    let mimeType = candidate.mimeType;
    if (candidate.uploadId) {
      const uploadId = ctx.db.normalizeId("mediaUploads", candidate.uploadId);
      const upload = uploadId
        ? await ctx.db.get("mediaUploads", uploadId)
        : null;
      if (
        !upload ||
        upload.userId !== args.userId ||
        upload.workspaceId !== args.workspaceId
      ) {
        continue;
      }
      url = await ctx.storage.getUrl(upload.storageId);
      fileName = upload.displayName ?? upload.fileName;
      mimeType = upload.mimeType;
    }
    if (!url) continue;

    const mediaKind =
      candidate.mediaKind ??
      inferAttachmentMediaKind({ mimeType, url: url ?? fileName });
    if (!mediaKind) continue;

    const dedupeKey = `${url}:${fileName}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    attachments.push({ url, fileName, mediaKind });
    if (attachments.length === 4) break;
  }
  return attachments;
}

async function insertPlanBatchItem(
  ctx: MutationCtx,
  args: {
    run: Doc<"planBatchRuns">;
    prospectId: Id<"prospects">;
    targetInstruction?: string;
  }
): Promise<{ target: number; eligible: number; skipped: number }> {
  const existing = await ctx.db
    .query("planBatchItems")
    .withIndex("by_run_and_prospect", (q) =>
      q.eq("runId", args.run._id).eq("prospectId", args.prospectId)
    )
    .first();
  if (existing) {
    return { target: 0, eligible: 0, skipped: 0 };
  }

  const prospect = await ctx.db.get("prospects", args.prospectId);
  if (
    !prospect ||
    prospect.workspaceId !== args.run.workspaceId ||
    prospect.userId !== args.run.userId
  ) {
    return { target: 0, eligible: 0, skipped: 0 };
  }

  const activePlan = await getProspectActivePlanDocument(ctx.db, prospect._id);
  const eligibility = resolvePlanBatchEligibility({
    prospect,
    activePlan,
    requestedOperation: args.run.operation,
  });
  const prospectName = getProspectDisplayLabel(prospect);
  const now = getCurrentUTCTimestamp();
  if (!eligibility.eligible) {
    await ctx.db.insert("planBatchItems", {
      runId: args.run._id,
      prospectId: prospect._id,
      prospectName,
      operation:
        args.run.operation === "update" ||
        (args.run.operation === "create_or_update" && activePlan)
          ? "update"
          : "create",
      targetInstruction: args.targetInstruction,
      status: "skipped",
      skipReason: eligibility.reason,
      baselinePlanId: activePlan?._id,
      baselinePlanVersion: activePlan?.version,
      attemptCount: 0,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return { target: 1, eligible: 0, skipped: 1 };
  }

  await ctx.db.insert("planBatchItems", {
    runId: args.run._id,
    prospectId: prospect._id,
    prospectName,
    operation: eligibility.operation,
    targetInstruction: args.targetInstruction,
    status: "pending",
    baselinePlanId: eligibility.baselinePlanId,
    baselinePlanVersion: eligibility.baselinePlanVersion,
    attemptCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  return { target: 1, eligible: 1, skipped: 0 };
}

async function finishPlanBatchSelection(
  ctx: MutationCtx,
  run: Doc<"planBatchRuns">
) {
  const now = getCurrentUTCTimestamp();
  if (run.eligibleCount === 0) {
    await ctx.db.patch("planBatchRuns", run._id, {
      status: "completed",
      selectionCursor: undefined,
      completedAt: now,
      updatedAt: now,
    });
    const copy = getPlanBatchNotificationCopy(
      buildPlanBatchCopyState(run, { status: "completed" })
    );
    await upsertNotificationByKey(ctx, {
      userId: run.userId,
      workspaceId: run.workspaceId,
      type: "plan_batch_completed",
      title: copy.title,
      message: copy.status,
      notificationKey: buildPlanBatchNotificationKey(run._id),
      targetHref: buildPlanBatchTargetHref(run.sourceThreadId),
      actionLabel: "Open chat",
      threadId: run.sourceThreadId,
    });
    return;
  }

  if (run.confirmationRequired) {
    await ctx.db.patch("planBatchRuns", run._id, {
      status: "awaiting_confirmation",
      selectionCursor: undefined,
      updatedAt: now,
    });
    const targetNames = await getSmallPlanBatchTargetNames(ctx, run);
    const copy = getPlanBatchNotificationCopy(
      buildPlanBatchCopyState(run, {
        status: "awaiting_confirmation",
        targetNames,
      })
    );
    await upsertNotificationByKey(ctx, {
      userId: run.userId,
      workspaceId: run.workspaceId,
      type: "plan_batch_ready",
      title: copy.title,
      message: copy.status,
      notificationKey: buildPlanBatchNotificationKey(run._id),
      targetHref: buildPlanBatchTargetHref(run.sourceThreadId),
      actionLabel: "Open chat",
      threadId: run.sourceThreadId,
    });
    return;
  }

  await ctx.db.patch("planBatchRuns", run._id, {
    status: "queued",
    selectionCursor: undefined,
    updatedAt: now,
  });
  await upsertPlanBatchStartedNotification(ctx, run);
}

export const resolveNamedPlanBatchTargetsInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    prospectNames: v.array(v.string()),
  },
  returns: v.array(
    v.object({
      prospectId: v.id("prospects"),
      label: v.string(),
      handle: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const resolvedTargets: Array<{
      prospectId: Id<"prospects">;
      label: string;
      handle?: string;
    }> = [];
    const seenProspectIds = new Set<string>();

    for (const requestedName of args.prospectNames) {
      const normalizedName = normalizePlanBatchTargetName(requestedName);
      if (!normalizedName) {
        throw new Error("A prospect name or handle cannot be empty.");
      }
      const candidates = await ctx.db
        .query("prospectSummaries")
        .withSearchIndex("search_prospect_summaries", (q) =>
          q
            .search("searchText", normalizedName)
            .eq("workspaceId", args.workspaceId)
        )
        .take(20);
      const exactMatches = candidates.filter((candidate) => {
        if (candidate.userId !== args.userId) {
          return false;
        }
        return [
          candidate.displayName,
          candidate.twitterUsername,
          candidate.linkedInUsername,
        ]
          .filter((value): value is string => Boolean(value))
          .some(
            (value) => normalizePlanBatchTargetName(value) === normalizedName
          );
      });

      if (exactMatches.length === 0) {
        throw new Error(
          `Could not find one exact prospect named "${requestedName}" in this workspace. Use the exact visible name or handle.`
        );
      }
      if (exactMatches.length > 1) {
        throw new Error(
          `"${requestedName}" matches more than one prospect. Use the exact unique handle.`
        );
      }

      const match = exactMatches[0];
      if (seenProspectIds.has(String(match.prospectId))) {
        continue;
      }
      seenProspectIds.add(String(match.prospectId));
      resolvedTargets.push({
        prospectId: match.prospectId,
        label: match.displayName,
        ...(match.twitterUsername || match.linkedInUsername
          ? { handle: match.twitterUsername ?? match.linkedInUsername }
          : {}),
      });
    }

    return resolvedTargets;
  },
});

export const listPlanBatchReferencesForThreadInternal = internalQuery({
  args: {
    sourceThreadId: v.string(),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      reference: v.string(),
      operation: planBatchOperationValidator,
      status: planBatchRunStatusValidator,
      targetCount: v.number(),
      prospectNames: v.array(v.string()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const runs = await ctx.db
      .query("planBatchRuns")
      .withIndex("by_thread_and_updated_at", (q) =>
        q.eq("sourceThreadId", args.sourceThreadId)
      )
      .order("desc")
      .take(
        Math.max(
          1,
          Math.min(
            PLAN_REFERENCE_CATALOG_LIMIT,
            Math.round(args.limit ?? PLAN_REFERENCE_CATALOG_LIMIT)
          )
        )
      );
    const ownedRuns = runs.filter(
      (run) =>
        run.workspaceId === args.workspaceId &&
        run.userId === args.userId &&
        Boolean(run.referenceKey) &&
        run.succeededCount > 0 &&
        ["completed", "partial", "cancelled"].includes(run.status)
    );

    const catalogItems = await Promise.all(
      ownedRuns.map(async (run) => {
        const [prospectNames, succeededItems] = await Promise.all([
          getSmallPlanBatchTargetNames(ctx, run),
          ctx.db
            .query("planBatchItems")
            .withIndex("by_run_and_status", (q) =>
              q.eq("runId", run._id).eq("status", "succeeded")
            )
            .take(Math.max(1, Math.min(run.targetCount, 200))),
        ]);

        return {
          reference: run.referenceKey as string,
          operation: run.operation,
          status: run.status,
          targetCount: run.targetCount,
          prospectNames,
          createdAt: run.createdAt,
          targetIds: succeededItems.map((item) => String(item.prospectId)),
        };
      })
    );

    return selectLatestPlanBatchReferences(catalogItems).map((item) => ({
      reference: item.reference,
      operation: item.operation,
      status: item.status,
      targetCount: item.targetCount,
      prospectNames: item.prospectNames,
      createdAt: item.createdAt,
    }));
  },
});

export const createPlanBatchRunInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    sourceThreadId: v.string(),
    sourceMessageId: v.optional(v.string()),
    sourcePrompt: v.optional(v.string()),
    responsePromptMessageId: v.optional(v.string()),
    operation: planBatchOperationValidator,
    scopeKind: planBatchScopeKindValidator,
    sourcePlanBatchReference: v.optional(v.string()),
    namedTargets: v.array(
      v.object({
        prospectId: v.id("prospects"),
        label: v.string(),
        handle: v.optional(v.string()),
      })
    ),
    instruction: v.string(),
    fitScoreMin: v.optional(v.number()),
    fitScoreMax: v.optional(v.number()),
    perProspectInstructions: v.array(
      v.object({
        prospectName: v.string(),
        instruction: v.string(),
      })
    ),
  },
  returns: v.object({
    runId: v.id("planBatchRuns"),
    reference: v.string(),
  }),
  handler: async (ctx, args) => {
    const instruction = args.instruction.trim();
    if (!instruction) {
      throw new Error("Tell me what you want changed in the outreach plans.");
    }

    const workspace = await ctx.db.get("workspaces", args.workspaceId);
    if (!workspace || workspace.userId !== args.userId) {
      throw new Error("Workspace not found.");
    }
    if (args.sourceMessageId) {
      const existingRun = await ctx.db
        .query("planBatchRuns")
        .withIndex("by_source_message_id", (q) =>
          q.eq("sourceMessageId", args.sourceMessageId)
        )
        .first();
      if (
        existingRun &&
        existingRun.workspaceId === args.workspaceId &&
        existingRun.userId === args.userId &&
        existingRun.sourceThreadId === args.sourceThreadId
      ) {
        const reference =
          existingRun.referenceKey ?? createPlanBatchReferenceKey();
        if (!existingRun.referenceKey) {
          await ctx.db.patch("planBatchRuns", existingRun._id, {
            referenceKey: reference,
          });
        }
        return { runId: existingRun._id, reference };
      }
    }
    const recentRuns = await ctx.db
      .query("planBatchRuns")
      .withIndex("by_thread_and_updated_at", (q) =>
        q.eq("sourceThreadId", args.sourceThreadId)
      )
      .order("desc")
      .take(10);
    const activeRun = recentRuns.find(
      (run) =>
        run.workspaceId === args.workspaceId &&
        run.userId === args.userId &&
        !["completed", "partial", "failed", "cancelled"].includes(run.status)
    );
    if (activeRun) {
      throw new Error(
        "Outreach plans are already being prepared in this conversation. Wait for them to finish or ask me to stop them first."
      );
    }

    const sourceContext = args.sourceMessageId
      ? await ctx.db
          .query("agentMessageContexts")
          .withIndex("by_message", (q) =>
            q.eq("messageId", args.sourceMessageId as string)
          )
          .first()
      : null;
    if (
      sourceContext &&
      (sourceContext.threadId !== args.sourceThreadId ||
        sourceContext.userId !== args.userId)
    ) {
      throw new Error("The selected message context is not available.");
    }

    let sourcePlanBatchRunId: Id<"planBatchRuns"> | undefined;
    let referencedRun: Doc<"planBatchRuns"> | null = null;
    if (args.scopeKind === "plan_group") {
      if (!args.sourcePlanBatchReference) {
        throw new Error(
          "Choose one of the available outreach plan references from this conversation."
        );
      }
      referencedRun = await ctx.db
        .query("planBatchRuns")
        .withIndex("by_thread_and_reference_key", (q) =>
          q
            .eq("sourceThreadId", args.sourceThreadId)
            .eq("referenceKey", args.sourcePlanBatchReference)
        )
        .unique();
      if (
        !referencedRun ||
        referencedRun.workspaceId !== args.workspaceId ||
        referencedRun.userId !== args.userId ||
        referencedRun.succeededCount === 0
      ) {
        throw new Error(
          "That outreach plan reference is not available in this conversation."
        );
      }
      sourcePlanBatchRunId = referencedRun._id;
    }

    let targetContext = sourceContext;
    let targets: PlanBatchTaggedTarget[] =
      args.scopeKind === "tagged"
        ? collectTaggedTargets(sourceContext, args.workspaceId)
        : args.scopeKind === "named"
          ? args.namedTargets.map((target) => ({
              prospectId: String(target.prospectId),
              label: target.label,
              handle: target.handle,
            }))
          : [];
    let selectionSourceMessageId =
      targets.length > 0 ? sourceContext?.messageId : undefined;
    if (args.scopeKind === "tagged") {
      if (targets.length === 0) {
        const selection = await ctx.db
          .query("agentThreadTargetSelections")
          .withIndex("by_thread", (q) => q.eq("threadId", args.sourceThreadId))
          .unique();
        if (
          selection &&
          selection.userId === args.userId &&
          selection.workspaceId === args.workspaceId
        ) {
          targets = selection.targets.map((target) => ({
            prospectId: String(target.prospectId),
            label: target.label,
            handle: target.handle,
          }));
          selectionSourceMessageId = selection.sourceMessageId;
          targetContext = await ctx.db
            .query("agentMessageContexts")
            .withIndex("by_message", (q) =>
              q.eq("messageId", selection.sourceMessageId)
            )
            .unique();
          console.info("[PlanBatch] Using persisted thread target selection", {
            sourceThreadId: args.sourceThreadId,
            sourceMessageId: args.sourceMessageId,
            taggedMessageId: selection.sourceMessageId,
            targetCount: targets.length,
          });
        }
      }
    }

    let fitScoreMin = args.fitScoreMin;
    let fitScoreMax = args.fitScoreMax;
    if (args.scopeKind === "fit_score") {
      if (typeof fitScoreMin !== "number" || typeof fitScoreMax !== "number") {
        throw new Error("Choose a minimum and maximum fit score.");
      }
      const range = normalizePlanBatchFitRange({
        min: fitScoreMin,
        max: fitScoreMax,
      });
      fitScoreMin = range.min;
      fitScoreMax = range.max;
    } else {
      fitScoreMin = undefined;
      fitScoreMax = undefined;
    }

    if (
      !["tagged", "named"].includes(args.scopeKind) &&
      args.perProspectInstructions.length > 0
    ) {
      throw new Error(
        "Target-specific instructions can only be used with exact tagged or named prospects."
      );
    }

    const selectedAttachments = await collectBatchAttachments(
      ctx,
      [sourceContext, targetContext],
      {
        userId: args.userId,
        workspaceId: args.workspaceId,
      }
    );
    const attachments =
      selectedAttachments.length > 0
        ? selectedAttachments
        : (referencedRun?.attachments ?? []);
    const now = getCurrentUTCTimestamp();
    const referenceKey = createPlanBatchReferenceKey();
    const runId = await ctx.db.insert("planBatchRuns", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      sourceThreadId: args.sourceThreadId,
      sourceMessageId: args.sourceMessageId,
      sourcePrompt: args.sourcePrompt?.trim() || undefined,
      responsePromptMessageId: args.responsePromptMessageId,
      referenceKey,
      sourcePlanBatchRunId,
      operation: args.operation,
      scopeKind: args.scopeKind,
      instruction,
      fitScoreMin,
      fitScoreMax,
      attachments,
      confirmationRequired: !isExplicitPlanBatchScope(args.scopeKind),
      status: "selecting",
      targetCount: 0,
      eligibleCount: 0,
      queuedCount: 0,
      runningCount: 0,
      succeededCount: 0,
      createdCount: 0,
      updatedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      selectionSkippedCount: 0,
      finishedCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    const run = await ctx.db.get("planBatchRuns", runId);
    if (!run) {
      throw new Error("Could not start the outreach plans.");
    }

    if (args.scopeKind === "tagged" || args.scopeKind === "named") {
      if (targets.length === 0) {
        await ctx.db.delete("planBatchRuns", runId);
        throw new Error(
          args.scopeKind === "tagged"
            ? "No explicit prospect selection is available for this conversation. Tag one or more prospects, plans, tasks, or posts."
            : "No exact named prospects are available for this request."
        );
      }
      if (
        targets.length > 1 &&
        targets.some((target) =>
          instructionReferencesPlanBatchTarget(instruction, target)
        )
      ) {
        await ctx.db.delete("planBatchRuns", runId);
        throw new Error(
          "The shared instruction must contain only the common plan change, without prospect names or prospect-specific instructions."
        );
      }
      let resolvedInstructions: Map<string, string>;
      try {
        resolvedInstructions = resolvePlanBatchTargetInstructions({
          targets,
          instructions:
            args.perProspectInstructions as PlanBatchPerProspectInstruction[],
        });
      } catch (error) {
        await ctx.db.delete("planBatchRuns", runId);
        throw error;
      }

      let targetCount = 0;
      let eligibleCount = 0;
      let skippedCount = 0;
      for (const target of targets) {
        const prospectId = ctx.db.normalizeId("prospects", target.prospectId);
        if (!prospectId) {
          continue;
        }
        const counts = await insertPlanBatchItem(ctx, {
          run,
          prospectId,
          targetInstruction: resolvedInstructions.get(target.prospectId),
        });
        targetCount += counts.target;
        eligibleCount += counts.eligible;
        skippedCount += counts.skipped;
      }
      if (targetCount === 0) {
        await ctx.db.delete("planBatchRuns", runId);
        throw new Error(
          "The tagged prospects are no longer available in this workspace."
        );
      }

      await ctx.db.patch("planBatchRuns", runId, {
        targetCount,
        eligibleCount,
        skippedCount,
        selectionSkippedCount: skippedCount,
        updatedAt: getCurrentUTCTimestamp(),
      });
      const updatedRun = await ctx.db.get("planBatchRuns", runId);
      if (updatedRun) {
        await finishPlanBatchSelection(ctx, updatedRun);
      }
      if (selectionSourceMessageId) {
        await consumeAgentThreadTargetSelection(ctx, {
          threadId: args.sourceThreadId,
          userId: args.userId,
          workspaceId: args.workspaceId,
          sourceMessageId: selectionSourceMessageId,
        });
      }
      await startPlanBatchWorkflow(ctx, runId);
      return { runId, reference: referenceKey };
    }

    await startPlanBatchWorkflow(ctx, runId);
    return { runId, reference: referenceKey };
  },
});

export const selectPlanBatchTargetsPage = internalMutation({
  args: { runId: v.id("planBatchRuns") },
  returns: v.union(
    v.object({
      done: v.boolean(),
      status: planBatchRunStatusValidator,
    }),
    v.null()
  ),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get("planBatchRuns", runId);
    if (!run) {
      return null;
    }
    if (run.status !== "selecting") {
      return { done: true, status: run.status };
    }

    const paginationOpts = {
      cursor: run.selectionCursor ?? null,
      numItems: SELECTION_PAGE_SIZE,
    };
    if (run.scopeKind === "plan_group" && !run.sourcePlanBatchRunId) {
      throw new Error("The referenced outreach plan group is unavailable.");
    }
    const page =
      run.scopeKind === "plan_group"
        ? await ctx.db
            .query("planBatchItems")
            .withIndex("by_run_and_status", (q) =>
              q
                .eq("runId", run.sourcePlanBatchRunId as Id<"planBatchRuns">)
                .eq("status", "succeeded")
            )
            .paginate(paginationOpts)
        : run.scopeKind === "fit_score"
          ? await ctx.db
              .query("prospectSummaries")
              .withIndex("by_workspace_score", (q) =>
                q
                  .eq("workspaceId", run.workspaceId)
                  .gte("sortQualificationScore", run.fitScoreMin ?? 0)
                  .lte("sortQualificationScore", run.fitScoreMax ?? 100)
              )
              .paginate(paginationOpts)
          : await ctx.db
              .query("prospectSummaries")
              .withIndex("by_workspace", (q) =>
                q.eq("workspaceId", run.workspaceId)
              )
              .paginate(paginationOpts);

    let targetCount = 0;
    let eligibleCount = 0;
    let skippedCount = 0;
    for (const summary of page.page) {
      const counts = await insertPlanBatchItem(ctx, {
        run,
        prospectId: summary.prospectId,
      });
      targetCount += counts.target;
      eligibleCount += counts.eligible;
      skippedCount += counts.skipped;
    }

    const nextCounts = {
      targetCount: run.targetCount + targetCount,
      eligibleCount: run.eligibleCount + eligibleCount,
      skippedCount: run.skippedCount + skippedCount,
      selectionSkippedCount: run.selectionSkippedCount + skippedCount,
    };
    if (!page.isDone) {
      await ctx.db.patch("planBatchRuns", runId, {
        ...nextCounts,
        selectionCursor: page.continueCursor,
        updatedAt: getCurrentUTCTimestamp(),
      });
      return { done: false, status: "selecting" as const };
    }

    await ctx.db.patch("planBatchRuns", runId, {
      ...nextCounts,
      selectionCursor: undefined,
      updatedAt: getCurrentUTCTimestamp(),
    });
    const completedSelectionRun = await ctx.db.get("planBatchRuns", runId);
    if (completedSelectionRun) {
      await finishPlanBatchSelection(ctx, completedSelectionRun);
      const finalRun = await ctx.db.get("planBatchRuns", runId);
      return finalRun ? { done: true, status: finalRun.status } : null;
    }
    return null;
  },
});

async function findLatestPlanBatchRun(
  ctx: QueryCtx | MutationCtx,
  args: {
    sourceThreadId: string;
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
  }
) {
  const runs = await ctx.db
    .query("planBatchRuns")
    .withIndex("by_thread_and_updated_at", (q) =>
      q.eq("sourceThreadId", args.sourceThreadId)
    )
    .order("desc")
    .take(10);
  return (
    runs.find(
      (run) =>
        run.workspaceId === args.workspaceId && run.userId === args.userId
    ) ?? null
  );
}

export const confirmLatestPlanBatchInternal = internalMutation({
  args: {
    sourceThreadId: v.string(),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    responsePromptMessageId: v.optional(v.string()),
  },
  returns: v.union(v.id("planBatchRuns"), v.null()),
  handler: async (ctx, args) => {
    const run = await findLatestPlanBatchRun(ctx, args);
    if (!run || run.status !== "awaiting_confirmation") {
      return null;
    }
    const now = getCurrentUTCTimestamp();
    await ctx.db.patch("planBatchRuns", run._id, {
      status: "queued",
      responsePromptMessageId: args.responsePromptMessageId,
      agentResponseStartedAt: undefined,
      agentResponseCompletedAt: undefined,
      agentResponseError: undefined,
      startedAt: now,
      updatedAt: now,
    });
    await upsertPlanBatchStartedNotification(ctx, run);
    await signalPlanBatchWorkflow(ctx, run);
    return run._id;
  },
});

export const cancelLatestPlanBatchInternal = internalMutation({
  args: {
    sourceThreadId: v.string(),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    responsePromptMessageId: v.optional(v.string()),
  },
  returns: v.union(v.id("planBatchRuns"), v.null()),
  handler: async (ctx, args) => {
    const run = await findLatestPlanBatchRun(ctx, args);
    if (
      !run ||
      ["completed", "partial", "failed", "cancelled"].includes(run.status)
    ) {
      return null;
    }
    const now = getCurrentUTCTimestamp();
    await ctx.db.patch("planBatchRuns", run._id, {
      status: "cancelled",
      responsePromptMessageId: args.responsePromptMessageId,
      agentResponseStartedAt: undefined,
      agentResponseCompletedAt: undefined,
      agentResponseError: undefined,
      completedAt: now,
      updatedAt: now,
    });
    await dismissNotificationsByKey(ctx, {
      userId: run.userId,
      workspaceId: run.workspaceId,
      notificationKey: buildPlanBatchNotificationKey(run._id),
    });
    await signalPlanBatchWorkflow(ctx, run);
    await ctx.scheduler.runAfter(
      0,
      internal.planBatches.cancelQueuedPlanBatchItemsPage,
      { runId: run._id }
    );
    return run._id;
  },
});

export const cancelQueuedPlanBatchItemsPage = internalMutation({
  args: { runId: v.id("planBatchRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get("planBatchRuns", runId);
    if (!run || (run.status !== "cancelled" && run.status !== "failed")) {
      return null;
    }
    const [queuedItems, pendingItems] = await Promise.all([
      ctx.db
        .query("planBatchItems")
        .withIndex("by_run_and_status", (q) =>
          q.eq("runId", runId).eq("status", "queued")
        )
        .take(DISPATCH_PAGE_SIZE),
      ctx.db
        .query("planBatchItems")
        .withIndex("by_run_and_status", (q) =>
          q.eq("runId", runId).eq("status", "pending")
        )
        .take(DISPATCH_PAGE_SIZE),
    ]);
    if (queuedItems.length === 0 && pendingItems.length === 0) {
      return null;
    }

    for (const item of queuedItems) {
      if (item.workId) {
        const schedulerCancellation = await ctx.runMutation(
          internal.tenantScheduler.cancelJobByExternalIdInternal,
          { workId: item.workId }
        );
        if (!schedulerCancellation.handled) {
          await getOutreachPlanPool().cancel(ctx, item.workId as WorkId);
        }
      }
    }
    const now = getCurrentUTCTimestamp();
    await Promise.all(
      [...queuedItems, ...pendingItems].map((item) =>
        ctx.db.patch("planBatchItems", item._id, {
          status: "cancelled",
          errorMessage: "Batch cancelled",
          completedAt: now,
          updatedAt: now,
        })
      )
    );
    await ctx.db.patch("planBatchRuns", runId, {
      queuedCount: Math.max(0, run.queuedCount - queuedItems.length),
      updatedAt: now,
    });
    if (
      queuedItems.length === DISPATCH_PAGE_SIZE ||
      pendingItems.length === DISPATCH_PAGE_SIZE
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.planBatches.cancelQueuedPlanBatchItemsPage,
        { runId }
      );
    }
    return null;
  },
});

export const dispatchPlanBatchPage = internalMutation({
  args: { runId: v.id("planBatchRuns") },
  returns: planBatchDispatchResultValidator,
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get("planBatchRuns", runId);
    if (!run || (run.status !== "queued" && run.status !== "running")) {
      return null;
    }
    const items = await ctx.db
      .query("planBatchItems")
      .withIndex("by_run_and_status", (q) =>
        q.eq("runId", runId).eq("status", "pending")
      )
      .take(DISPATCH_PAGE_SIZE);
    if (items.length === 0) {
      return { done: true, status: run.status };
    }

    for (const item of items) {
      const tenantRoute = await ctx.runMutation(
        internal.tenantScheduler.enqueueTenantJobInternal,
        {
          workspaceId: run.workspaceId,
          userId: run.userId,
          class: "background",
          priority: TENANT_JOB_PRIORITY.background,
          idempotencyKey: `plan-batch-item:${String(item._id)}`,
          payload: {
            kind: "plan_batch_item",
            workspaceId: run.workspaceId,
            runId,
            itemId: item._id,
          },
        }
      );
      const workId =
        tenantRoute.route === "enforced"
          ? String(tenantRoute.jobId)
          : String(
              await getOutreachPlanPool().enqueueAction(
                ctx,
                internal.planBatchActions.processPlanBatchItem,
                { itemId: item._id },
                {
                  onComplete: internal.planBatches.handlePlanBatchItemComplete,
                  context: { runId, itemId: item._id },
                  retry: true,
                }
              )
            );
      await ctx.db.patch("planBatchItems", item._id, {
        status: "queued",
        workId,
        updatedAt: getCurrentUTCTimestamp(),
      });
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch("planBatchRuns", runId, {
      status: "running",
      queuedCount: run.queuedCount + items.length,
      startedAt: run.startedAt ?? now,
      updatedAt: now,
    });
    return {
      done: items.length < DISPATCH_PAGE_SIZE,
      status: "running" as const,
    };
  },
});

export const getPlanBatchDispatchSelectionInternal = internalQuery({
  args: { runId: v.id("planBatchRuns") },
  returns: planBatchDispatchSelectionValidator,
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get("planBatchRuns", runId);
    if (!run || (run.status !== "queued" && run.status !== "running")) {
      return null;
    }
    const items = await ctx.db
      .query("planBatchItems")
      .withIndex("by_run_and_status", (q) =>
        q.eq("runId", runId).eq("status", "pending")
      )
      .take(DISPATCH_PAGE_SIZE);
    return {
      workspaceId: run.workspaceId,
      userId: run.userId,
      itemIds: items.map((item) => item._id),
      status: run.status,
    };
  },
});

export const dispatchPlanBatchItemInternal = internalMutation({
  args: {
    runId: v.id("planBatchRuns"),
    itemId: v.id("planBatchItems"),
  },
  returns: planBatchDispatchItemResultValidator,
  handler: async (ctx, { runId, itemId }) => {
    const [run, item] = await Promise.all([
      ctx.db.get("planBatchRuns", runId),
      ctx.db.get("planBatchItems", itemId),
    ]);
    if (!run || (run.status !== "queued" && run.status !== "running")) {
      return null;
    }
    if (!item || item.runId !== runId || item.status !== "pending") {
      return { dispatched: false, status: run.status };
    }

    const tenantRoute = await ctx.runMutation(
      internal.tenantScheduler.enqueueTenantJobInternal,
      {
        workspaceId: run.workspaceId,
        userId: run.userId,
        class: "background",
        priority: TENANT_JOB_PRIORITY.background,
        idempotencyKey: `plan-batch-item:${String(item._id)}`,
        payload: {
          kind: "plan_batch_item",
          workspaceId: run.workspaceId,
          runId,
          itemId: item._id,
        },
      }
    );
    const workId =
      tenantRoute.route === "enforced"
        ? String(tenantRoute.jobId)
        : String(
            await getOutreachPlanPool().enqueueAction(
              ctx,
              internal.planBatchActions.processPlanBatchItem,
              { itemId: item._id },
              {
                onComplete: internal.planBatches.handlePlanBatchItemComplete,
                context: { runId, itemId: item._id },
                retry: true,
              }
            )
          );
    const now = getCurrentUTCTimestamp();
    await ctx.db.patch("planBatchItems", item._id, {
      status: "queued",
      workId,
      updatedAt: now,
    });
    await ctx.db.patch("planBatchRuns", runId, {
      status: "running",
      queuedCount: run.queuedCount + 1,
      startedAt: run.startedAt ?? now,
      updatedAt: now,
    });
    return { dispatched: true, status: "running" as const };
  },
});

/**
 * Each item mutation atomically enqueues and attaches its work ID. Retrying the
 * same item cannot duplicate a committed dispatch, including legacy/shadow
 * Workpool work, and every failed item has an exact diagnostic key.
 */
export const dispatchPlanBatchPageWithRetryInternal = internalAction({
  args: { runId: v.id("planBatchRuns") },
  returns: planBatchDispatchResultValidator,
  handler: async (ctx, args): Promise<PlanBatchDispatchResult> => {
    const selection: PlanBatchDispatchSelection = await ctx.runQuery(
      internal.planBatches.getPlanBatchDispatchSelectionInternal,
      args
    );
    if (!selection) return null;
    if (selection.itemIds.length === 0) {
      return { done: true, status: selection.status };
    }

    let pageStatus = selection.status;
    for (const itemId of selection.itemIds) {
      let result: PlanBatchDispatchItemResult = null;
      let lastError: unknown;
      for (
        let attempt = 1;
        attempt <= TENANT_ENQUEUE_RECOVERY_MAX_ATTEMPTS;
        attempt++
      ) {
        try {
          result = await ctx.runMutation(
            internal.planBatches.dispatchPlanBatchItemInternal,
            { runId: args.runId, itemId }
          );
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
          await recordTenantJobEnqueueFailure(
            ctx,
            {
              workspaceId: selection.workspaceId,
              userId: selection.userId,
              class: "background",
              kind: "plan_batch_item",
              priority: TENANT_JOB_PRIORITY.background,
              idempotencyKey: `plan-batch-item:${String(itemId)}`,
            },
            error,
            attempt
          );
          if (attempt < TENANT_ENQUEUE_RECOVERY_MAX_ATTEMPTS) {
            await new Promise((resolve) =>
              setTimeout(resolve, getTenantEnqueueRetryDelayMs(attempt))
            );
          }
        }
      }
      if (!result) {
        if (lastError) {
          throw lastError instanceof Error
            ? lastError
            : new Error(stringifyUnknownError(lastError));
        }
        return null;
      }
      pageStatus = result.status;
      if (!["queued", "running"].includes(result.status)) {
        return { done: true, status: result.status };
      }
    }
    return {
      done: selection.itemIds.length < DISPATCH_PAGE_SIZE,
      status: pageStatus,
    };
  },
});

export const getPlanBatchRunInternal = internalQuery({
  args: { runId: v.id("planBatchRuns") },
  returns: v.any(),
  handler: async (ctx, { runId }) => await ctx.db.get("planBatchRuns", runId),
});

export const handlePlanBatchWorkflowComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({ runId: v.id("planBatchRuns") }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.result.kind === "success") {
      return null;
    }

    const run = await ctx.db.get("planBatchRuns", args.context.runId);
    if (!run) {
      return null;
    }
    if (isTerminalPlanBatchStatus(run.status)) {
      if (run.responsePromptMessageId && !run.agentResponseCompletedAt) {
        await ctx.scheduler.runAfter(
          0,
          internal.chat.resumePlanBatchAgentResponse,
          { runId: run._id }
        );
      }
      return null;
    }

    const now = getCurrentUTCTimestamp();
    const errorMessage = getUserSafeErrorMessage(
      args.result.kind === "failed"
        ? args.result.error
        : "Plan batch workflow was cancelled",
      "Plan batch workflow failed"
    );
    await ctx.db.patch("planBatchRuns", run._id, {
      status: "failed",
      errorMessage,
      completedAt: now,
      updatedAt: now,
    });
    const targetNames = await getSmallPlanBatchTargetNames(ctx, run);
    const copy = getPlanBatchNotificationCopy(
      buildPlanBatchCopyState(run, {
        status: "failed",
        targetNames,
      })
    );
    await upsertNotificationByKey(ctx, {
      userId: run.userId,
      workspaceId: run.workspaceId,
      type: "plan_batch_failed",
      title: copy.title,
      message: copy.status,
      notificationKey: buildPlanBatchNotificationKey(run._id),
      targetHref: buildPlanBatchTargetHref(run.sourceThreadId),
      actionLabel: "Open chat",
      threadId: run.sourceThreadId,
    });
    if (run.responsePromptMessageId) {
      await ctx.scheduler.runAfter(
        0,
        internal.chat.resumePlanBatchAgentResponse,
        { runId: run._id }
      );
    }
    await ctx.scheduler.runAfter(
      0,
      internal.planBatches.cancelQueuedPlanBatchItemsPage,
      { runId: run._id }
    );
    return null;
  },
});

export const claimPlanBatchItemInternal = internalMutation({
  args: { itemId: v.id("planBatchItems") },
  returns: v.object({
    shouldRun: v.boolean(),
    cancelled: v.boolean(),
    failed: v.boolean(),
  }),
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get("planBatchItems", itemId);
    if (!item) {
      return { shouldRun: false, cancelled: false, failed: false };
    }
    const run = await ctx.db.get("planBatchRuns", item.runId);
    if (!run) {
      return { shouldRun: false, cancelled: false, failed: false };
    }
    if (run.status === "cancelled" || run.status === "failed") {
      return {
        shouldRun: false,
        cancelled: run.status === "cancelled",
        failed: run.status === "failed",
      };
    }
    if (run.status !== "queued" && run.status !== "running") {
      return { shouldRun: false, cancelled: false, failed: false };
    }
    if (
      item.status === "succeeded" ||
      item.status === "failed" ||
      item.status === "skipped" ||
      item.status === "cancelled"
    ) {
      return {
        shouldRun: false,
        cancelled: item.status === "cancelled",
        failed: item.status === "failed",
      };
    }

    const now = getCurrentUTCTimestamp();
    const firstAttempt = item.status === "queued";
    await ctx.db.patch("planBatchItems", itemId, {
      status: "running",
      attemptCount: item.attemptCount + 1,
      startedAt: item.startedAt ?? now,
      updatedAt: now,
    });
    if (firstAttempt) {
      await ctx.db.patch("planBatchRuns", run._id, {
        queuedCount: Math.max(0, run.queuedCount - 1),
        runningCount: run.runningCount + 1,
        updatedAt: now,
      });
    }
    return { shouldRun: true, cancelled: false, failed: false };
  },
});

export const getPlanBatchExecutionContextInternal = internalQuery({
  args: { itemId: v.id("planBatchItems") },
  returns: v.any(),
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get("planBatchItems", itemId);
    if (!item) return null;
    const [run, prospect, activePlan] = await Promise.all([
      ctx.db.get("planBatchRuns", item.runId),
      ctx.db.get("prospects", item.prospectId),
      getProspectActivePlanDocument(ctx.db, item.prospectId),
    ]);
    if (!run || !prospect) return null;
    return { run, item, prospect, activePlan };
  },
});

export const getPlanBatchItemOutcomeInternal = internalQuery({
  args: { itemId: v.id("planBatchItems") },
  returns: v.any(),
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get("planBatchItems", itemId);
    if (!item) return null;
    return {
      item,
      activePlan: await getProspectActivePlanDocument(ctx.db, item.prospectId),
    };
  },
});

export const handlePlanBatchItemComplete = internalMutation({
  args: vOnCompleteArgs(planBatchWorkCompletionContextValidator),
  returns: v.null(),
  handler: async (ctx, args) => {
    const [run, item] = await Promise.all([
      ctx.db.get("planBatchRuns", args.context.runId),
      ctx.db.get("planBatchItems", args.context.itemId),
    ]);
    if (!run || !item) {
      if (args.context.tenantJobId) {
        await completeTenantJob(ctx, {
          jobId: args.context.tenantJobId,
          status: "failed",
          errorMessage: "Plan batch state was missing",
        });
      }
      return null;
    }
    if (
      item.status === "succeeded" ||
      item.status === "failed" ||
      item.status === "skipped" ||
      item.status === "cancelled"
    ) {
      if (args.context.tenantJobId) {
        await completeTenantJob(ctx, {
          jobId: args.context.tenantJobId,
          status:
            item.status === "cancelled"
              ? "cancelled"
              : item.status === "failed"
                ? "failed"
                : "succeeded",
          errorMessage: item.errorMessage,
        });
      }
      return null;
    }

    const now = getCurrentUTCTimestamp();
    let nextStatus: Doc<"planBatchItems">["status"];
    let planId: Id<"outreachPlans"> | undefined;
    let threadId: string | undefined;
    let skipReason: string | undefined;
    let errorMessage: string | undefined;

    if (run.status === "cancelled") {
      nextStatus = "cancelled";
      errorMessage = "Stopped by the user";
    } else if (args.result.kind === "success") {
      const result = args.result.returnValue as PlanBatchItemResult;
      if (result.outcome === "succeeded") {
        nextStatus = "succeeded";
        planId = result.planId;
        threadId = result.threadId;
      } else if (result.outcome === "skipped") {
        nextStatus = "skipped";
        skipReason = result.reason;
        threadId = result.threadId;
      } else {
        nextStatus = "cancelled";
        errorMessage = result.reason;
      }
    } else {
      nextStatus = "failed";
      errorMessage = getUserSafeErrorMessage(
        args.result.kind === "failed"
          ? args.result.error
          : "Plan creation stopped",
        "Could not finish this plan"
      );
    }

    await ctx.db.patch("planBatchItems", item._id, {
      status: nextStatus,
      planId,
      threadId,
      skipReason,
      errorMessage,
      completedAt: now,
      updatedAt: now,
    });

    const succeededCount =
      run.succeededCount + (nextStatus === "succeeded" ? 1 : 0);
    const createdCount =
      (run.createdCount ?? 0) +
      (nextStatus === "succeeded" && item.operation === "create" ? 1 : 0);
    const updatedCount =
      (run.updatedCount ?? 0) +
      (nextStatus === "succeeded" && item.operation === "update" ? 1 : 0);
    const failedCount = run.failedCount + (nextStatus === "failed" ? 1 : 0);
    const skippedCount = run.skippedCount + (nextStatus === "skipped" ? 1 : 0);
    const finishedCount =
      run.finishedCount + (nextStatus === "cancelled" ? 0 : 1);
    const nextRunPatch = {
      queuedCount:
        item.status === "queued"
          ? Math.max(0, run.queuedCount - 1)
          : run.queuedCount,
      runningCount:
        item.status === "running"
          ? Math.max(0, run.runningCount - 1)
          : run.runningCount,
      succeededCount,
      createdCount,
      updatedCount,
      failedCount,
      skippedCount,
      finishedCount,
      updatedAt: now,
    };
    await ctx.db.patch("planBatchRuns", run._id, nextRunPatch);
    if (args.context.tenantJobId) {
      await completeTenantJob(ctx, {
        jobId: args.context.tenantJobId,
        status:
          nextStatus === "cancelled"
            ? "cancelled"
            : nextStatus === "failed"
              ? "failed"
              : "succeeded",
        errorMessage,
      });
    }

    if (run.status === "cancelled" || finishedCount < run.eligibleCount) {
      return null;
    }

    const terminalStatus: Doc<"planBatchRuns">["status"] =
      failedCount === 0
        ? "completed"
        : succeededCount > 0
          ? "partial"
          : "failed";
    await ctx.db.patch("planBatchRuns", run._id, {
      ...nextRunPatch,
      status: terminalStatus,
      completedAt: now,
    });

    const notificationType =
      terminalStatus === "failed"
        ? "plan_batch_failed"
        : terminalStatus === "partial"
          ? "plan_batch_partial"
          : "plan_batch_completed";
    const completedRun = {
      ...run,
      ...nextRunPatch,
      status: terminalStatus,
      completedAt: now,
    };
    const targetNames = await getSmallPlanBatchTargetNames(ctx, completedRun);
    const copy = getPlanBatchNotificationCopy(
      buildPlanBatchCopyState(completedRun, {
        status: terminalStatus,
        targetNames,
        succeededCount,
        failedCount,
        skippedCount,
        createdCount,
        updatedCount,
      })
    );
    await upsertNotificationByKey(ctx, {
      userId: run.userId,
      workspaceId: run.workspaceId,
      type: notificationType,
      title: copy.title,
      message: copy.status,
      notificationKey: buildPlanBatchNotificationKey(run._id),
      targetHref: buildPlanBatchTargetHref(run.sourceThreadId),
      actionLabel: "Open chat",
      threadId: run.sourceThreadId,
    });
    await signalPlanBatchWorkflow(ctx, completedRun);
    return null;
  },
});

export const getPlanBatchRun = query({
  args: { runId: v.id("planBatchRuns") },
  returns: v.any(),
  handler: async (ctx, { runId }) => {
    const user = await requireUser(ctx);
    const run = await ctx.db.get("planBatchRuns", runId);
    if (!run || run.userId !== user._id) {
      return null;
    }
    await requireOwnedWorkspace(ctx, run.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized",
    });
    const showNamedIssues = run.eligibleCount > 0 && run.eligibleCount <= 2;
    const targetNamesPromise = getSmallPlanBatchTargetNames(ctx, run);
    const failedItems = showNamedIssues
      ? await ctx.db
          .query("planBatchItems")
          .withIndex("by_run_and_status", (q) =>
            q.eq("runId", runId).eq("status", "failed")
          )
          .take(2)
      : [];
    const issues = await Promise.all(
      failedItems.map(async (item) => {
        const prospect = await ctx.db.get("prospects", item.prospectId);
        return {
          id: String(item._id),
          prospectName: item.prospectName || getProspectDisplayLabel(prospect),
          reason: item.errorMessage ?? "Could not finish this plan",
        };
      })
    );
    const targetNames = await targetNamesPromise;
    return {
      _id: run._id,
      operation: run.operation,
      scopeKind: run.scopeKind,
      fitScoreMin: run.fitScoreMin,
      fitScoreMax: run.fitScoreMax,
      status: run.status,
      targetCount: run.targetCount,
      eligibleCount: run.eligibleCount,
      succeededCount: run.succeededCount,
      createdCount: run.createdCount ?? 0,
      updatedCount: run.updatedCount ?? 0,
      failedCount: run.failedCount,
      skippedCount: run.skippedCount,
      selectionSkippedCount: run.selectionSkippedCount,
      finishedCount: run.finishedCount,
      targetNames,
      issues,
    };
  },
});

export const getPlanBatchAgentResponseContextInternal = internalQuery({
  args: { runId: v.id("planBatchRuns") },
  returns: v.any(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get("planBatchRuns", runId);
    if (!run) {
      return null;
    }

    const [targetNames, failedItems] = await Promise.all([
      getSmallPlanBatchTargetNames(ctx, run),
      ctx.db
        .query("planBatchItems")
        .withIndex("by_run_and_status", (q) =>
          q.eq("runId", runId).eq("status", "failed")
        )
        .take(10),
    ]);

    return {
      runId: run._id,
      threadId: run.sourceThreadId,
      promptMessageId: run.responsePromptMessageId,
      responseStartedAt: run.agentResponseStartedAt,
      responseCompletedAt: run.agentResponseCompletedAt,
      result: {
        status: run.status,
        operation: run.operation,
        targetCount: run.targetCount,
        eligibleCount: run.eligibleCount,
        succeededCount: run.succeededCount,
        createdCount: run.createdCount ?? 0,
        updatedCount: run.updatedCount ?? 0,
        failedCount: run.failedCount,
        skippedCount: run.skippedCount,
        errorMessage: run.errorMessage,
        targetNames,
        issues: failedItems.map((item) => ({
          prospectName: item.prospectName ?? "Prospect",
          reason: item.errorMessage ?? "Could not finish this plan",
        })),
      },
    };
  },
});

export const claimPlanBatchAgentResponseInternal = internalMutation({
  args: { runId: v.id("planBatchRuns") },
  returns: v.union(
    v.object({
      startedAt: v.number(),
      shouldGenerate: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get("planBatchRuns", runId);
    if (
      !run ||
      !run.responsePromptMessageId ||
      !isTerminalPlanBatchStatus(run.status)
    ) {
      return null;
    }

    if (run.agentResponseCompletedAt) {
      return {
        startedAt: run.agentResponseStartedAt ?? run.agentResponseCompletedAt,
        shouldGenerate: false,
      };
    }

    if (run.agentResponseStartedAt && !run.agentResponseError) {
      return {
        startedAt: run.agentResponseStartedAt,
        shouldGenerate: false,
      };
    }

    const startedAt = run.agentResponseStartedAt ?? getCurrentUTCTimestamp();
    await ctx.db.patch("planBatchRuns", runId, {
      agentResponseStartedAt: startedAt,
      agentResponseError: undefined,
      updatedAt: getCurrentUTCTimestamp(),
    });
    return { startedAt, shouldGenerate: true };
  },
});

export const completePlanBatchAgentResponseInternal = internalMutation({
  args: { runId: v.id("planBatchRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get("planBatchRuns", runId);
    if (!run || run.agentResponseCompletedAt) {
      return null;
    }

    await ctx.db.patch("planBatchRuns", runId, {
      agentResponseCompletedAt: getCurrentUTCTimestamp(),
      agentResponseError: undefined,
      updatedAt: getCurrentUTCTimestamp(),
    });
    return null;
  },
});

export const reopenPlanBatchAgentResponseInternal = internalMutation({
  args: {
    runId: v.id("planBatchRuns"),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { runId, errorMessage }) => {
    const run = await ctx.db.get("planBatchRuns", runId);
    if (!run || !isTerminalPlanBatchStatus(run.status)) {
      return null;
    }

    await ctx.db.patch("planBatchRuns", runId, {
      agentResponseCompletedAt: undefined,
      agentResponseError: errorMessage,
      updatedAt: getCurrentUTCTimestamp(),
    });
    return null;
  },
});

export const failPlanBatchAgentResponseInternal = internalMutation({
  args: {
    runId: v.id("planBatchRuns"),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { runId, errorMessage }) => {
    const run = await ctx.db.get("planBatchRuns", runId);
    if (!run || run.agentResponseCompletedAt) {
      return null;
    }

    await ctx.db.patch("planBatchRuns", runId, {
      agentResponseError: errorMessage,
      updatedAt: getCurrentUTCTimestamp(),
    });
    return null;
  },
});

export const getPlanBatchTurnState = query({
  args: { messageId: v.string() },
  returns: v.union(
    v.object({
      status: planBatchRunStatusValidator,
      agentResponseCompleted: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, { messageId }) => {
    const user = await requireUser(ctx);
    const run = await ctx.db
      .query("planBatchRuns")
      .withIndex("by_response_prompt_message_id", (q) =>
        q.eq("responsePromptMessageId", messageId)
      )
      .first();
    if (!run || run.userId !== user._id) {
      return null;
    }
    await requireOwnedWorkspace(ctx, run.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized",
    });

    return {
      status: run.status,
      agentResponseCompleted: Boolean(run.agentResponseCompletedAt),
    };
  },
});

export const getLatestPlanBatchRunInternal = internalQuery({
  args: {
    sourceThreadId: v.string(),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  returns: v.any(),
  handler: async (ctx, args) => await findLatestPlanBatchRun(ctx, args),
});

export const getPlanBatchRunByReferenceInternal = internalQuery({
  args: {
    sourceThreadId: v.string(),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    reference: v.string(),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("planBatchRuns")
      .withIndex("by_thread_and_reference_key", (q) =>
        q
          .eq("sourceThreadId", args.sourceThreadId)
          .eq("referenceKey", args.reference)
      )
      .unique();
    if (
      !run ||
      run.workspaceId !== args.workspaceId ||
      run.userId !== args.userId
    ) {
      return null;
    }
    return run;
  },
});

export const listPlanBatchSucceededItemsInternal = internalQuery({
  args: {
    runId: v.id("planBatchRuns"),
    limit: v.number(),
  },
  returns: v.any(),
  handler: async (ctx, args) =>
    await ctx.db
      .query("planBatchItems")
      .withIndex("by_run_and_status", (q) =>
        q.eq("runId", args.runId).eq("status", "succeeded")
      )
      .take(Math.max(1, Math.min(10, Math.round(args.limit)))),
});
