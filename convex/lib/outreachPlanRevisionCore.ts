import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  outreachPlanRevisionTaskSnapshotValidator,
  outreachPlanRevisionTriggerValidator,
} from "../validators";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";

export type OutreachPlanRevisionTrigger = Infer<
  typeof outreachPlanRevisionTriggerValidator
>;

export type OutreachPlanRevisionTaskSnapshot = Infer<
  typeof outreachPlanRevisionTaskSnapshotValidator
>;

type PlanRevisionSource = Pick<
  Doc<"outreachPlans">,
  | "_id"
  | "prospectId"
  | "workspaceId"
  | "userId"
  | "version"
  | "status"
  | "strategy"
  | "threadId"
>;

export function buildOutreachPlanRevisionTaskSnapshot(
  task: Doc<"outreachTasks">
): OutreachPlanRevisionTaskSnapshot {
  return {
    taskId: task._id,
    order: task.order,
    type: task.type,
    description: task.description,
    status: task.status,
    timing: task.timing,
    targetTweetId: task.targetTweetId,
    targetCommentId: task.targetCommentId,
    reactionType: task.reactionType,
    content: task.content,
    originalDraftContent: task.originalDraftContent,
    mediaUrls: task.mediaUrls,
    mediaUploadIds: task.mediaUploadIds,
    mediaDescriptions: task.mediaDescriptions,
    mediaKinds: task.mediaKinds,
    approvalContext: task.approvalContext,
    approvedAt: task.approvedAt,
    scheduledAt: task.scheduledAt,
    executedAt: task.executedAt,
    resultData: task.resultData,
    errorMessage: task.errorMessage,
  };
}

export async function persistOutreachPlanRevision(
  ctx: MutationCtx,
  args: {
    plan: PlanRevisionSource;
    tasks: Doc<"outreachTasks">[];
    trigger: OutreachPlanRevisionTrigger;
    previousVersion?: number;
  }
): Promise<Id<"outreachPlanRevisions">> {
  if (args.trigger.sourceEventKey) {
    const existingForEvent = await ctx.db
      .query("outreachPlanRevisions")
      .withIndex("by_source_event_key", (q) =>
        q.eq("sourceEventKey", args.trigger.sourceEventKey)
      )
      .unique();
    if (existingForEvent) {
      return existingForEvent._id;
    }
  }

  const existing = await ctx.db
    .query("outreachPlanRevisions")
    .withIndex("by_plan_and_version", (q) =>
      q.eq("planId", args.plan._id).eq("version", args.plan.version)
    )
    .unique();
  if (existing) {
    await ctx.db.patch("outreachPlans", args.plan._id, {
      currentRevisionId: existing._id,
    });
    return existing._id;
  }

  const revisionId = await ctx.db.insert("outreachPlanRevisions", {
    planId: args.plan._id,
    prospectId: args.plan.prospectId,
    workspaceId: args.plan.workspaceId,
    userId: args.plan.userId,
    version: args.plan.version,
    previousVersion: args.previousVersion,
    status: args.plan.status,
    strategy: args.plan.strategy,
    threadId: args.plan.threadId,
    tasks: [...args.tasks]
      .filter((task) => task.supersededAt === undefined)
      .sort((left, right) => left.order - right.order)
      .map(buildOutreachPlanRevisionTaskSnapshot),
    trigger: args.trigger,
    sourceEventKey: args.trigger.sourceEventKey,
    createdAt: getCurrentUTCTimestamp(),
  });

  await ctx.db.patch("outreachPlans", args.plan._id, {
    currentRevisionId: revisionId,
  });
  return revisionId;
}

export async function ensureCurrentOutreachPlanRevision(
  ctx: MutationCtx,
  plan: PlanRevisionSource,
  tasks: Doc<"outreachTasks">[]
): Promise<Id<"outreachPlanRevisions">> {
  return await persistOutreachPlanRevision(ctx, {
    plan,
    tasks,
    previousVersion: plan.version > 1 ? plan.version - 1 : undefined,
    trigger: {
      kind: "migration_snapshot",
      actor: "migration",
      reason: "Captured the current plan before applying a newer revision.",
    },
  });
}
