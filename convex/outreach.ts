// convex/outreach.ts
// Public queries and internal mutations for outreach system
// Following existing patterns from prospects.ts

import { v } from "convex/values";
import { type QueryCtx, type MutationCtx } from "./_generated/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./lib/functionBuilders";
import { Id, Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  buildPlanSnapshot,
  getProspectActivePlan,
  createOutreachPlan,
  refinePlan as refinePlanCore,
  approvePlan as approvePlanCore,
  getProspectActivityLog,
  logProspectActivity,
  createNotification,
  type OutreachPlanInput,
  type OutreachPlanSnapshot,
  type OutreachTaskInput,
} from "./lib/outreachCore";
import { recordMemoryWorkflowEvent } from "./lib/memoryCore";
import {
  extractAvatarUrl,
  extractDisplayName,
  extractScreenName,
  getProspectDisplayFields,
  upsertNotificationByKey,
  dismissNotificationsByKey,
} from "./lib/notificationHelpers";
import {
  outreachStrategyValidator,
  outreachTaskTimingValidator,
  outreachTaskTypeValidator,
  outreachEditableTaskTypeValidator,
  outreachTaskApprovalContextValidator,
  outreachPlanStatusValidator,
  outreachPlanArchiveHoldPreviousStatusValidator,
  outreachTaskStatusValidator,
  prospectActivityTypeValidator,
  prospectTypeValidator,
  prospectPlatformValidator,
  prospectStatusValidator,
  twitterConversationParticipantValidator,
  twitterInteractionDirectionValidator,
  twitterInteractionDiscoverySourceValidator,
  twitterInteractionOriginValidator,
  twitterInteractionStatusValidator,
  twitterMediaKindValidator,
  twitterPostRefValidator,
  twitterPostSummaryValidator,
} from "./validators";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { workflow as workflowManager } from "./lib/workflow";
import {
  getNestedRecord,
  getNumberProperty,
  getStringProperty,
  isRecord,
} from "./lib/typeGuards";
import {
  getDefaultWorkspaceForUser,
  getOwnedTask,
  requireOwnedPlan,
  requireOwnedProspect,
  requireOwnedTask,
  requireOwnedWorkspace,
  getUserByIdentity,
  requireUser,
  requireProspectNotArchived,
} from "./lib/accessHelpers";
import { getWorkspaceUseCase } from "../shared/lib/workspaceUseCases";
import {
  getTwitterPostId,
  getTwitterPostRef,
  summarizeTwitterPost,
  type TwitterConversationParticipant,
  type TwitterPostRef,
  type TwitterPostSummary,
} from "../shared/lib/twitter/contracts";
import { toFallbackTweetFromSummary } from "../shared/lib/twitter/ui";
import {
  getDmTextLimitError,
  getPostTextLimitError,
  getXPostWeightedLength,
  hasDmBody,
  hasPostBody,
} from "../shared/lib/twitter/xPostTextLimit";
import { getEffectivePostTextLimitForUser } from "./lib/xPostLimits";
import { resumeOutreachPlansAfterUnarchiveCore } from "./lib/resumeOutreachAfterUnarchive";

type PanelMode = "approval" | "posted";

const DEFAULT_ACTIVITY_PAGE_SIZE = 20;
const MAX_ACTIVITY_PAGE_SIZE = 100;
const AUTH_FAILURE_CLASSES = new Set(["reauth_required", "scope_missing"]);
const LINKEDIN_DM_TEXT_MAX = 8_000;
const OUTREACH_TASK_TYPES = new Set<Doc<"outreachTasks">["type"]>([
  "comment",
  "dm",
  "wait",
  "ask_human",
]);
const OUTREACH_TASK_STATUSES = new Set<Doc<"outreachTasks">["status"]>([
  "pending",
  "scheduled",
  "executing",
  "waiting_response",
  "completed",
  "skipped",
  "failed",
]);
const OUTREACH_PLAN_STATUSES = new Set<Doc<"outreachPlans">["status"]>([
  "draft",
  "approved",
  "executing",
  "paused",
  "blocked_auth",
  "completed",
  "abandoned",
]);

function buildAccountHealthNotificationKey(platform: "twitter" | "linkedin") {
  return `account-health:${platform}`;
}

function buildProspectsFoundNotificationKey(
  workspaceId: Id<"workspaces">,
  workflowId: string
) {
  return `prospects-found:${workspaceId}:${workflowId}`;
}

function buildPlanCompletedNotificationKey(planId: Id<"outreachPlans">) {
  return `plan-completed:${planId}`;
}

async function syncPlanCompletedNotification(
  ctx: MutationCtx,
  plan: Doc<"outreachPlans">,
  status: Doc<"outreachPlans">["status"]
) {
  const notificationKey = buildPlanCompletedNotificationKey(plan._id);
  if (status !== "completed") {
    await dismissNotificationsByKey(ctx, {
      userId: plan.userId,
      workspaceId: plan.workspaceId,
      notificationKey,
    });
    return;
  }

  const prospect = await ctx.db.get(plan.prospectId);
  const display = getProspectDisplayFields(prospect);
  const workspace = await ctx.db.get(plan.workspaceId);
  const useCase = getWorkspaceUseCase(workspace?.useCaseKey);
  const name =
    display.prospectDisplayName ?? useCase.entitySingular.toLowerCase();

  await upsertNotificationByKey(ctx, {
    userId: plan.userId,
    workspaceId: plan.workspaceId,
    type: "plan_completed",
    notificationKey,
    title: `Plan completed for ${name}`,
    message: "All planned outreach tasks are done.",
    prospectId: plan.prospectId,
    planId: plan._id,
    threadId: plan.threadId,
    ...display,
  });
}

async function requireViewerUser(ctx: QueryCtx | MutationCtx) {
  return requireUser(ctx, { notFoundMessage: "User not found" });
}

function normalizeMediaKinds(
  mediaKinds: unknown,
  mediaUrls: string[]
): Array<"image" | "gif" | "video"> {
  const normalized = Array.isArray(mediaKinds)
    ? mediaKinds.filter(
        (value): value is "image" | "gif" | "video" =>
          value === "image" || value === "gif" || value === "video"
      )
    : [];

  return normalized.slice(0, mediaUrls.length);
}

function parseOutreachTaskType(value: unknown): Doc<"outreachTasks">["type"] {
  return typeof value === "string" &&
    OUTREACH_TASK_TYPES.has(value as Doc<"outreachTasks">["type"])
    ? (value as Doc<"outreachTasks">["type"])
    : "comment";
}

function parseOutreachTaskStatus(
  value: unknown
): Doc<"outreachTasks">["status"] {
  return typeof value === "string" &&
    OUTREACH_TASK_STATUSES.has(value as Doc<"outreachTasks">["status"])
    ? (value as Doc<"outreachTasks">["status"])
    : "pending";
}

function parseOutreachPlanStatus(
  value: unknown
): Doc<"outreachPlans">["status"] | null {
  return typeof value === "string" &&
    OUTREACH_PLAN_STATUSES.has(value as Doc<"outreachPlans">["status"])
    ? (value as Doc<"outreachPlans">["status"])
    : null;
}

function getPanelModeForStatus(status: string): PanelMode | null {
  if (status === "pending" || status === "executing") {
    return "approval";
  }

  if (status === "waiting_response" || status === "completed") {
    return "posted";
  }

  return null;
}

function getTweetIdFromPostData(postData: unknown): string | null {
  return getTwitterPostId(postData) ?? null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function getFailureClassification(resultData: unknown): string | null {
  if (!isRecord(resultData)) return null;
  const error = getNestedRecord(resultData, "error");
  return (
    getStringProperty(error, "classification") ??
    getStringProperty(error, "type") ??
    null
  );
}

function getPostedTweetId(resultData: unknown): string | null {
  if (!isRecord(resultData)) return null;
  return getStringProperty(resultData, "postedTweetId") ?? null;
}

function getRecordedPlatform(
  task: Pick<Doc<"outreachTasks">, "approvalContext">,
  prospect?: Pick<Doc<"prospects">, "platform"> | null
): "twitter" | "linkedin" {
  return (
    task.approvalContext?.platform ??
    (prospect?.platform === "linkedin" ? "linkedin" : "twitter")
  );
}

async function getTaskDraftValidationError(
  ctx: MutationCtx,
  args: {
    task: Pick<
      Doc<"outreachTasks">,
      "type" | "description" | "approvalContext" | "mediaUrls"
    >;
    prospect?: Pick<Doc<"prospects">, "platform"> | null;
    userId: Id<"users">;
    content: string;
    mediaUrls: string[];
  }
): Promise<string | null> {
  if (args.task.type === "comment") {
    if (!hasPostBody(args.content, args.mediaUrls)) {
      return "Reply text or media is required";
    }

    const postLimit = await getEffectivePostTextLimitForUser(ctx, args.userId);
    return args.content ? getPostTextLimitError(args.content, postLimit) : null;
  }

  if (args.task.type === "dm") {
    if (!hasDmBody(args.content, args.mediaUrls)) {
      return "DM content is required";
    }

    const platform = getRecordedPlatform(args.task, args.prospect);
    if (platform === "linkedin") {
      return args.content.length > LINKEDIN_DM_TEXT_MAX
        ? `LinkedIn DM text exceeds limit (${args.content.length} characters, max ${LINKEDIN_DM_TEXT_MAX}).`
        : null;
    }

    if (args.mediaUrls.length > 1) {
      return "X DMs support at most one media attachment.";
    }
    return args.content ? getDmTextLimitError(args.content) : null;
  }

  return null;
}

function assertExpectedTaskType(
  task: Pick<Doc<"outreachTasks">, "type">,
  expectedType: "comment" | "dm"
): void {
  if (task.type !== expectedType) {
    throw new Error(
      expectedType === "dm"
        ? "This draft belongs to a reply task, not a DM task."
        : "This draft belongs to a DM task, not a reply task."
    );
  }
}

function toActivityPageSize(limit?: number): number {
  const rawLimit = limit ?? DEFAULT_ACTIVITY_PAGE_SIZE;
  return Math.min(MAX_ACTIVITY_PAGE_SIZE, Math.max(1, Math.floor(rawLimit)));
}

function parsePlanSnapshot(snapshot: unknown): OutreachPlanSnapshot | null {
  if (!isRecord(snapshot)) return null;

  const planId =
    typeof snapshot.planId === "string"
      ? (snapshot.planId as Id<"outreachPlans">)
      : null;
  const version =
    typeof snapshot.version === "number" ? snapshot.version : null;
  const status = parseOutreachPlanStatus(snapshot.status);
  const updatedAt =
    typeof snapshot.updatedAt === "number" ? snapshot.updatedAt : null;
  const strategy = getNestedRecord(snapshot, "strategy");
  const rationale = getStringProperty(strategy, "rationale");
  const valueProposition = getStringProperty(strategy, "valueProposition");
  const tone = getStringProperty(strategy, "tone");

  if (
    !planId ||
    version === null ||
    !status ||
    updatedAt === null ||
    !rationale ||
    !valueProposition ||
    !tone
  ) {
    return null;
  }

  const rawTasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];

  const tasks: OutreachPlanSnapshot["tasks"] = rawTasks
    .filter(isRecord)
    .map((task, index) => ({
      _id:
        typeof task._id === "string" && task._id.length > 0
          ? (task._id as Id<"outreachTasks">)
          : (`snapshot-task-${index + 1}` as Id<"outreachTasks">),
      order: typeof task.order === "number" ? task.order : index + 1,
      type: parseOutreachTaskType(task.type),
      description: typeof task.description === "string" ? task.description : "",
      status: parseOutreachTaskStatus(task.status),
      content: typeof task.content === "string" ? task.content : undefined,
      targetTweetId:
        typeof task.targetTweetId === "string" ? task.targetTweetId : undefined,
    }));

  return {
    planId,
    version,
    status,
    updatedAt,
    strategy: {
      rationale,
      valueProposition,
      tone,
      targetTweetId:
        typeof strategy?.targetTweetId === "string"
          ? strategy.targetTweetId
          : undefined,
    },
    tasks,
  };
}

function matchesActivitySearch(
  activity: Doc<"prospectActivityLog">,
  searchTerm: string
): boolean {
  const normalizedTerm = searchTerm.trim().toLowerCase();
  if (!normalizedTerm) return true;

  const title = activity.title.toLowerCase();
  const description = (activity.description ?? "").toLowerCase();
  return title.includes(normalizedTerm) || description.includes(normalizedTerm);
}

function findSourcePostInProspect(
  prospect: Doc<"prospects"> | null,
  targetTweetId?: string
): {
  platform: "twitter" | "linkedin";
  sourcePostRef?: TwitterPostRef;
  sourcePostSummary?: TwitterPostSummary;
} | null {
  if (!prospect) return null;

  const platform = prospect.platform === "linkedin" ? "linkedin" : "twitter";
  const candidatePosts: unknown[] = [];
  if (prospect.data) candidatePosts.push(prospect.data);
  if (Array.isArray(prospect.evidencePosts)) {
    candidatePosts.push(...prospect.evidencePosts);
  }

  if (!targetTweetId) {
    const firstSummary =
      platform === "twitter"
        ? candidatePosts
            .map((post) => summarizeTwitterPost(post))
            .find((post) => Boolean(post))
        : undefined;
    if (candidatePosts.length === 0 && !firstSummary) return null;
    return {
      platform,
      sourcePostRef:
        platform === "twitter"
          ? getTwitterPostRef(candidatePosts[0])
          : undefined,
      sourcePostSummary: platform === "twitter" ? firstSummary : undefined,
    };
  }

  const matched = candidatePosts.find((post) => {
    return getTweetIdFromPostData(post) === targetTweetId;
  });

  if (!matched) {
    return null;
  }

  return {
    platform,
    sourcePostRef:
      platform === "twitter" ? getTwitterPostRef(matched) : undefined,
    sourcePostSummary:
      platform === "twitter" ? summarizeTwitterPost(matched) : undefined,
  };
}

async function resolveTaskForPanel(args: {
  ctx: QueryCtx | MutationCtx;
  taskId?: Id<"outreachTasks">;
  prospectId?: Id<"prospects">;
  targetTweetId?: string;
  userId: Id<"users">;
}): Promise<{
  task: Doc<"outreachTasks">;
  plan: Doc<"outreachPlans">;
} | null> {
  const { ctx, taskId, prospectId, targetTweetId, userId } = args;

  const ensureOwnedTask = async (
    candidate: Doc<"outreachTasks"> | null
  ): Promise<{
    task: Doc<"outreachTasks">;
    plan: Doc<"outreachPlans">;
  } | null> => {
    if (!candidate) return null;
    const plan = await ctx.db.get(candidate.planId);
    if (!plan) return null;
    if (plan.userId !== userId) return null;
    if (prospectId && plan.prospectId !== prospectId) return null;
    return { task: candidate, plan };
  };

  if (taskId) {
    const ownedTask = await getOwnedTask(ctx, taskId, userId);
    if (!ownedTask) return null;
    if (prospectId && ownedTask.plan.prospectId !== prospectId) {
      return null;
    }
    if (targetTweetId && ownedTask.task.targetTweetId !== targetTweetId) {
      return null;
    }
    return ownedTask;
  }

  if (targetTweetId) {
    const byTarget = await ctx.db
      .query("outreachTasks")
      .withIndex("by_target_tweet", (q) => q.eq("targetTweetId", targetTweetId))
      .collect();

    const preferredStatuses = [
      "executing",
      "pending",
      "waiting_response",
      "completed",
    ];

    byTarget.sort((a, b) => b._creationTime - a._creationTime);

    for (const status of preferredStatuses) {
      const match = byTarget.find(
        (candidate) =>
          candidate.type === "comment" && candidate.status === status
      );
      const owned = await ensureOwnedTask(match ?? null);
      if (owned) return owned;
    }

    return null;
  }

  if (prospectId) {
    const plan = await ctx.db
      .query("outreachPlans")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .first();
    if (!plan) return null;

    const tasks = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_order", (q) => q.eq("planId", plan._id))
      .collect();
    const candidate =
      tasks.find(
        (task) =>
          task.type === "comment" &&
          (task.status === "pending" || task.status === "executing")
      ) ??
      tasks.find(
        (task) =>
          task.type === "comment" &&
          (task.status === "waiting_response" || task.status === "completed")
      );
    if (!candidate) return null;
    return { task: candidate, plan };
  }

  return null;
}

// ============================================================================
// Public Queries
// ============================================================================

/**
 * Get active plan for a prospect (public).
 */
export const getProspectPlan = query({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const user = await getUserByIdentity(ctx, identity);
    if (!user) {
      return null;
    }
    await requireOwnedProspect(ctx, prospectId, {
      user,
      notFoundMessage: "Prospect not found",
      notAuthorizedMessage: "Not authorized to view this prospect",
    });
    return await getProspectActivePlan(ctx, prospectId);
  },
});

/**
 * Get activity log for a prospect (public).
 * Returns timeline entries with optional plan snapshots for plan_created events.
 */
export const getActivityLog = query({
  args: {
    prospectId: v.id("prospects"),
    limit: v.optional(v.number()),
    type: v.optional(prospectActivityTypeValidator),
    search: v.optional(v.string()),
  },
  handler: async (ctx, { prospectId, limit, type, search }) => {
    const user = await requireViewerUser(ctx);
    await requireOwnedProspect(ctx, prospectId, {
      user,
      notFoundMessage: "Prospect not found",
      notAuthorizedMessage: "Not authorized to view this prospect",
    });

    const pageSize = toActivityPageSize(limit);
    const searchTerm = search?.trim() ?? "";

    let pageActivities: Doc<"prospectActivityLog">[] = [];
    let hasMore = false;

    if (!type && !searchTerm) {
      // No filters: indexed page fetch
      const activitiesWithSentinel = await getProspectActivityLog(
        ctx,
        prospectId,
        {
          limit: pageSize + 1,
        }
      );
      hasMore = activitiesWithSentinel.length > pageSize;
      pageActivities = activitiesWithSentinel.slice(0, pageSize);
    } else if (type && !searchTerm) {
      // Type filter only: use by_prospect_type index
      const activitiesWithSentinel = await getProspectActivityLog(
        ctx,
        prospectId,
        {
          limit: pageSize + 1,
          type,
        }
      );
      hasMore = activitiesWithSentinel.length > pageSize;
      pageActivities = activitiesWithSentinel.slice(0, pageSize);
    } else {
      // Search (with or without type): bounded batch scan
      const batchSize = Math.max(pageSize * 5, 100);
      const source = type
        ? getProspectActivityLog(ctx, prospectId, {
            limit: batchSize,
            type,
          })
        : getProspectActivityLog(ctx, prospectId, {
            limit: batchSize,
          });

      const batch = await source;
      const filtered = batch.filter((activity) =>
        matchesActivitySearch(activity, searchTerm)
      );
      hasMore = filtered.length > pageSize || batch.length === batchSize;
      pageActivities = filtered.slice(0, pageSize);
    }

    const planSnapshotByActivityId = new Map<
      Id<"prospectActivityLog">,
      OutreachPlanSnapshot
    >();
    const planIdByActivityId = new Map<
      Id<"prospectActivityLog">,
      Id<"outreachPlans">
    >();
    const planIdsToFetch = new Set<Id<"outreachPlans">>();

    for (const activity of pageActivities) {
      if (activity.type !== "plan_created") continue;

      const metadata = isRecord(activity.metadata) ? activity.metadata : null;
      const metadataSnapshot = parsePlanSnapshot(
        metadata ? metadata.planSnapshot : undefined
      );

      if (metadataSnapshot) {
        planSnapshotByActivityId.set(activity._id, metadataSnapshot);
        continue;
      }

      const planIdValue = metadata?.planId;
      if (typeof planIdValue === "string") {
        const planId = planIdValue as Id<"outreachPlans">;
        planIdByActivityId.set(activity._id, planId);
        planIdsToFetch.add(planId);
      }
    }

    const planSnapshotByPlanId = new Map<
      Id<"outreachPlans">,
      OutreachPlanSnapshot
    >();

    await Promise.all(
      Array.from(planIdsToFetch).map(async (planId) => {
        const plan = await ctx.db.get(planId);
        if (!plan || plan.prospectId !== prospectId) return;

        const tasks = await ctx.db
          .query("outreachTasks")
          .withIndex("by_plan_order", (q) => q.eq("planId", planId))
          .collect();

        planSnapshotByPlanId.set(planId, buildPlanSnapshot(plan, tasks));
      })
    );

    return {
      activities: pageActivities.map((activity) => {
        if (activity.type !== "plan_created") {
          return {
            ...activity,
            plan: null,
          };
        }

        const snapshotFromMetadata = planSnapshotByActivityId.get(activity._id);
        if (snapshotFromMetadata) {
          return {
            ...activity,
            plan: snapshotFromMetadata,
          };
        }

        const planId = planIdByActivityId.get(activity._id);
        return {
          ...activity,
          plan: planId ? (planSnapshotByPlanId.get(planId) ?? null) : null,
        };
      }),
      hasMore,
    };
  },
});

/**
 * List notifications for the current user (public).
 * Returns notifications grouped by day (using _creationTime).
 */
export const listNotifications = query({
  args: { workspaceId: v.optional(v.id("workspaces")) },
  handler: async (ctx, { workspaceId }) => {
    const user = await requireViewerUser(ctx);

    // Backward-compatible: if workspaceId isn't provided, use active default workspace.
    let resolvedWorkspaceId = workspaceId;
    if (!resolvedWorkspaceId) {
      const defaultWorkspace = await getDefaultWorkspaceForUser(ctx, user._id);
      resolvedWorkspaceId = defaultWorkspace?._id;
    }

    if (!resolvedWorkspaceId) {
      return [];
    }

    await requireOwnedWorkspace(ctx, resolvedWorkspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to view this workspace",
    });

    // Get workspace-scoped notifications for user, ordered by creation time (descending)
    const notifications = await ctx.db
      .query("outreachNotifications")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", resolvedWorkspaceId)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), user._id),
          q.neq(q.field("status"), "dismissed")
        )
      )
      .order("desc")
      .take(100);

    return notifications;
  },
});

/**
 * Mark notification as seen (public).
 */
export const markNotificationSeen = mutation({
  args: {
    notificationId: v.id("outreachNotifications"),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { notificationId, workspaceId }) => {
    const user = await requireViewerUser(ctx);

    const notification = await ctx.db.get(notificationId);
    if (!notification) throw new Error("Notification not found");
    if (notification.userId !== user._id) {
      throw new Error("Not authorized to update this notification");
    }

    const resolvedWorkspaceId = workspaceId ?? notification.workspaceId;
    await requireOwnedWorkspace(ctx, resolvedWorkspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage:
        "Not authorized to update notifications for this workspace",
    });

    if (
      notification.userId !== user._id ||
      notification.workspaceId !== resolvedWorkspaceId
    ) {
      throw new Error("Notification does not belong to this workspace");
    }

    await ctx.db.patch(notificationId, {
      status: "seen",
      seenAt: getCurrentUTCTimestamp(),
    });
  },
});

/**
 * Dismiss notification (public).
 */
export const dismissNotification = mutation({
  args: {
    notificationId: v.id("outreachNotifications"),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { notificationId, workspaceId }) => {
    const user = await requireViewerUser(ctx);

    const notification = await ctx.db.get(notificationId);
    if (!notification) throw new Error("Notification not found");
    if (notification.userId !== user._id) {
      throw new Error("Not authorized to update this notification");
    }

    const resolvedWorkspaceId = workspaceId ?? notification.workspaceId;
    await requireOwnedWorkspace(ctx, resolvedWorkspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage:
        "Not authorized to update notifications for this workspace",
    });

    if (
      notification.userId !== user._id ||
      notification.workspaceId !== resolvedWorkspaceId
    ) {
      throw new Error("Notification does not belong to this workspace");
    }

    await ctx.db.patch(notificationId, {
      status: "dismissed",
      dismissedAt: getCurrentUTCTimestamp(),
    });
  },
});

export const createProspectsFoundNotification = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    workflowId: v.string(),
    prospectsFound: v.number(),
    twitterSaved: v.number(),
    linkedinSaved: v.number(),
  },
  handler: async (
    ctx,
    { workspaceId, workflowId, prospectsFound, twitterSaved, linkedinSaved }
  ) => {
    if (prospectsFound <= 0) {
      return null;
    }
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
      return null;
    }

    const useCase = getWorkspaceUseCase(workspace.useCaseKey);
    const entityPluralLower = useCase.entityPlural.toLowerCase();

    const messageParts: string[] = [];
    if (twitterSaved > 0) {
      messageParts.push(`${twitterSaved} on X`);
    }
    if (linkedinSaved > 0) {
      messageParts.push(`${linkedinSaved} on LinkedIn`);
    }

    return await upsertNotificationByKey(ctx, {
      userId: workspace.userId,
      workspaceId,
      type: "prospects_found",
      notificationKey: buildProspectsFoundNotificationKey(
        workspaceId,
        workflowId
      ),
      title: `${prospectsFound} new ${entityPluralLower} found`,
      message:
        messageParts.length > 0
          ? messageParts.join(", ")
          : `New ${entityPluralLower} are ready for review.`,
      targetHref: "/",
    });
  },
});

export const createOutreachSentNotification = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    prospectId: v.id("prospects"),
    title: v.string(),
    message: v.string(),
    targetHref: v.optional(v.string()),
    notificationKey: v.string(),
    contextPlatform: prospectPlatformValidator,
  },
  handler: async (ctx, args) => {
    const prospect = await ctx.db.get(args.prospectId);
    const display = getProspectDisplayFields(prospect);
    return await upsertNotificationByKey(ctx, {
      ...args,
      type: "outreach_sent",
      ...display,
    });
  },
});

export const syncAccountHealthNotification = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    platform: prospectPlatformValidator,
    shouldNotify: v.boolean(),
    title: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const notificationKey = buildAccountHealthNotificationKey(args.platform);
    if (!args.workspaceId) {
      return null;
    }

    if (!args.shouldNotify) {
      await dismissNotificationsByKey(ctx, {
        userId: args.userId,
        workspaceId: args.workspaceId,
        notificationKey,
      });
      return null;
    }

    return await upsertNotificationByKey(ctx, {
      userId: args.userId,
      workspaceId: args.workspaceId,
      type: "error",
      notificationKey,
      title: args.title,
      message: args.message,
      targetHref: "/settings/connected-accounts",
      contextPlatform: args.platform,
    });
  },
});

/**
 * Get all tasks for a plan (public).
 */
export const getPlanTasks = query({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    const user = await requireViewerUser(ctx);
    await requireOwnedPlan(ctx, planId, {
      user,
      notFoundMessage: "Plan not found",
      notAuthorizedMessage: "Not authorized to view this plan",
    });

    return await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_order", (q) => q.eq("planId", planId))
      .collect();
  },
});

function getFallbackInteractionParticipants(
  interaction: Doc<"prospectInteractions">
): TwitterConversationParticipant[] {
  const sourceAuthor = interaction.sourcePostSummary?.author;
  const replyAuthor = interaction.replyPostSummary?.author;
  const participants: TwitterConversationParticipant[] = [];

  if (replyAuthor) {
    participants.push({
      id: replyAuthor.id,
      handle: replyAuthor.handle,
      name: replyAuthor.name,
      avatarUrl: replyAuthor.avatarUrl,
      isViewer: true,
    });
  }

  if (sourceAuthor) {
    const alreadyIncluded = participants.some(
      (participant) =>
        participant.id === sourceAuthor.id ||
        participant.handle === sourceAuthor.handle
    );
    if (!alreadyIncluded) {
      participants.push({
        id: sourceAuthor.id,
        handle: sourceAuthor.handle,
        name: sourceAuthor.name,
        avatarUrl: sourceAuthor.avatarUrl,
      });
    }
  }

  return participants;
}

export const upsertTwitterInteraction = internalMutation({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    sourcePostRef: twitterPostRefValidator,
    sourcePostSummary: v.optional(twitterPostSummaryValidator),
    replyPostRef: twitterPostRefValidator,
    replyPostSummary: v.optional(twitterPostSummaryValidator),
    threadId: v.string(),
    repliedAt: v.number(),
    origin: twitterInteractionOriginValidator,
    discoveredVia: twitterInteractionDiscoverySourceValidator,
    status: v.optional(twitterInteractionStatusValidator),
    direction: v.optional(twitterInteractionDirectionValidator),
    discoveredAt: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),
    lastHydratedAt: v.optional(v.number()),
    lastHydrationErrorMessage: v.optional(v.string()),
    participants: v.optional(v.array(twitterConversationParticipantValidator)),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("prospectInteractions")
      .withIndex("by_user_prospect_reply", (q) =>
        q
          .eq("userId", args.userId)
          .eq("prospectId", args.prospectId)
          .eq("replyPostId", args.replyPostRef.postId)
      )
      .first();

    const payload = {
      userId: args.userId,
      prospectId: args.prospectId,
      platform: "twitter" as const,
      interactionType: "reply_posted",
      sourcePostId: args.sourcePostRef.postId,
      replyPostId: args.replyPostRef.postId,
      threadId: args.threadId,
      sourcePostRef: args.sourcePostRef,
      sourcePostSummary: args.sourcePostSummary,
      replyPostRef: args.replyPostRef,
      replyPostSummary: args.replyPostSummary,
      sourcePostData: undefined,
      sourceUrl: args.sourcePostSummary?.url,
      replyText: args.replyPostSummary?.textPreview,
      origin:
        existing && existing.origin !== "unknown" && args.origin === "unknown"
          ? existing.origin
          : args.origin,
      discoveredVia:
        existing &&
        existing.discoveredVia !== "live_reconcile" &&
        args.discoveredVia === "live_reconcile"
          ? existing.discoveredVia
          : args.discoveredVia,
      status: args.status ?? existing?.status ?? "active",
      direction: args.direction ?? existing?.direction,
      repliedAt: args.repliedAt,
      discoveredAt: args.discoveredAt ?? existing?.discoveredAt,
      lastSeenAt: args.lastSeenAt ?? getCurrentUTCTimestamp(),
      lastHydratedAt: args.lastHydratedAt ?? existing?.lastHydratedAt,
      lastHydrationErrorMessage:
        args.lastHydrationErrorMessage ?? existing?.lastHydrationErrorMessage,
      participants: args.participants,
      updatedAt: getCurrentUTCTimestamp(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return ctx.db.insert("prospectInteractions", payload);
  },
});

/**
 * Get durable Twitter reply interactions for a prospect.
 */
export const getProspectInteractions = query({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    const user = await requireViewerUser(ctx);
    await requireOwnedProspect(ctx, prospectId, {
      user,
      notFoundMessage: "Prospect not found",
      notAuthorizedMessage: "Not authorized to view this prospect",
    });

    const interactions = await ctx.db
      .query("prospectInteractions")
      .withIndex("by_user_prospect_replied", (q) =>
        q.eq("userId", user._id).eq("prospectId", prospectId)
      )
      .collect();

    return interactions
      .sort((a, b) => b.repliedAt - a.repliedAt)
      .map((interaction) => {
        const originalSummary =
          interaction.sourcePostSummary ??
          summarizeTwitterPost(interaction.sourcePostRef);
        const replySummary =
          interaction.replyPostSummary ??
          summarizeTwitterPost(interaction.replyPostRef);
        const participants =
          interaction.participants && interaction.participants.length > 0
            ? interaction.participants
            : getFallbackInteractionParticipants(interaction);

        return {
          id: interaction._id,
          threadId: interaction.threadId,
          repliedAt: interaction.repliedAt,
          originalPost: originalSummary
            ? toFallbackTweetFromSummary(originalSummary)
            : null,
          sourcePostRef: interaction.sourcePostRef,
          sourcePostSummary: originalSummary ?? null,
          replyPostRef: interaction.replyPostRef,
          replyPostSummary: replySummary ?? null,
          lastReplyPreview: replySummary?.textPreview,
          origin: interaction.origin,
          discoveredVia: interaction.discoveredVia,
          status: interaction.status ?? "active",
          direction: interaction.direction,
          discoveredAt: interaction.discoveredAt,
          lastSeenAt: interaction.lastSeenAt,
          lastHydratedAt: interaction.lastHydratedAt,
          lastHydrationErrorMessage: interaction.lastHydrationErrorMessage,
          participants: participants.map((participant) => ({
            name: participant.name || participant.handle || "Unknown",
            username: participant.handle || "",
            avatarUrl: participant.avatarUrl,
          })),
        };
      });
  },
});

/**
 * Detect mismatches where success-like chat bridge state exists without
 * persisted posting evidence.
 */
export const getOutreachClaimMismatches = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, limit }) => {
    const user = await requireViewerUser(ctx);
    await requireOwnedWorkspace(ctx, workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to view this workspace",
    });

    const planStatuses: Doc<"outreachPlans">["status"][] = [
      "draft",
      "approved",
      "executing",
      "paused",
      "blocked_auth",
      "completed",
      "abandoned",
    ];

    const plans = (
      await Promise.all(
        planStatuses.map((status) =>
          ctx.db
            .query("outreachPlans")
            .withIndex("by_workspace_status", (q) =>
              q.eq("workspaceId", workspaceId).eq("status", status)
            )
            .collect()
        )
      )
    ).flat();

    const rows: Array<{
      planId: Id<"outreachPlans">;
      taskId: Id<"outreachTasks">;
      planStatus: Doc<"outreachPlans">["status"];
      taskStatus: Doc<"outreachTasks">["status"];
      issue: string;
    }> = [];

    for (const plan of plans) {
      const tasks = await ctx.db
        .query("outreachTasks")
        .withIndex("by_plan", (q) => q.eq("planId", plan._id))
        .collect();

      for (const task of tasks) {
        if (task.type !== "comment") continue;
        const postedTweetId = getPostedTweetId(task.resultData);
        const statusImpliesPosted =
          task.status === "waiting_response" || task.status === "completed";
        const bridgedPosted = task.statusBridgeState === "posted";

        if (!postedTweetId && (statusImpliesPosted || bridgedPosted)) {
          rows.push({
            planId: plan._id,
            taskId: task._id,
            planStatus: plan.status,
            taskStatus: task.status,
            issue: bridgedPosted
              ? "Chat bridge marked posted without postedTweetId"
              : "Task status implies posted without postedTweetId",
          });
        }

        if (limit && rows.length >= limit) {
          return rows;
        }
      }
    }

    return rows;
  },
});

/**
 * Resolve deterministic panel context for agent approval/posted side panel.
 */
export const getAgentPanelContext = query({
  args: {
    prospectId: v.id("prospects"),
    taskId: v.optional(v.id("outreachTasks")),
    targetTweetId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);

    const resolved = await resolveTaskForPanel({
      ctx,
      userId: user._id,
      taskId: args.taskId,
      prospectId: args.prospectId,
      targetTweetId: args.targetTweetId,
    });

    if (!resolved) {
      return null;
    }

    const { task, plan } = resolved;
    const mode = getPanelModeForStatus(task.status) ?? "approval";

    const prospect = await ctx.db.get(plan.prospectId);
    const approvalContext = task.approvalContext;
    const fallbackSource = findSourcePostInProspect(
      prospect,
      task.targetTweetId
    );
    const taskPlatform = getRecordedPlatform(task, prospect);

    const sourcePostSummary =
      approvalContext?.sourcePostSummary ?? fallbackSource?.sourcePostSummary;
    const sourcePlatform =
      approvalContext?.platform ?? fallbackSource?.platform ?? "twitter";
    const sourcePostId =
      approvalContext?.sourcePostRef?.postId ??
      (fallbackSource?.sourcePostRef as { postId?: string } | undefined)
        ?.postId ??
      task.targetTweetId;
    const sourceContext = approvalContext?.sourceContext ?? undefined;

    const resultData = isRecord(task.resultData) ? task.resultData : undefined;
    const postedBy = getNestedRecord(resultData, "postedBy");
    const postedMediaUrls = toStringArray(resultData?.postedMediaUrls);
    const postedMediaDescriptions = toStringArray(
      resultData?.postedMediaDescriptions
    );
    const postedMediaKinds = normalizeMediaKinds(
      resultData?.postedMediaKinds,
      postedMediaUrls
    );
    const resolvedPostedMediaKinds =
      postedMediaKinds.length > 0
        ? postedMediaKinds
        : normalizeMediaKinds(task.mediaKinds, postedMediaUrls);
    const postedTweetId = getStringProperty(resultData, "postedTweetId");
    const postedConversationId = getStringProperty(
      resultData,
      "conversationId"
    );
    const postedMessageId = getStringProperty(resultData, "messageId");
    const postedText =
      getStringProperty(resultData, "postedText") ||
      getStringProperty(resultData, "text") ||
      task.content ||
      "";

    return {
      kind: task.type === "dm" ? "dm" : "post",
      platform: taskPlatform,
      mode,
      planId: plan._id,
      planStatus: plan.status,
      taskStatus: task.status,
      approvalReady: Boolean(task.approvalEventId),
      resolvedTaskId: task._id,
      targetTweetId: task.targetTweetId,
      draft: {
        content: task.content || "",
        mediaUrls: task.mediaUrls || [],
        mediaDescriptions: task.mediaDescriptions || [],
        mediaKinds: normalizeMediaKinds(task.mediaKinds, task.mediaUrls || []),
      },
      originalPost:
        task.type === "comment" && sourcePostSummary
          ? {
              platform: sourcePlatform,
              postId: sourcePostId,
              context: sourceContext,
              postRef:
                approvalContext?.sourcePostRef ?? fallbackSource?.sourcePostRef,
              postSummary: sourcePostSummary,
            }
          : null,
      posted:
        mode === "posted"
          ? {
              conversationId: postedConversationId,
              messageId: postedMessageId,
              tweetId: postedTweetId,
              text: postedText,
              postedAt:
                getNumberProperty(resultData, "postedAt") || task.executedAt,
              mediaUrls: postedMediaUrls,
              mediaDescriptions: postedMediaDescriptions,
              mediaKinds: resolvedPostedMediaKinds,
              author: {
                name: getStringProperty(postedBy, "name"),
                screenName: getStringProperty(postedBy, "screenName"),
                profileImageUrl: getStringProperty(postedBy, "profileImageUrl"),
              },
            }
          : null,
    };
  },
});

// ============================================================================
// Internal Mutations (for agent tools)
// ============================================================================

/**
 * Create a new outreach plan (internal, called by agent).
 */
export const createPlan = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    strategy: outreachStrategyValidator,
    tasks: v.array(
      v.object({
        type: outreachTaskTypeValidator,
        description: v.string(),
        timing: outreachTaskTimingValidator,
        targetTweetId: v.optional(v.string()),
        content: v.optional(v.string()),
        mediaUrls: v.optional(v.array(v.string())),
        mediaDescriptions: v.optional(v.array(v.string())),
        mediaKinds: v.optional(v.array(twitterMediaKindValidator)),
        approvalContext: v.optional(outreachTaskApprovalContextValidator),
      })
    ),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const input: OutreachPlanInput = {
      prospectId: args.prospectId,
      workspaceId: args.workspaceId,
      userId: args.userId,
      strategy: args.strategy,
      tasks: args.tasks,
      threadId: args.threadId,
    };

    return await createOutreachPlan(ctx, input);
  },
});

/**
 * Refine an existing plan (internal, called by agent).
 */
export const updatePlan = internalMutation({
  args: {
    planId: v.id("outreachPlans"),
    strategy: v.optional(outreachStrategyValidator),
    tasks: v.optional(
      v.array(
        v.object({
          type: outreachTaskTypeValidator,
          description: v.string(),
          timing: outreachTaskTimingValidator,
          targetTweetId: v.optional(v.string()),
          content: v.optional(v.string()),
          mediaUrls: v.optional(v.array(v.string())),
          mediaDescriptions: v.optional(v.array(v.string())),
          mediaKinds: v.optional(v.array(twitterMediaKindValidator)),
          approvalContext: v.optional(outreachTaskApprovalContextValidator),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    await refinePlanCore(ctx, args.planId, {
      strategy: args.strategy,
      tasks: args.tasks as OutreachTaskInput[] | undefined,
    });
  },
});

/**
 * Approve a plan for execution (internal, called by agent).
 */
export const approvePlanMutation = internalMutation({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    const plan = await ctx.db.get(planId);
    if (!plan) {
      throw new Error("Plan not found");
    }

    const prospectApproveInternal = await ctx.db.get(plan.prospectId);
    if (!prospectApproveInternal) {
      throw new Error("Prospect not found");
    }
    requireProspectNotArchived(prospectApproveInternal);

    await approvePlanCore(ctx, planId);
    await recordMemoryWorkflowEvent(ctx, {
      workspaceId: plan.workspaceId,
      eventType: "outreach_plan_approved",
      sourceType: "outreach_plan",
      sourceId: String(planId),
      planId,
      prospectId: plan.prospectId,
      payload: {
        status: "approved",
      },
    });

    // Trigger workflow execution
    await ctx.scheduler.runAfter(
      0,
      internal.workflows.outreach.startOutreachWorkflow,
      { planId }
    );
  },
});

// ============================================================================
// Public Mutations (for UI)
// ============================================================================

/**
 * Approve a plan (public, for UI button).
 */
export const approvePlan = mutation({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    const user = await requireViewerUser(ctx);
    const plan = await requireOwnedPlan(ctx, planId, {
      user,
      notFoundMessage: "Plan not found",
      notAuthorizedMessage: "Not authorized to approve this plan",
    });

    const prospectForPlan = await ctx.db.get(plan.prospectId);
    if (!prospectForPlan) {
      throw new Error("Prospect not found");
    }
    requireProspectNotArchived(prospectForPlan);

    await approvePlanCore(ctx, planId);
    await recordMemoryWorkflowEvent(ctx, {
      workspaceId: plan.workspaceId,
      eventType: "outreach_plan_approved",
      sourceType: "outreach_plan",
      sourceId: String(planId),
      planId,
      prospectId: plan.prospectId,
      payload: {
        status: "approved",
      },
    });

    // Trigger workflow execution
    await ctx.scheduler.runAfter(
      0,
      internal.workflows.outreach.startOutreachWorkflow,
      { planId }
    );
  },
});

/**
 * Resume a paused/blocked plan.
 * Resets status to approved and starts a new workflow run.
 */
export const resumePlan = mutation({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    const user = await requireViewerUser(ctx);
    const plan = await requireOwnedPlan(ctx, planId, {
      user,
      notFoundMessage: "Plan not found",
      notAuthorizedMessage: "Not authorized to resume this plan",
    });
    if (plan.status !== "paused" && plan.status !== "blocked_auth") {
      throw new Error("Can only resume paused or blocked plans");
    }

    const prospectResume = await ctx.db.get(plan.prospectId);
    if (!prospectResume) {
      throw new Error("Prospect not found");
    }
    requireProspectNotArchived(prospectResume);

    await ctx.db.patch(planId, {
      status: "approved",
      updatedAt: getCurrentUTCTimestamp(),
    });

    await ctx.scheduler.runAfter(
      0,
      internal.workflows.outreach.startOutreachWorkflow,
      { planId }
    );
  },
});

/**
 * Pause a plan (public).
 */
export const pausePlan = mutation({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    const user = await requireViewerUser(ctx);
    const plan = await requireOwnedPlan(ctx, planId, {
      user,
      notFoundMessage: "Plan not found",
      notAuthorizedMessage: "Not authorized to pause this plan",
    });
    if (plan.status !== "executing") {
      throw new Error("Can only pause executing plans");
    }

    const prospectPause = await ctx.db.get(plan.prospectId);
    if (!prospectPause) {
      throw new Error("Prospect not found");
    }
    requireProspectNotArchived(prospectPause);

    await ctx.db.patch(planId, {
      status: "paused",
      updatedAt: getCurrentUTCTimestamp(),
    });
  },
});

/**
 * Abandon a plan (public).
 */
export const abandonPlan = mutation({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    const user = await requireViewerUser(ctx);
    const plan = await requireOwnedPlan(ctx, planId, {
      user,
      notFoundMessage: "Plan not found",
      notAuthorizedMessage: "Not authorized to abandon this plan",
    });

    await ctx.db.patch(planId, {
      status: "abandoned",
      updatedAt: getCurrentUTCTimestamp(),
    });
    await recordMemoryWorkflowEvent(ctx, {
      workspaceId: plan.workspaceId,
      eventType: "outreach_plan_abandoned",
      sourceType: "outreach_plan",
      sourceId: String(planId),
      planId,
      prospectId: plan.prospectId,
      payload: {
        previousStatus: plan.status,
        nextStatus: "abandoned",
      },
    });
  },
});

// ============================================================================
// Internal Functions for Workflow
// ============================================================================

/**
 * Get plan and tasks (internal, for workflow).
 */
export const getPlanInternal = internalQuery({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    const plan = await ctx.db.get(planId);
    if (!plan) return null;

    const tasks = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_order", (q) => q.eq("planId", planId))
      .collect();

    return { plan, tasks };
  },
});

/**
 * Get pending task for a prospect (internal, for approveTask tool).
 * Returns the first task with status "pending", "executing", or "waiting_response"
 * from the prospect's active plan.
 *
 * NOTE: "executing" is included because the workflow sets task status to
 * "executing" before awaitEvent for human approval. This is the state when
 * the task is waiting for user approval.
 *
 * This enables the approveTask tool to auto-discover the task to approve
 * without relying on LLM-provided taskId (prevents hallucination).
 */
export const getPendingTaskForProspect = internalQuery({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    // Find active plan (approved or executing)
    const plan = await ctx.db
      .query("outreachPlans")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "approved"),
          q.eq(q.field("status"), "executing"),
          q.eq(q.field("status"), "paused"),
          q.eq(q.field("status"), "blocked_auth")
        )
      )
      .first();

    if (!plan) return null;

    // Find pending, executing (awaiting approval), or waiting_response comment
    // task for the approveTask helper. DM tasks must stay in the DM panel flow.
    return await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "comment"),
          q.or(
            q.eq(q.field("status"), "pending"),
            q.eq(q.field("status"), "executing"), // Awaiting human approval
            q.eq(q.field("status"), "waiting_response")
          )
        )
      )
      .first();
  },
});

/**
 * Resolve a comment task by prospect + target tweet for deterministic panel reopen.
 */
export const getTaskByProspectAndTargetTweet = internalQuery({
  args: {
    prospectId: v.id("prospects"),
    targetTweetId: v.string(),
  },
  handler: async (ctx, { prospectId, targetTweetId }) => {
    const candidates = await ctx.db
      .query("outreachTasks")
      .withIndex("by_target_tweet", (q) => q.eq("targetTweetId", targetTweetId))
      .collect();

    const sorted = candidates
      .filter((task) => task.type === "comment")
      .sort((a, b) => b._creationTime - a._creationTime);

    const preferredStatuses = [
      "executing",
      "pending",
      "waiting_response",
      "completed",
    ];

    for (const status of preferredStatuses) {
      for (const task of sorted) {
        if (task.status !== status) continue;
        const plan = await ctx.db.get(task.planId);
        if (!plan || plan.prospectId !== prospectId) continue;
        return { task, plan };
      }
    }

    return null;
  },
});

export const bindNextPostTweetToPlan = internalMutation({
  args: {
    planId: v.id("outreachPlans"),
    tweetData: v.any(),
  },
  handler: async (ctx, { planId, tweetData }) => {
    const plan = await ctx.db.get(planId);
    if (!plan) {
      return { bound: false as const, reason: "plan_not_found" as const };
    }

    const tasks = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_order", (q) => q.eq("planId", planId))
      .collect();

    const waitTask = tasks.find(
      (task) =>
        task.type === "wait" &&
        task.status === "executing" &&
        task.timing.type === "event" &&
        task.timing.value === "next_post"
    );

    if (!waitTask) {
      return {
        bound: false as const,
        reason: "no_wait_task" as const,
      };
    }

    const targetTweetId = getTweetIdFromPostData(tweetData);
    const sourcePostRef =
      getTwitterPostRef(tweetData) ??
      (targetTweetId
        ? {
            platform: "twitter" as const,
            postId: targetTweetId,
            conversationId: targetTweetId,
          }
        : undefined);
    const sourcePostSummary = summarizeTwitterPost(tweetData) ?? undefined;
    const nextCommentTask = tasks.find(
      (task) =>
        task.order > waitTask.order &&
        task.type === "comment" &&
        (task.status === "pending" || task.status === "executing")
    );

    if (nextCommentTask && targetTweetId) {
      await ctx.db.patch(nextCommentTask._id, {
        targetTweetId,
        approvalContext: {
          ...nextCommentTask.approvalContext,
          panelMode: "approval",
          platform: "twitter",
          sourcePostRef:
            sourcePostRef ?? nextCommentTask.approvalContext?.sourcePostRef,
          sourcePostSummary:
            sourcePostSummary ??
            nextCommentTask.approvalContext?.sourcePostSummary,
          sourceContext: "Replying to the prospect's fresh post",
        },
      });
    }

    if (targetTweetId) {
      await ctx.db.patch(plan._id, {
        strategy: {
          ...plan.strategy,
          targetTweetId,
        },
        updatedAt: getCurrentUTCTimestamp(),
      });
    }

    return {
      bound: Boolean(nextCommentTask && targetTweetId),
      workflowId: plan.workflowId,
      waitTaskId: waitTask._id,
      targetTweetId,
    };
  },
});

/**
 * Get active plan for a prospect (internal, for refinePlan tool).
 * Returns the plan with status "draft", "approved", "executing", "paused",
 * or "blocked_auth".
 *
 * This enables the refinePlan tool to auto-discover the plan to update
 * without relying on LLM-provided planId (prevents hallucination).
 */
export const getActivePlanForProspect = internalQuery({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    return await ctx.db
      .query("outreachPlans")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "draft"),
          q.eq(q.field("status"), "approved"),
          q.eq(q.field("status"), "executing"),
          q.eq(q.field("status"), "paused"),
          q.eq(q.field("status"), "blocked_auth")
        )
      )
      .first();
  },
});

/**
 * Get active plan with tasks for a prospect (internal, for auto plan generation).
 * Returns both plan and tasks. Used to check if plan exists before auto-generating.
 */
export const getProspectActivePlanInternal = internalQuery({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    const plan = await ctx.db
      .query("outreachPlans")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "completed"),
          q.neq(q.field("status"), "abandoned")
        )
      )
      .first();

    if (!plan) return null;

    const tasks = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_order", (q) => q.eq("planId", plan._id))
      .collect();

    return { plan, tasks };
  },
});

/**
 * Update plan status (internal, for workflow).
 */
export const updatePlanStatus = internalMutation({
  args: {
    planId: v.id("outreachPlans"),
    status: outreachPlanStatusValidator,
  },
  handler: async (ctx, { planId, status }) => {
    const plan = await ctx.db.get(planId);
    if (!plan) {
      throw new Error("Plan not found");
    }
    await ctx.db.patch(planId, {
      status,
      updatedAt: getCurrentUTCTimestamp(),
    });
    await syncPlanCompletedNotification(ctx, { ...plan, status }, status);
  },
});

/**
 * Update task status (internal, for workflow).
 */
export const updateTaskStatus = internalMutation({
  args: {
    taskId: v.id("outreachTasks"),
    status: outreachTaskStatusValidator,
  },
  handler: async (ctx, { taskId, status }) => {
    const task = await ctx.db.get(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    await ctx.db.patch(taskId, {
      status,
      executedAt: status === "completed" ? getCurrentUTCTimestamp() : undefined,
    });

    if (status === "completed" || status === "failed") {
      const plan = await ctx.db.get(task.planId);
      if (plan) {
        await recordMemoryWorkflowEvent(ctx, {
          workspaceId: plan.workspaceId,
          eventType:
            status === "failed"
              ? "outreach_task_failed"
              : "outreach_task_completed",
          sourceType: "outreach_task",
          sourceId: String(taskId),
          planId: plan._id,
          taskId,
          prospectId: plan.prospectId,
          payload: {
            status,
            taskType: task.type,
          },
          eventKey: `outreach-task:${taskId}:${status}`,
        });
      }
    }
  },
});

/**
 * Log activity (internal, for workflow).
 */
export const logActivity = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    type: prospectActivityTypeValidator,
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await logProspectActivity(ctx, args);
  },
});

/**
 * Remove duplicate enrichment activity rows, keeping only the latest entry per
 * prospect. Intended for one-off cleanup after retry-related duplication.
 */
export const dedupeEnrichedActivityLogs = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { dryRun }) => {
    const activities = await ctx.db.query("prospectActivityLog").collect();
    const enrichedActivities = activities.filter(
      (activity) => activity.type === "enriched"
    );
    const latestByProspect = new Map<
      Id<"prospects">,
      Doc<"prospectActivityLog">
    >();
    const duplicateIds: Id<"prospectActivityLog">[] = [];

    for (const activity of enrichedActivities) {
      const current = latestByProspect.get(activity.prospectId);
      if (!current || activity._creationTime > current._creationTime) {
        if (current) {
          duplicateIds.push(current._id);
        }
        latestByProspect.set(activity.prospectId, activity);
        continue;
      }

      duplicateIds.push(activity._id);
    }

    if (!dryRun) {
      await Promise.all(
        duplicateIds.map((activityId) => ctx.db.delete(activityId))
      );
    }

    return {
      dryRun: dryRun ?? false,
      enrichedActivityCount: enrichedActivities.length,
      prospectsWithEnrichedActivity: latestByProspect.size,
      deletedCount: duplicateIds.length,
    };
  },
});

/**
 * Create human notification (internal, for workflow).
 */
export const createHumanNotification = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    prospectId: v.id("prospects"),
    planId: v.id("outreachPlans"),
    taskId: v.id("outreachTasks"),
    message: v.string(),
    // Prospect display data (denormalized for efficient display)
    prospectAvatarUrl: v.optional(v.string()),
    prospectDisplayName: v.optional(v.string()),
    prospectType: v.optional(prospectTypeValidator),
    prospectPlatform: v.optional(prospectPlatformValidator),
    prospectScreenName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    const useCase = getWorkspaceUseCase(workspace?.useCaseKey);

    // Dynamic title with name at the end for natural reading
    const name =
      args.prospectDisplayName || useCase.entitySingular.toLowerCase();
    const title = `needs input for ${name}`;

    await createNotification(ctx, {
      userId: args.userId,
      workspaceId: args.workspaceId,
      type: "ask_human",
      title,
      message: args.message,
      prospectId: args.prospectId,
      planId: args.planId,
      taskId: args.taskId,
      prospectAvatarUrl: args.prospectAvatarUrl,
      prospectDisplayName: args.prospectDisplayName,
      prospectType: args.prospectType,
      prospectPlatform: args.prospectPlatform,
      prospectScreenName: args.prospectScreenName,
    });
  },
});

// Note: executeCommentTask and parseTwitterError live in outreachActions.ts
// because authenticated Twitter actions run in the Node.js runtime.

/**
 * Get task (internal, for executeCommentTask).
 */
export const getTaskInternal = internalQuery({
  args: { taskId: v.id("outreachTasks") },
  handler: async (ctx, { taskId }) => {
    return await ctx.db.get(taskId);
  },
});

/**
 * Mark that a deterministic workflow status message was bridged into chat.
 */
export const markTaskStatusBridgeSent = internalMutation({
  args: {
    taskId: v.id("outreachTasks"),
    statusBridgeState: v.string(),
  },
  handler: async (ctx, { taskId, statusBridgeState }) => {
    await ctx.db.patch(taskId, {
      statusBridgeState,
      statusBridgeSentAt: getCurrentUTCTimestamp(),
    });
  },
});

/**
 * Mark task as waiting (no-op mutation used with runAfter for delays).
 */
export const markTaskWaiting = internalMutation({
  args: { taskId: v.id("outreachTasks") },
  handler: async (ctx, { taskId }) => {
    // This is a no-op mutation used with runAfter for scheduling delays
    await ctx.db.patch(taskId, {
      status: "waiting_response",
    });
  },
});

/**
 * Update prospect status (internal, for workflow).
 */
export const updateProspectStatusInternal = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    status: prospectStatusValidator,
  },
  handler: async (ctx, { prospectId, status }) => {
    const prospect = await ctx.db.get(prospectId);
    if (!prospect) return;

    const now = getCurrentUTCTimestamp();

    // Update stageTimestamps with the new status timestamp
    const newStageTimestamps = {
      ...prospect.stageTimestamps,
      [status]: now,
    };

    await ctx.db.patch(prospectId, {
      status,
      pipelineStage: status,
      stageTimestamps: newStageTimestamps,
      updatedAt: now,
    });
  },
});

/**
 * Mark a prospect as contacted after the first successful outbound post.
 * Idempotent and guarded to avoid downgrading progressed prospects.
 */
export const markProspectContactedFromSuccessfulComment = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { prospectId, workspaceId, description }) => {
    const prospect = await ctx.db.get(prospectId);
    if (!prospect) {
      return { transitioned: false as const, reason: "prospect_not_found" };
    }

    // Never regress existing pipeline progress (e.g. in_progress/converted).
    if (prospect.status !== "new") {
      return { transitioned: false as const, reason: "already_progressed" };
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(prospectId, {
      status: "contacted",
      pipelineStage: "contacted",
      stageTimestamps: {
        ...prospect.stageTimestamps,
        contacted: now,
      },
      updatedAt: now,
    });

    await logProspectActivity(ctx, {
      prospectId,
      workspaceId,
      type: "contacted",
      title: "Started outreach",
      description,
    });

    return { transitioned: true as const };
  },
});

export const markProspectContactedFromSuccessfulOutreach = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { prospectId, workspaceId, title, description }) => {
    const prospect = await ctx.db.get(prospectId);
    if (!prospect) {
      return { transitioned: false as const, reason: "prospect_not_found" };
    }

    if (prospect.status !== "new") {
      return { transitioned: false as const, reason: "already_progressed" };
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(prospectId, {
      status: "contacted",
      pipelineStage: "contacted",
      stageTimestamps: {
        ...prospect.stageTimestamps,
        contacted: now,
      },
      updatedAt: now,
    });

    await logProspectActivity(ctx, {
      prospectId,
      workspaceId,
      type: "contacted",
      title: title ?? "Started outreach",
      description,
    });

    return { transitioned: true as const };
  },
});

/**
 * Update task result data (internal, for executeCommentTask).
 * Stores posted tweet ID on success, or error details on failure.
 */
export const updateTaskResult = internalMutation({
  args: {
    taskId: v.id("outreachTasks"),
    status: outreachTaskStatusValidator,
    resultData: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    const plan = await ctx.db.get(task.planId);
    if (!plan) {
      throw new Error("Plan not found");
    }

    const classification = getFailureClassification(args.resultData);
    const requiresPostedArtifact =
      task.type === "comment"
        ? !getPostedTweetId(args.resultData)
        : task.type === "dm"
          ? !getStringProperty(args.resultData, "conversationId") &&
            !getStringProperty(args.resultData, "messageId")
          : false;
    if (
      (args.status === "waiting_response" || args.status === "completed") &&
      requiresPostedArtifact
    ) {
      throw new Error(
        "Invariant violation: completed outreach tasks require posted result data"
      );
    }

    const nextPanelMode =
      args.status === "waiting_response" || args.status === "completed"
        ? "posted"
        : task.approvalContext?.panelMode;
    const shouldResetBridgeState =
      args.status === "waiting_response" ||
      args.status === "completed" ||
      args.status === "failed";

    await ctx.db.patch(args.taskId, {
      status: args.status,
      resultData: args.resultData,
      errorMessage: args.errorMessage,
      approvalContext:
        task.approvalContext || nextPanelMode
          ? {
              ...task.approvalContext,
              panelMode: nextPanelMode,
            }
          : undefined,
      statusBridgeState: shouldResetBridgeState
        ? undefined
        : task.statusBridgeState,
      statusBridgeSentAt: shouldResetBridgeState
        ? undefined
        : task.statusBridgeSentAt,
      executedAt:
        args.status === "completed" ||
        args.status === "waiting_response" ||
        args.status === "failed"
          ? getCurrentUTCTimestamp()
          : undefined,
    });

    if (
      args.status === "waiting_response" ||
      args.status === "completed" ||
      args.status === "failed"
    ) {
      await recordMemoryWorkflowEvent(ctx, {
        workspaceId: plan.workspaceId,
        eventType:
          args.status === "failed"
            ? "outreach_task_failed"
            : "outreach_task_completed",
        sourceType: "outreach_task",
        sourceId: String(args.taskId),
        planId: plan._id,
        taskId: args.taskId,
        prospectId: plan.prospectId,
        payload: {
          status: args.status,
          postedTweetId: getPostedTweetId(args.resultData),
          conversationId: getStringProperty(args.resultData, "conversationId"),
          messageId: getStringProperty(args.resultData, "messageId"),
          errorClassification: classification,
          errorMessage: args.errorMessage,
        },
        eventKey: `outreach-task:${args.taskId}:${args.status}:${getPostedTweetId(args.resultData) ?? classification ?? "none"}`,
      });
    }

    if (
      args.status === "failed" &&
      classification &&
      AUTH_FAILURE_CLASSES.has(classification)
    ) {
      const now = getCurrentUTCTimestamp();
      const prospect = await ctx.db.get(plan.prospectId);

      if (plan.status !== "completed" && plan.status !== "abandoned") {
        await ctx.db.patch(plan._id, {
          status: "blocked_auth",
          updatedAt: now,
        });
      }

      await upsertNotificationByKey(ctx, {
        userId: plan.userId,
        workspaceId: plan.workspaceId,
        type: "error",
        notificationKey: buildAccountHealthNotificationKey("twitter"),
        title: "Reconnect X account to resume outreach",
        message:
          classification === "scope_missing"
            ? "Posting failed because required X write permissions are missing. Reconnect your X account with tweet.write and media.write."
            : "Posting failed because X authentication expired. Reconnect your X account to continue.",
        prospectId: plan.prospectId,
        planId: plan._id,
        taskId: task._id,
        targetHref: "/settings/connected-accounts",
        prospectAvatarUrl: extractAvatarUrl(prospect?.data),
        prospectDisplayName:
          prospect?.displayName || extractDisplayName(prospect?.data),
        prospectType: prospect?.prospectType,
        prospectPlatform: prospect?.platform,
        prospectScreenName: extractScreenName(prospect),
        contextPlatform: "twitter",
      });
    }
  },
});

/**
 * Handle prospect response (internal, called by webhook).
 * Creates notification and updates task status.
 */
async function handleProspectResponseCore(
  ctx: any,
  args: {
    prospectId: Id<"prospects">;
    planId?: Id<"outreachPlans">;
    responseText?: string;
    responseData?: unknown;
    responseChannel:
      | "twitter_reply"
      | "twitter_dm"
      | "linkedin_dm"
      | "linkedin_invite";
    responseMessageId: string;
    conversationId?: string;
  }
) {
  const now = getCurrentUTCTimestamp();

  let plan = null;
  if (args.planId) {
    plan = await ctx.db.get(args.planId);
  }

  if (!plan) {
    plan = await ctx.db
      .query("outreachPlans")
      .withIndex("by_prospect", (q: any) => q.eq("prospectId", args.prospectId))
      .filter((q: any) =>
        q.and(
          q.neq(q.field("status"), "completed"),
          q.neq(q.field("status"), "abandoned")
        )
      )
      .first();
  }

  if (!plan) {
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect) {
      console.warn(
        `[Outreach] Received response for prospect ${args.prospectId} but no prospect was found`
      );
      return { success: false, error: "Prospect not found" };
    }

    const prospectAvatarUrl = extractAvatarUrl(prospect.data);
    const prospectDisplayName =
      prospect.displayName || extractDisplayName(prospect.data);
    const prospectScreenName = extractScreenName(prospect);

    const workspace = await ctx.db.get(prospect.workspaceId);
    const useCase = getWorkspaceUseCase(workspace?.useCaseKey);
    const entitySingular = useCase.entitySingular;
    const entitySingularLower = entitySingular.toLowerCase();

    await ctx.db.insert("outreachNotifications", {
      userId: prospect.userId,
      workspaceId: prospect.workspaceId,
      type: "prospect_replied",
      title:
        args.responseChannel === "linkedin_invite"
          ? `${prospectDisplayName || entitySingular} accepted your invitation`
          : `${prospectDisplayName || entitySingular} replied`,
      message: args.responseText
        ? `"${args.responseText.substring(0, 100)}${args.responseText.length > 100 ? "..." : ""}"`
        : args.responseChannel === "linkedin_invite"
          ? `The ${entitySingularLower} accepted your LinkedIn invitation.`
          : args.responseChannel === "twitter_reply"
            ? "A new reply came in on X."
            : args.responseChannel === "linkedin_dm"
              ? "A new DM reply came in on LinkedIn."
              : "A new DM reply came in on X.",
      status: "pending",
      prospectId: args.prospectId,
      prospectAvatarUrl,
      prospectDisplayName,
      prospectType: prospect.prospectType,
      prospectPlatform: prospect.platform,
      prospectScreenName,
      replyCount: 1,
    });

    await ctx.db.insert("prospectActivityLog", {
      prospectId: args.prospectId,
      workspaceId: prospect.workspaceId,
      type: "responded",
      title:
        args.responseChannel === "twitter_dm" ||
        args.responseChannel === "linkedin_dm"
          ? "DM response received"
          : args.responseChannel === "linkedin_invite"
            ? "Invitation accepted"
            : "Response received",
      description: args.responseText,
      metadata: {
        responseTweetId:
          args.responseChannel === "twitter_reply"
            ? args.responseMessageId
            : undefined,
        responseDmMessageId:
          args.responseChannel === "twitter_dm" ||
          args.responseChannel === "linkedin_dm"
            ? args.responseMessageId
            : undefined,
        responseInviteId:
          args.responseChannel === "linkedin_invite"
            ? args.responseMessageId
            : undefined,
        conversationId: args.conversationId,
      },
    });

    await recordMemoryWorkflowEvent(ctx, {
      workspaceId: prospect.workspaceId,
      eventType: "prospect_responded",
      sourceType: "prospect",
      sourceId: String(args.prospectId),
      prospectId: args.prospectId,
      payload: {
        responseChannel: args.responseChannel,
        responseMessageId: args.responseMessageId,
        hadWaitingTask: false,
        conversationId: args.conversationId,
      },
    });

    return { success: true, planless: true };
  }

  const waitingTask = await ctx.db
    .query("outreachTasks")
    .withIndex("by_plan", (q: any) => q.eq("planId", plan._id))
    .filter((q: any) => q.eq(q.field("status"), "waiting_response"))
    .first();

  if (waitingTask) {
    const existingPostedTweetId = getPostedTweetId(waitingTask.resultData);
    if (!existingPostedTweetId && args.responseChannel === "twitter_reply") {
      throw new Error(
        "Invariant violation: cannot mark completed without postedTweetId"
      );
    }

    await ctx.db.patch(waitingTask._id, {
      status: "completed",
      resultData: {
        ...waitingTask.resultData,
        responseReceived: true,
        responseTweetId:
          args.responseChannel === "twitter_reply"
            ? args.responseMessageId
            : undefined,
        responseDmMessageId:
          args.responseChannel === "twitter_dm"
            ? args.responseMessageId
            : undefined,
        responseChannel: args.responseChannel,
        responseText: args.responseText,
        responseReceivedAt: now,
        conversationId: args.conversationId,
      },
      statusBridgeState: undefined,
      statusBridgeSentAt: undefined,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.chat.bridgeOutreachTaskStatusToThread,
      { taskId: waitingTask._id }
    );
  }

  const remainingTasks = await ctx.db
    .query("outreachTasks")
    .withIndex("by_plan", (q: any) => q.eq("planId", plan._id))
    .filter((q: any) =>
      q.and(
        q.neq(q.field("status"), "completed"),
        q.neq(q.field("status"), "skipped")
      )
    )
    .collect();

  if (remainingTasks.length === 0 && plan.status !== "completed") {
    await ctx.db.patch(plan._id, {
      status: "completed",
      updatedAt: now,
    });
    await syncPlanCompletedNotification(
      ctx,
      { ...plan, status: "completed" },
      "completed"
    );
  }

  const prospect = await ctx.db.get(args.prospectId);
  const prospectAvatarUrl = extractAvatarUrl(prospect?.data);
  const prospectDisplayName =
    prospect?.displayName || extractDisplayName(prospect?.data);
  const prospectType = prospect?.prospectType;
  const prospectScreenName = extractScreenName(prospect);

  if (prospect) {
    await ctx.db.patch(args.prospectId, {
      status: "in_progress",
      pipelineStage: "in_progress",
      stageTimestamps: {
        ...prospect.stageTimestamps,
        in_progress: now,
      },
      updatedAt: now,
    });
  }

  const workspace = await ctx.db.get(plan.workspaceId);
  const useCase = getWorkspaceUseCase(workspace?.useCaseKey);
  const entitySingular = useCase.entitySingular;
  const entitySingularLower = entitySingular.toLowerCase();
  const title =
    args.responseChannel === "linkedin_invite"
      ? `${prospectDisplayName || entitySingular} accepted your invitation`
      : `${prospectDisplayName || entitySingular} replied`;

  await ctx.db.insert("outreachNotifications", {
    userId: plan.userId,
    workspaceId: plan.workspaceId,
    type: "prospect_replied",
    title,
    message: args.responseText
      ? `"${args.responseText.substring(0, 100)}${args.responseText.length > 100 ? "..." : ""}"`
      : args.responseChannel === "linkedin_invite"
        ? `The ${entitySingularLower} accepted your LinkedIn invitation.`
        : `The ${entitySingularLower} replied to your outreach.`,
    status: "pending",
    prospectId: args.prospectId,
    planId: plan._id,
    taskId: waitingTask?._id,
    prospectAvatarUrl,
    prospectDisplayName,
    prospectType,
    prospectPlatform: prospect?.platform,
    prospectScreenName,
    replyCount: 1,
  });

  await ctx.db.insert("prospectActivityLog", {
    prospectId: args.prospectId,
    workspaceId: plan.workspaceId,
    type: "responded",
    title:
      args.responseChannel === "twitter_dm" ||
      args.responseChannel === "linkedin_dm"
        ? "DM response received"
        : args.responseChannel === "linkedin_invite"
          ? "Invitation accepted"
          : "Response received",
    description: args.responseText,
    metadata: {
      responseTweetId:
        args.responseChannel === "twitter_reply"
          ? args.responseMessageId
          : undefined,
      responseDmMessageId:
        args.responseChannel === "twitter_dm" ||
        args.responseChannel === "linkedin_dm"
          ? args.responseMessageId
          : undefined,
      responseInviteId:
        args.responseChannel === "linkedin_invite"
          ? args.responseMessageId
          : undefined,
      conversationId: args.conversationId,
      planId: plan._id,
    },
  });
  await recordMemoryWorkflowEvent(ctx, {
    workspaceId: plan.workspaceId,
    eventType: "prospect_responded",
    sourceType: "prospect",
    sourceId: String(args.prospectId),
    prospectId: args.prospectId,
    planId: plan._id,
    taskId: waitingTask?._id,
    payload: {
      responseChannel: args.responseChannel,
      responseMessageId: args.responseMessageId,
      hadWaitingTask: Boolean(waitingTask),
      conversationId: args.conversationId,
    },
  });

  console.info(
    `[Outreach] Recorded response from prospect ${args.prospectId} via ${args.responseChannel}`
  );

  return { success: true };
}

export const onProspectResponse = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    planId: v.optional(v.id("outreachPlans")),
    responseTweetId: v.string(),
    responseText: v.optional(v.string()),
    responseData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await handleProspectResponseCore(ctx, {
      prospectId: args.prospectId,
      planId: args.planId,
      responseText: args.responseText,
      responseData: args.responseData,
      responseChannel: "twitter_reply",
      responseMessageId: args.responseTweetId,
    });
  },
});

export const onProspectDmResponse = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    planId: v.optional(v.id("outreachPlans")),
    responseMessageId: v.string(),
    responseText: v.optional(v.string()),
    responseData: v.optional(v.any()),
    conversationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await handleProspectResponseCore(ctx, {
      prospectId: args.prospectId,
      planId: args.planId,
      responseText: args.responseText,
      responseData: args.responseData,
      responseChannel: "twitter_dm",
      responseMessageId: args.responseMessageId,
      conversationId: args.conversationId,
    });
  },
});

export const onProspectLinkedInResponse = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    planId: v.optional(v.id("outreachPlans")),
    responseType: v.union(v.literal("dm"), v.literal("invite")),
    responseMessageId: v.string(),
    responseText: v.optional(v.string()),
    responseData: v.optional(v.any()),
    conversationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await handleProspectResponseCore(ctx, {
      prospectId: args.prospectId,
      planId: args.planId,
      responseText: args.responseText,
      responseData: args.responseData,
      responseChannel:
        args.responseType === "invite" ? "linkedin_invite" : "linkedin_dm",
      responseMessageId: args.responseMessageId,
      conversationId: args.conversationId,
    });
  },
});

// ============================================================================
// Workflow Management (for human-in-the-loop approval)
// ============================================================================

/**
 * Update plan with workflow ID (internal).
 * Called when workflow starts to store the ID for sendEvent later.
 * Note: Don't set status here - let the workflow handler do it after checking.
 */
export const updatePlanWorkflowId = internalMutation({
  args: {
    planId: v.id("outreachPlans"),
    workflowId: v.string(),
  },
  handler: async (ctx, { planId, workflowId }) => {
    await ctx.db.patch(planId, {
      workflowId,
      // Don't change status here - the workflow handler checks for "approved"
      // and sets to "executing" after the check passes
      updatedAt: getCurrentUTCTimestamp(),
    });
  },
});

/** List plans for a prospect (internal, for archive pause). */
export const listOutreachPlansForProspectInternal = internalQuery({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    return await ctx.db
      .query("outreachPlans")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .collect();
  },
});

export const patchPlanPausedForArchive = internalMutation({
  args: {
    planId: v.id("outreachPlans"),
    previousStatus: outreachPlanArchiveHoldPreviousStatusValidator,
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.archiveHold) {
      return;
    }
    await ctx.db.patch(args.planId, {
      status: "paused",
      archiveHold: { previousStatus: args.previousStatus },
      updatedAt: getCurrentUTCTimestamp(),
    });
  },
});

/**
 * Restores outreach plan statuses from archiveHold after unarchive.
 * Prior approved/executing (pre-archive) become approved + outreach workflow scheduled.
 */
export const resumeOutreachPlansAfterUnarchive = internalMutation({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    const result = await resumeOutreachPlansAfterUnarchiveCore(ctx, prospectId);
    return { ok: result.ok };
  },
});

/**
 * Create notification for task approval (internal).
 * Called before executing comment tasks to get human approval.
 */
export const createTaskApprovalNotification = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    prospectId: v.id("prospects"),
    planId: v.id("outreachPlans"),
    taskId: v.id("outreachTasks"),
    workflowId: v.string(),
    content: v.string(),
    platform: v.optional(v.union(v.literal("twitter"), v.literal("linkedin"))),
    targetTweetId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    // Prospect display data
    prospectAvatarUrl: v.optional(v.string()),
    prospectDisplayName: v.optional(v.string()),
    prospectType: v.optional(prospectTypeValidator),
    prospectPlatform: v.optional(prospectPlatformValidator),
    prospectScreenName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = getCurrentUTCTimestamp();
    // Guarantee threadId: use provided or fallback to plan's threadId
    let threadId = args.threadId;
    if (!threadId) {
      const plan = await ctx.db.get(args.planId);
      if (plan?.threadId) {
        threadId = plan.threadId;
        console.info(
          `[Outreach] Using plan's threadId for notification: ${threadId}`
        );
      }
    }

    const workspace = await ctx.db.get(args.workspaceId);
    const useCase = getWorkspaceUseCase(workspace?.useCaseKey);
    const name =
      args.prospectDisplayName || useCase.entitySingular.toLowerCase();
    const taskPlatform = args.platform ?? "twitter";
    const title =
      taskPlatform === "linkedin" || !args.targetTweetId
        ? `Approve the DM to ${name}`
        : `Approve the reply to ${name}`;

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const approvalNonce = (task.approvalNonce ?? 0) + 1;
    const approvalEventId = await workflowManager.createEvent(ctx, {
      name: `task_approved:${args.taskId}:${approvalNonce}`,
      workflowId: args.workflowId as unknown as ReturnType<
        typeof workflowManager.start
      > extends Promise<infer T>
        ? T
        : never,
    });

    // Persist deterministic approval context directly on task so chat cards can
    // reopen the correct panel even when notification URL params are absent.
    const prospect = await ctx.db.get(args.prospectId);
    const source = args.targetTweetId
      ? findSourcePostInProspect(prospect, args.targetTweetId)
      : null;
    const existingApprovalContext = task.approvalContext;
    await ctx.db.patch(args.taskId, {
      approvalContext: {
        panelMode: "approval",
        platform:
          existingApprovalContext?.platform ??
          args.platform ??
          source?.platform ??
          "twitter",
        sourcePostRef:
          existingApprovalContext?.sourcePostRef ??
          source?.sourcePostRef ??
          (args.targetTweetId
            ? {
                platform: "twitter",
                postId: args.targetTweetId,
                conversationId: args.targetTweetId,
              }
            : undefined),
        sourcePostSummary:
          existingApprovalContext?.sourcePostSummary ??
          source?.sourcePostSummary,
        sourceContext:
          existingApprovalContext?.sourceContext ?? "Approval required",
      },
      approvalEventId,
      approvalRequestedAt: now,
      approvedAt: undefined,
      approvalNonce,
    });

    await ctx.db.insert("outreachNotifications", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      type: "ask_human",
      title,
      message: args.content.trim()
        ? `"${args.content.substring(0, 100)}${args.content.length > 100 ? "..." : ""}"`
        : "Approval required for a media-only DM.",
      status: "pending",
      prospectId: args.prospectId,
      planId: args.planId,
      taskId: args.taskId,
      threadId,
      approvalEventId,
      // Denormalized prospect data
      prospectAvatarUrl: args.prospectAvatarUrl,
      prospectDisplayName: args.prospectDisplayName,
      prospectType: args.prospectType,
      prospectPlatform: args.prospectPlatform,
      prospectScreenName: args.prospectScreenName,
    });

    console.info(
      `[Outreach] Created approval notification for task ${args.taskId} event=${approvalEventId}`
    );

    return { approvalEventId };
  },
});

/**
 * Save user edits (text/media) and approve task in one atomic mutation.
 */
export const approveTaskWithEdits = mutation({
  args: {
    taskId: v.id("outreachTasks"),
    expectedType: outreachEditableTaskTypeValidator,
    content: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    mediaDescriptions: v.optional(v.array(v.string())),
    mediaKinds: v.optional(v.array(twitterMediaKindValidator)),
    approvalContext: v.optional(outreachTaskApprovalContextValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const { task, plan } = await requireOwnedTask(ctx, args.taskId, {
      user,
      notFoundMessage: "Task not found",
      notAuthorizedMessage: "Not authorized to approve this task",
    });
    if (task.type !== "comment" && task.type !== "dm") {
      throw new Error("Only comment and DM tasks can be approved with edits");
    }
    assertExpectedTaskType(task, args.expectedType);
    const alreadyHandledStatus =
      task.status === "waiting_response" || task.status === "completed";
    const actionableStatus =
      task.status === "pending" || task.status === "executing";
    if (!alreadyHandledStatus && !actionableStatus) {
      throw new Error("Task is no longer actionable");
    }

    if (!task.approvalEventId) {
      throw new Error("Task approval signal is missing. Reopen and retry.");
    }
    if (task.approvedAt || alreadyHandledStatus) {
      return { success: true, duplicate: true };
    }

    const trimmedContent = args.content.trim();
    const mediaUrls =
      args.mediaUrls?.filter(
        (mediaUrl): mediaUrl is string =>
          typeof mediaUrl === "string" && mediaUrl.trim().length > 0
      ) ?? [];
    const prospect = await ctx.db.get(plan.prospectId);
    const validationError = await getTaskDraftValidationError(ctx, {
      task,
      prospect,
      userId: plan.userId,
      content: trimmedContent,
      mediaUrls,
    });
    if (validationError) {
      throw new Error(validationError);
    }

    if (
      args.mediaDescriptions &&
      args.mediaDescriptions.length > mediaUrls.length
    ) {
      throw new Error("mediaDescriptions cannot exceed mediaUrls length");
    }
    if (args.mediaKinds && args.mediaKinds.length > mediaUrls.length) {
      throw new Error("mediaKinds cannot exceed mediaUrls length");
    }

    // Preserve original draft for style learning before overwriting
    const originalDraft = task.content;
    const isEdited = trimmedContent !== (originalDraft || "").trim();
    const mediaKinds = normalizeMediaKinds(args.mediaKinds, mediaUrls);

    await ctx.db.patch(args.taskId, {
      content: trimmedContent,
      originalDraftContent: originalDraft,
      mediaUrls,
      mediaDescriptions: args.mediaDescriptions,
      mediaKinds,
      approvedAt: getCurrentUTCTimestamp(),
      approvalContext: args.approvalContext
        ? {
            ...task.approvalContext,
            ...args.approvalContext,
          }
        : task.approvalContext,
    });

    await recordMemoryWorkflowEvent(ctx, {
      workspaceId: plan.workspaceId,
      eventType: "outreach_task_approved",
      sourceType: "outreach_task",
      sourceId: String(args.taskId),
      planId: plan._id,
      taskId: args.taskId,
      prospectId: plan.prospectId,
      payload: {
        edited: isEdited,
        contentLength: trimmedContent.length,
        weightedLength:
          task.type === "comment"
            ? getXPostWeightedLength(trimmedContent)
            : undefined,
      },
      eventKey: `outreach-task:${args.taskId}:approved:${task.approvalNonce ?? 0}`,
    });

    // Capture edit diff for writing style learning
    if (isEdited && originalDraft) {
      const xAccount = await ctx.db
        .query("xAccounts")
        .withIndex("by_user", (q) => q.eq("userId", plan.userId))
        .first();
      if (xAccount) {
        await recordMemoryWorkflowEvent(ctx, {
          workspaceId: plan.workspaceId,
          eventType: "style_edit_diff_captured",
          sourceType: "style_edit_diff",
          sourceId: `task:${args.taskId}:style-edit`,
          prospectId: plan.prospectId,
          planId: plan._id,
          taskId: args.taskId,
          payload: {
            originalDraft,
            editedContent: trimmedContent,
            diffSource: "outreach_task",
            platform: getRecordedPlatform(task, prospect),
            sourceVersion:
              xAccount.styleSourceVersion ?? xAccount._creationTime,
            sourceExternalUserId: xAccount.xUserId,
          },
          eventKey: `style-edit:task:${args.taskId}:${task.approvalNonce ?? 0}`,
        });
      }
    }

    await ctx.scheduler.runAfter(
      0,
      internal.workflows.outreach.sendTaskApproval,
      {
        approvalEventId: task.approvalEventId,
        taskId: args.taskId,
      }
    );

    return { success: true, duplicate: false };
  },
});

export const updatePendingTaskDraft = mutation({
  args: {
    taskId: v.id("outreachTasks"),
    expectedType: outreachEditableTaskTypeValidator,
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const { task, plan } = await requireOwnedTask(ctx, args.taskId, {
      user,
      notFoundMessage: "Task not found",
      notAuthorizedMessage: "Not authorized to update this task",
    });

    if (task.type !== "comment" && task.type !== "dm") {
      throw new Error("Only comment and DM tasks support draft updates");
    }
    assertExpectedTaskType(task, args.expectedType);

    if (task.status !== "pending" && task.status !== "executing") {
      throw new Error("Task draft is no longer editable");
    }

    const trimmedContent = args.content.trim();
    const mediaUrls =
      task.mediaUrls?.filter(
        (mediaUrl): mediaUrl is string =>
          typeof mediaUrl === "string" && mediaUrl.trim().length > 0
      ) ?? [];
    const prospect = await ctx.db.get(plan.prospectId);
    const validationError = await getTaskDraftValidationError(ctx, {
      task,
      prospect,
      userId: plan.userId,
      content: trimmedContent,
      mediaUrls,
    });
    if (validationError) {
      throw new Error(validationError);
    }

    await ctx.db.patch(args.taskId, {
      content: trimmedContent,
    });

    return { success: true };
  },
});

/**
 * Approve a specific task (public, for UI).
 * Sends event to resume workflow after user approves.
 */
export const approveTask = mutation({
  args: {
    taskId: v.id("outreachTasks"),
    expectedType: v.optional(v.literal("comment")),
  },
  handler: async (ctx, { taskId, expectedType }) => {
    const user = await requireViewerUser(ctx);
    const { task, plan } = await requireOwnedTask(ctx, taskId, {
      user,
      notFoundMessage: "Task not found",
      notAuthorizedMessage: "Not authorized to approve this task",
    });
    if (task.type === "dm") {
      throw new Error(
        "DM tasks must be opened in the conversation panel and sent from there."
      );
    }
    if (expectedType) {
      assertExpectedTaskType(task, expectedType);
    }
    const alreadyHandledStatus =
      task.status === "waiting_response" || task.status === "completed";
    const actionableStatus =
      task.status === "pending" || task.status === "executing";
    if (!alreadyHandledStatus && !actionableStatus) {
      throw new Error("Task is no longer actionable");
    }

    if (!task.approvalEventId) {
      throw new Error("Task approval signal is missing. Reopen and retry.");
    }
    if (task.approvedAt || alreadyHandledStatus) {
      console.info(
        `[Outreach] Duplicate approval ignored for task ${taskId} (status=${task.status})`
      );
      return;
    }

    const prospectApprove = await ctx.db.get(plan.prospectId);
    if (!prospectApprove) {
      throw new Error("Prospect not found");
    }
    requireProspectNotArchived(prospectApprove);

    await ctx.db.patch(taskId, {
      approvedAt: getCurrentUTCTimestamp(),
    });

    await recordMemoryWorkflowEvent(ctx, {
      workspaceId: plan.workspaceId,
      eventType: "outreach_task_approved",
      sourceType: "outreach_task",
      sourceId: String(taskId),
      planId: plan._id,
      taskId,
      prospectId: plan.prospectId,
      payload: {
        edited: false,
      },
      eventKey: `outreach-task:${taskId}:approved:${task.approvalNonce ?? 0}`,
    });

    // Send event to resume workflow
    await ctx.scheduler.runAfter(
      0,
      internal.workflows.outreach.sendTaskApproval,
      {
        approvalEventId: task.approvalEventId,
        taskId,
      }
    );

    console.info(
      `[Outreach] Task ${taskId} approved by user, resuming workflow`
    );
  },
});

/**
 * Approve a specific task (internal, for agent tools).
 * Same as public approveTask but without auth check since agent tools
 * run in scheduled context where ctx.auth is null.
 * Per docs/convex/tools.md line 81: "in scheduled functions, workflows, etc, the auth user will be null"
 */
export const approveTaskInternal = internalMutation({
  args: { taskId: v.id("outreachTasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (task.type === "dm") {
      throw new Error(
        "DM tasks must be opened in the conversation panel and sent from there."
      );
    }
    const plan = await ctx.db.get(task.planId);
    if (!plan) throw new Error("Plan not found");
    if (!task.approvalEventId) {
      throw new Error("Task approval signal is missing. Reopen and retry.");
    }
    if (task.approvedAt) {
      console.info(
        `[Outreach] Duplicate internal approval ignored for task ${taskId}`
      );
      return;
    }

    const prospectInternalApprove = await ctx.db.get(plan.prospectId);
    if (!prospectInternalApprove) {
      throw new Error("Prospect not found");
    }
    requireProspectNotArchived(prospectInternalApprove);

    await ctx.db.patch(taskId, {
      approvedAt: getCurrentUTCTimestamp(),
    });

    await recordMemoryWorkflowEvent(ctx, {
      workspaceId: plan.workspaceId,
      eventType: "outreach_task_approved",
      sourceType: "outreach_task",
      sourceId: String(taskId),
      planId: plan._id,
      taskId,
      prospectId: plan.prospectId,
      payload: {
        edited: false,
      },
      eventKey: `outreach-task:${taskId}:approved:${task.approvalNonce ?? 0}`,
    });

    // Send event to resume workflow
    await ctx.scheduler.runAfter(
      0,
      internal.workflows.outreach.sendTaskApproval,
      {
        approvalEventId: task.approvalEventId,
        taskId,
      }
    );

    console.info(
      `[Outreach] Task ${taskId} approved (internal), resuming workflow`
    );
  },
});
