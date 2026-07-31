import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { startOutreachPlanExecution } from "./outreachApprovalCore";
import { recordMemoryWorkflowEvent } from "./memoryCore";
import { getResolvedWorkspaceAgentSettings } from "./workspaceAgentSettingsCore";

const PLAN_START_PREVIEW_LIMIT = 1_000;
const PLAN_START_BATCH_SIZE = 5;
const PLAN_START_STAGGER_MS = 12_000;
const PLAN_START_BATCH_DELAY_MS = PLAN_START_BATCH_SIZE * PLAN_START_STAGGER_MS;
const APPROVAL_RELEASE_PLAN_PAGE_SIZE = 10;

type PlanStartCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

export type WorkspacePlanStartPreview = {
  draftPlanCount: number;
  draftPlanCountIsCapped: boolean;
};

async function getWorkspaceDraftPlanSnapshot(
  ctx: PlanStartCtx,
  workspaceId: Id<"workspaces">
): Promise<WorkspacePlanStartPreview & { snapshotAt: number }> {
  const [drafts, newestDraft] = await Promise.all([
    ctx.db
      .query("outreachPlans")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", workspaceId).eq("status", "draft")
      )
      .take(PLAN_START_PREVIEW_LIMIT + 1),
    ctx.db
      .query("outreachPlans")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", workspaceId).eq("status", "draft")
      )
      .order("desc")
      .first(),
  ]);

  return {
    draftPlanCount: Math.min(drafts.length, PLAN_START_PREVIEW_LIMIT),
    draftPlanCountIsCapped: drafts.length > PLAN_START_PREVIEW_LIMIT,
    snapshotAt: newestDraft?._creationTime ?? getCurrentUTCTimestamp(),
  };
}

export async function getWorkspacePlanStartPreview(
  ctx: PlanStartCtx,
  workspaceId: Id<"workspaces">
): Promise<WorkspacePlanStartPreview> {
  const { draftPlanCount, draftPlanCountIsCapped } =
    await getWorkspaceDraftPlanSnapshot(ctx, workspaceId);
  return { draftPlanCount, draftPlanCountIsCapped };
}

export async function prepareWorkspacePlanStartRun(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
    source: Doc<"workspacePlanStartRuns">["source"];
    sourceThreadId?: string;
    requireConfirmation: boolean;
    createWhenNoDrafts?: boolean;
    autonomyMode?: Doc<"workspacePlanStartRuns">["autonomyMode"];
  }
): Promise<{
  runId: Id<"workspacePlanStartRuns"> | null;
  autonomyMode: Doc<"workspacePlanStartRuns">["autonomyMode"];
  draftPlanCount: number;
  draftPlanCountIsCapped: boolean;
}> {
  const workspace = await ctx.db.get("workspaces", args.workspaceId);
  if (!workspace || workspace.userId !== args.userId) {
    throw new Error("Workspace not found");
  }

  if (args.requireConfirmation && !args.sourceThreadId) {
    throw new Error("A workspace thread is required for confirmation");
  }

  const [snapshot, settings] = await Promise.all([
    getWorkspaceDraftPlanSnapshot(ctx, args.workspaceId),
    getResolvedWorkspaceAgentSettings(ctx, workspace),
  ]);
  const preview = {
    draftPlanCount: snapshot.draftPlanCount,
    draftPlanCountIsCapped: snapshot.draftPlanCountIsCapped,
  };
  const autonomyMode = args.autonomyMode ?? settings.autonomyMode;

  if (preview.draftPlanCount === 0 && !args.createWhenNoDrafts) {
    return {
      runId: null,
      autonomyMode,
      ...preview,
    };
  }

  const now = getCurrentUTCTimestamp();
  if (args.sourceThreadId) {
    const previousPending = await ctx.db
      .query("workspacePlanStartRuns")
      .withIndex("by_thread_and_status", (q) =>
        q
          .eq("sourceThreadId", args.sourceThreadId)
          .eq("status", "awaiting_confirmation")
      )
      .order("desc")
      .first();
    if (previousPending) {
      await ctx.db.patch("workspacePlanStartRuns", previousPending._id, {
        status: "cancelled",
        completedAt: now,
        updatedAt: now,
      });
    }
  }

  const status: Doc<"workspacePlanStartRuns">["status"] =
    args.requireConfirmation ? "awaiting_confirmation" : "queued";
  const runId = await ctx.db.insert("workspacePlanStartRuns", {
    workspaceId: args.workspaceId,
    userId: args.userId,
    source: args.source,
    sourceThreadId: args.sourceThreadId,
    status,
    autonomyMode,
    snapshotAt: snapshot.snapshotAt,
    targetPlanCount: preview.draftPlanCount,
    targetPlanCountIsCapped: preview.draftPlanCountIsCapped,
    startedPlanCount: 0,
    skippedPlanCount: 0,
    releasedTaskCount: 0,
    planStartCompleted: preview.draftPlanCount === 0,
    approvalReleaseCompleted: autonomyMode !== "autonomous",
    confirmedAt: args.requireConfirmation ? undefined : now,
    createdAt: now,
    updatedAt: now,
  });

  return {
    runId,
    autonomyMode,
    ...preview,
  };
}

export async function confirmLatestWorkspacePlanStartRun(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
    sourceThreadId: string;
  }
): Promise<Doc<"workspacePlanStartRuns"> | null> {
  const run = await ctx.db
    .query("workspacePlanStartRuns")
    .withIndex("by_thread_and_status", (q) =>
      q
        .eq("sourceThreadId", args.sourceThreadId)
        .eq("status", "awaiting_confirmation")
    )
    .order("desc")
    .first();

  if (
    !run ||
    run.workspaceId !== args.workspaceId ||
    run.userId !== args.userId
  ) {
    return null;
  }

  const now = getCurrentUTCTimestamp();
  await ctx.db.patch("workspacePlanStartRuns", run._id, {
    status: "queued",
    confirmedAt: now,
    updatedAt: now,
  });

  await scheduleWorkspacePlanStartRun(ctx, run._id, run.autonomyMode);
  return { ...run, status: "queued", confirmedAt: now, updatedAt: now };
}

export async function scheduleWorkspacePlanStartRun(
  ctx: Pick<MutationCtx, "scheduler">,
  runId: Id<"workspacePlanStartRuns">,
  autonomyMode: Doc<"workspacePlanStartRuns">["autonomyMode"]
): Promise<void> {
  await ctx.scheduler.runAfter(
    0,
    internal.workspacePlanStarts.processWorkspacePlanStartBatchInternal,
    { runId }
  );
  if (autonomyMode === "autonomous") {
    await ctx.scheduler.runAfter(
      0,
      internal.workspacePlanStarts.releasePendingApprovalsBatchInternal,
      { runId, cursor: null }
    );
  }
}

function isProspectEligibleForPlanStart(
  prospect: Doc<"prospects"> | null
): prospect is Doc<"prospects"> {
  return Boolean(
    prospect &&
    prospect.status !== "archived" &&
    prospect.qualificationStatus === "qualified"
  );
}

async function completeRunBranch(
  ctx: MutationCtx,
  run: Doc<"workspacePlanStartRuns">,
  args: {
    planStartCompleted?: boolean;
    approvalReleaseCompleted?: boolean;
    startedPlanCountDelta?: number;
    skippedPlanCountDelta?: number;
    releasedTaskCountDelta?: number;
  }
) {
  const now = getCurrentUTCTimestamp();
  const planStartCompleted = args.planStartCompleted ?? run.planStartCompleted;
  const approvalReleaseCompleted =
    args.approvalReleaseCompleted ?? run.approvalReleaseCompleted;
  const completed = planStartCompleted && approvalReleaseCompleted;

  await ctx.db.patch("workspacePlanStartRuns", run._id, {
    planStartCompleted,
    approvalReleaseCompleted,
    startedPlanCount: run.startedPlanCount + (args.startedPlanCountDelta ?? 0),
    skippedPlanCount: run.skippedPlanCount + (args.skippedPlanCountDelta ?? 0),
    releasedTaskCount:
      run.releasedTaskCount + (args.releasedTaskCountDelta ?? 0),
    status: completed ? "completed" : "running",
    completedAt: completed ? now : undefined,
    updatedAt: now,
  });
}

export async function processWorkspacePlanStartBatch(
  ctx: MutationCtx,
  runId: Id<"workspacePlanStartRuns">
): Promise<void> {
  const run = await ctx.db.get("workspacePlanStartRuns", runId);
  if (
    !run ||
    run.status === "awaiting_confirmation" ||
    run.status === "cancelled" ||
    run.status === "completed"
  ) {
    return;
  }

  const drafts = await ctx.db
    .query("outreachPlans")
    .withIndex("by_workspace_status", (q) =>
      q.eq("workspaceId", run.workspaceId).eq("status", "draft")
    )
    .order("asc")
    .take(PLAN_START_BATCH_SIZE);
  const snapshotDrafts = drafts.filter(
    (plan) => plan._creationTime <= run.snapshotAt
  );

  if (snapshotDrafts.length === 0) {
    await completeRunBranch(ctx, run, { planStartCompleted: true });
    return;
  }

  let startedPlanCount = 0;
  let skippedPlanCount = 0;
  for (const [index, plan] of snapshotDrafts.entries()) {
    const prospect = await ctx.db.get("prospects", plan.prospectId);
    if (!isProspectEligibleForPlanStart(prospect)) {
      await ctx.db.patch("outreachPlans", plan._id, {
        status: "abandoned",
        updatedAt: getCurrentUTCTimestamp(),
      });
      await recordMemoryWorkflowEvent(ctx, {
        workspaceId: plan.workspaceId,
        eventType: "outreach_plan_abandoned",
        sourceType: "outreach_plan",
        sourceId: String(plan._id),
        planId: plan._id,
        prospectId: plan.prospectId,
        payload: {
          previousStatus: "draft",
          nextStatus: "abandoned",
          reason: "prospect_ineligible",
        },
      });
      skippedPlanCount += 1;
      continue;
    }

    const result = await startOutreachPlanExecution(ctx, plan._id, {
      runAfterMs: index * PLAN_START_STAGGER_MS,
      approvalSource:
        run.source === "agent_command" ? "agent_command" : "autonomy",
    });
    if (result.started) {
      startedPlanCount += 1;
    }
  }

  await completeRunBranch(ctx, run, {
    startedPlanCountDelta: startedPlanCount,
    skippedPlanCountDelta: skippedPlanCount,
  });
  await ctx.scheduler.runAfter(
    PLAN_START_BATCH_DELAY_MS,
    internal.workspacePlanStarts.processWorkspacePlanStartBatchInternal,
    { runId }
  );
}

export async function releasePendingApprovalsBatch(
  ctx: MutationCtx,
  args: {
    runId: Id<"workspacePlanStartRuns">;
    cursor: string | null;
  }
): Promise<void> {
  const run = await ctx.db.get("workspacePlanStartRuns", args.runId);
  if (
    !run ||
    run.autonomyMode !== "autonomous" ||
    run.status === "awaiting_confirmation" ||
    run.status === "cancelled" ||
    run.status === "completed"
  ) {
    return;
  }

  const page = await ctx.db
    .query("outreachPlans")
    .withIndex("by_workspace_status", (q) =>
      q.eq("workspaceId", run.workspaceId).eq("status", "executing")
    )
    .paginate({
      cursor: args.cursor,
      numItems: APPROVAL_RELEASE_PLAN_PAGE_SIZE,
    });

  let releasedTaskCount = 0;
  for (const plan of page.page) {
    const tasks = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .collect();

    for (const task of tasks) {
      if (
        (task.type !== "comment" &&
          task.type !== "dm" &&
          task.type !== "react") ||
        (task.status !== "pending" && task.status !== "executing") ||
        !task.approvalEventId ||
        task.approvedAt
      ) {
        continue;
      }

      await ctx.db.patch("outreachTasks", task._id, {
        approvedAt: getCurrentUTCTimestamp(),
      });
      await recordMemoryWorkflowEvent(ctx, {
        workspaceId: plan.workspaceId,
        eventType: "outreach_task_approved",
        sourceType: "outreach_task",
        sourceId: String(task._id),
        planId: plan._id,
        taskId: task._id,
        prospectId: plan.prospectId,
        payload: {
          edited: false,
          approvalSource: "autonomy",
        },
        eventKey: `outreach-task:${task._id}:approved:${task.approvalNonce ?? 0}`,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.workflows.outreach.sendTaskApproval,
        {
          approvalEventId: task.approvalEventId,
          taskId: task._id,
        }
      );
      releasedTaskCount += 1;
    }
  }

  await completeRunBranch(ctx, run, {
    approvalReleaseCompleted: page.isDone,
    releasedTaskCountDelta: releasedTaskCount,
  });
  if (!page.isDone) {
    await ctx.scheduler.runAfter(
      0,
      internal.workspacePlanStarts.releasePendingApprovalsBatchInternal,
      {
        runId: args.runId,
        cursor: page.continueCursor,
      }
    );
  }
}
