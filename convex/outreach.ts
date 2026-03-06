// convex/outreach.ts
// Public queries and internal mutations for outreach system
// Following existing patterns from prospects.ts

import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  getProspectActivePlan,
  createOutreachPlan,
  refinePlan as refinePlanCore,
  approvePlan as approvePlanCore,
  getProspectActivityLog,
  logProspectActivity,
  createNotification,
  type OutreachPlanInput,
  type OutreachTaskInput,
} from "./lib/outreachCore";
import {
  extractAvatarUrl,
  extractDisplayName,
  extractScreenName,
} from "./lib/notificationHelpers";
import {
  outreachStrategyValidator,
  outreachTaskTimingValidator,
  outreachTaskTypeValidator,
  outreachTaskApprovalContextValidator,
  outreachPlanStatusValidator,
  outreachTaskStatusValidator,
  prospectActivityTypeValidator,
  prospectTypeValidator,
  prospectStatusValidator,
} from "./validators";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { workflow as workflowManager } from "./lib/workflow";
import {
  getNestedRecord,
  getNumberProperty,
  getStringProperty,
  isRecord,
} from "./lib/typeGuards";
import { getUserFromIdentity } from "./lib/userUtils";

type PanelMode = "approval" | "posted";
type ActivityPlanTaskSummary = {
  _id: string;
  order: number;
  type: string;
  description: string;
  status: string;
  content?: string;
};
type ActivityPlanSnapshot = {
  status: string;
  tasks: ActivityPlanTaskSummary[];
};

const DEFAULT_ACTIVITY_PAGE_SIZE = 20;
const MAX_ACTIVITY_PAGE_SIZE = 100;
const AUTH_FAILURE_CLASSES = new Set(["reauth_required", "scope_missing"]);

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
  if (!isRecord(postData)) return null;

  const idStr = getStringProperty(postData, "id_str");
  if (idStr) return idStr;

  const id = postData.id;
  if (typeof id === "string") return id;
  if (typeof id === "number") return String(id);

  return null;
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

function toActivityPageSize(limit?: number): number {
  const rawLimit = limit ?? DEFAULT_ACTIVITY_PAGE_SIZE;
  return Math.min(MAX_ACTIVITY_PAGE_SIZE, Math.max(1, Math.floor(rawLimit)));
}

function parsePlanSnapshot(snapshot: unknown): ActivityPlanSnapshot | null {
  if (!isRecord(snapshot)) return null;

  const status =
    typeof snapshot.status === "string" ? snapshot.status : "unknown";
  const rawTasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];

  const tasks: ActivityPlanTaskSummary[] = rawTasks
    .filter(isRecord)
    .map((task, index) => ({
      _id:
        typeof task._id === "string" && task._id.length > 0
          ? task._id
          : `snapshot-task-${index + 1}`,
      order: typeof task.order === "number" ? task.order : index + 1,
      type: typeof task.type === "string" ? task.type : "comment",
      description: typeof task.description === "string" ? task.description : "",
      status: typeof task.status === "string" ? task.status : "pending",
      content: typeof task.content === "string" ? task.content : undefined,
    }));

  return { status, tasks };
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
  sourcePostData: unknown;
  sourcePostId?: string;
} | null {
  if (!prospect) return null;

  const platform = prospect.platform === "linkedin" ? "linkedin" : "twitter";
  const candidatePosts: unknown[] = [];
  if (prospect.data) candidatePosts.push(prospect.data);
  if (Array.isArray(prospect.evidencePosts)) {
    candidatePosts.push(...prospect.evidencePosts);
  }

  if (!targetTweetId) {
    if (candidatePosts.length === 0) return null;
    return {
      platform,
      sourcePostData: candidatePosts[0],
      sourcePostId: getTweetIdFromPostData(candidatePosts[0]) ?? undefined,
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
    sourcePostData: matched,
    sourcePostId: targetTweetId,
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
    return ensureOwnedTask(await ctx.db.get(taskId));
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) throw new Error("User not found");

    const prospect = await ctx.db.get(prospectId);
    if (!prospect) throw new Error("Prospect not found");
    if (prospect.userId !== user._id) {
      throw new Error("Not authorized to view this prospect");
    }

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
      ActivityPlanSnapshot
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
      ActivityPlanSnapshot
    >();

    await Promise.all(
      Array.from(planIdsToFetch).map(async (planId) => {
        const plan = await ctx.db.get(planId);
        if (!plan || plan.prospectId !== prospectId) return;

        const tasks = await ctx.db
          .query("outreachTasks")
          .withIndex("by_plan_order", (q) => q.eq("planId", planId))
          .collect();

        planSnapshotByPlanId.set(planId, {
          status: plan.status,
          tasks: tasks.map((task) => ({
            _id: task._id,
            order: task.order,
            type: task.type,
            description: task.description,
            status: task.status,
            content: task.content,
          })),
        });
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();
    if (!user) throw new Error("User not found");

    // Backward-compatible: if workspaceId isn't provided, use active default workspace.
    let resolvedWorkspaceId = workspaceId;
    if (!resolvedWorkspaceId) {
      const defaultWorkspace = await ctx.db
        .query("workspaces")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", user._id).eq("isDefault", true)
        )
        .first();
      resolvedWorkspaceId = defaultWorkspace?._id;
    }

    if (!resolvedWorkspaceId) {
      return [];
    }

    const workspace = await ctx.db.get(resolvedWorkspaceId);
    if (!workspace) throw new Error("Workspace not found");
    if (workspace.userId !== user._id) {
      throw new Error("Not authorized to view this workspace");
    }

    // Get workspace-scoped notifications for user, ordered by creation time (descending)
    const notifications = await ctx.db
      .query("outreachNotifications")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", resolvedWorkspaceId)
      )
      .filter((q) => q.eq(q.field("userId"), user._id))
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();
    if (!user) throw new Error("User not found");

    const notification = await ctx.db.get(notificationId);
    if (!notification) throw new Error("Notification not found");
    if (notification.userId !== user._id) {
      throw new Error("Not authorized to update this notification");
    }

    const resolvedWorkspaceId = workspaceId ?? notification.workspaceId;
    const workspace = await ctx.db.get(resolvedWorkspaceId);
    if (!workspace) throw new Error("Workspace not found");
    if (workspace.userId !== user._id) {
      throw new Error(
        "Not authorized to update notifications for this workspace"
      );
    }

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();
    if (!user) throw new Error("User not found");

    const notification = await ctx.db.get(notificationId);
    if (!notification) throw new Error("Notification not found");
    if (notification.userId !== user._id) {
      throw new Error("Not authorized to update this notification");
    }

    const resolvedWorkspaceId = workspaceId ?? notification.workspaceId;
    const workspace = await ctx.db.get(resolvedWorkspaceId);
    if (!workspace) throw new Error("Workspace not found");
    if (workspace.userId !== user._id) {
      throw new Error(
        "Not authorized to update notifications for this workspace"
      );
    }

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

/**
 * Get all tasks for a plan (public).
 */
export const getPlanTasks = query({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    return await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_order", (q) => q.eq("planId", planId))
      .collect();
  },
});

/**
 * Get all interactions (posted comment tasks) for a prospect.
 * Includes both "waiting_response" (posted, awaiting reply) and "completed" (prospect responded).
 * Returns data formatted for YourInteractionsTab component.
 */
export const getProspectInteractions = query({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) throw new Error("User not found");

    const prospect = await ctx.db.get(prospectId);
    if (!prospect) throw new Error("Prospect not found");
    if (prospect.userId !== user._id) {
      throw new Error("Not authorized to view this prospect");
    }

    const plans = await ctx.db
      .query("outreachPlans")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .collect();

    if (plans.length === 0) return [];

    const interactions = [];
    for (const plan of plans) {
      const tasks = await ctx.db
        .query("outreachTasks")
        .withIndex("by_plan", (q) => q.eq("planId", plan._id))
        .filter((q) =>
          q.and(
            q.eq(q.field("type"), "comment"),
            q.or(
              q.eq(q.field("status"), "waiting_response"),
              q.eq(q.field("status"), "completed")
            )
          )
        )
        .collect();

      for (const task of tasks) {
        if (task.resultData && typeof task.resultData === "object") {
          const resultData = task.resultData as Record<string, unknown>;
          if (resultData.postedTweetId && task.targetTweetId) {
            const postedBy = resultData.postedBy as
              | {
                  name?: string;
                  screenName?: string;
                  profileImageUrl?: string;
                }
              | undefined;

            interactions.push({
              id: task._id,
              threadId: task.targetTweetId,
              originalPostId: task.targetTweetId,
              repliedAt: task.executedAt || task._creationTime,
              ourTweetId: resultData.postedTweetId as string,
              planId: plan._id,
              postedBy: postedBy
                ? {
                    name: postedBy.name || "You",
                    screenName: postedBy.screenName || "",
                    profileImageUrl: postedBy.profileImageUrl,
                  }
                : undefined,
              hasProspectResponse: !!resultData.responseReceived,
            });
          }
        }
      }
    }

    interactions.sort((a, b) => (b.repliedAt || 0) - (a.repliedAt || 0));

    return interactions;
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) throw new Error("User not found");

    const workspace = await ctx.db.get(workspaceId);
    if (!workspace || workspace.userId !== user._id) {
      throw new Error("Not authorized to view this workspace");
    }

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();
    if (!user) throw new Error("User not found");

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

    const sourcePostData =
      approvalContext?.sourcePostData ?? fallbackSource?.sourcePostData;
    const sourcePlatform =
      approvalContext?.platform ?? fallbackSource?.platform ?? "twitter";
    const sourcePostId =
      approvalContext?.sourcePostId ??
      fallbackSource?.sourcePostId ??
      task.targetTweetId;
    const sourceContext = approvalContext?.sourceContext ?? undefined;

    const resultData = isRecord(task.resultData) ? task.resultData : undefined;
    const postedBy = getNestedRecord(resultData, "postedBy");
    const postedMediaUrls = toStringArray(resultData?.postedMediaUrls);
    const postedMediaDescriptions = toStringArray(
      resultData?.postedMediaDescriptions
    );
    const postedTweetId = getStringProperty(resultData, "postedTweetId");
    const postedText =
      getStringProperty(resultData, "postedText") ||
      getStringProperty(resultData, "text") ||
      task.content ||
      "";

    return {
      mode,
      taskStatus: task.status,
      resolvedTaskId: task._id,
      targetTweetId: task.targetTweetId,
      draft: {
        content: task.content || "",
        mediaUrls: task.mediaUrls || [],
        mediaDescriptions: task.mediaDescriptions || [],
      },
      originalPost: sourcePostData
        ? {
            platform: sourcePlatform,
            postId: sourcePostId,
            context: sourceContext,
            postData: sourcePostData,
          }
        : null,
      posted:
        mode === "posted"
          ? {
              tweetId: postedTweetId,
              text: postedText,
              postedAt:
                getNumberProperty(resultData, "postedAt") || task.executedAt,
              mediaUrls: postedMediaUrls,
              mediaDescriptions: postedMediaDescriptions,
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
    await approvePlanCore(ctx, planId);

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    await approvePlanCore(ctx, planId);

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) throw new Error("User not found");

    const plan = await ctx.db.get(planId);
    if (!plan) throw new Error("Plan not found");
    if (plan.userId !== user._id) {
      throw new Error("Not authorized to resume this plan");
    }
    if (plan.status !== "paused" && plan.status !== "blocked_auth") {
      throw new Error("Can only resume paused or blocked plans");
    }

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
    const plan = await ctx.db.get(planId);
    if (!plan) throw new Error("Plan not found");
    if (plan.status !== "executing") {
      throw new Error("Can only pause executing plans");
    }

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
    const plan = await ctx.db.get(planId);
    if (!plan) throw new Error("Plan not found");

    await ctx.db.patch(planId, {
      status: "abandoned",
      updatedAt: getCurrentUTCTimestamp(),
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

    // Find pending, executing (awaiting approval), or waiting_response task
    return await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "executing"), // Awaiting human approval
          q.eq(q.field("status"), "waiting_response")
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
    await ctx.db.patch(planId, {
      status,
      updatedAt: getCurrentUTCTimestamp(),
    });
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
    await ctx.db.patch(taskId, {
      status,
      executedAt: status === "completed" ? getCurrentUTCTimestamp() : undefined,
    });
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
    prospectScreenName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Dynamic title with name at the end for natural reading
    const name = args.prospectDisplayName || "prospect";
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
      prospectScreenName: args.prospectScreenName,
    });
  },
});

// Note: executeCommentTask and parseTwitterError are now in outreachActions.ts
// because they require Node.js runtime (twitter-api-v2 dependency)

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
    if (
      (args.status === "waiting_response" || args.status === "completed") &&
      !getPostedTweetId(args.resultData)
    ) {
      throw new Error(
        "Invariant violation: waiting_response/completed requires resultData.postedTweetId"
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
      args.status === "failed" &&
      classification &&
      AUTH_FAILURE_CLASSES.has(classification)
    ) {
      const now = getCurrentUTCTimestamp();
      const prospect = await ctx.db.get(plan.prospectId);
      const account = await ctx.db
        .query("socialAccounts")
        .withIndex("by_user_provider", (q) =>
          q.eq("userId", plan.userId).eq("provider", "X")
        )
        .unique();

      if (account) {
        await ctx.db.patch(account._id, {
          connectionStatus:
            classification === "scope_missing"
              ? "scope_missing"
              : "reauth_required",
          reauthRequired: true,
          lastAuthError:
            args.errorMessage ||
            "X authentication failed during outreach execution.",
          lastAuthErrorAt: now,
        });
      }

      if (plan.status !== "completed" && plan.status !== "abandoned") {
        await ctx.db.patch(plan._id, {
          status: "blocked_auth",
          updatedAt: now,
        });
      }

      const reconnectNotice = await ctx.db
        .query("outreachNotifications")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", plan.workspaceId))
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), plan.userId),
            q.eq(q.field("taskId"), task._id),
            q.eq(q.field("type"), "error"),
            q.eq(q.field("status"), "pending")
          )
        )
        .first();

      if (!reconnectNotice) {
        await createNotification(ctx, {
          userId: plan.userId,
          workspaceId: plan.workspaceId,
          type: "error",
          title: "Reconnect X account to resume outreach",
          message:
            classification === "scope_missing"
              ? "Posting failed because tweet.write scope is missing. Reconnect your X account with required scopes."
              : "Posting failed because X authentication expired. Reconnect your X account to continue.",
          prospectId: plan.prospectId,
          planId: plan._id,
          taskId: task._id,
          prospectAvatarUrl: extractAvatarUrl(prospect?.data),
          prospectDisplayName:
            prospect?.displayName || extractDisplayName(prospect?.data),
          prospectType: prospect?.prospectType,
          prospectScreenName: extractScreenName(prospect),
        });
      }
    }
  },
});

/**
 * Handle prospect response (internal, called by webhook).
 * Creates notification and updates task status.
 */
export const onProspectResponse = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    planId: v.optional(v.id("outreachPlans")),
    responseTweetId: v.string(),
    responseText: v.optional(v.string()),
    responseData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = getCurrentUTCTimestamp();

    // Get plan if provided
    let plan = null;
    if (args.planId) {
      plan = await ctx.db.get(args.planId);
    }

    // If no plan provided, try to find active plan for prospect
    if (!plan) {
      plan = await ctx.db
        .query("outreachPlans")
        .withIndex("by_prospect", (q) => q.eq("prospectId", args.prospectId))
        .filter((q) =>
          q.and(
            q.neq(q.field("status"), "completed"),
            q.neq(q.field("status"), "abandoned")
          )
        )
        .first();
    }

    if (!plan) {
      console.warn(
        `[Outreach] Received response for prospect ${args.prospectId} but no active plan found`
      );
      return { success: false, error: "No active plan" };
    }

    // Find the task that was waiting for response
    const waitingTask = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .filter((q) => q.eq(q.field("status"), "waiting_response"))
      .first();

    if (waitingTask) {
      const existingPostedTweetId = getPostedTweetId(waitingTask.resultData);
      if (!existingPostedTweetId) {
        throw new Error(
          "Invariant violation: cannot mark completed without postedTweetId"
        );
      }

      // Update task status to completed
      await ctx.db.patch(waitingTask._id, {
        status: "completed",
        resultData: {
          ...waitingTask.resultData,
          responseReceived: true,
          responseTweetId: args.responseTweetId,
          responseText: args.responseText,
          responseReceivedAt: now,
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
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .filter((q) =>
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
    }

    // Fetch prospect for display data
    const prospect = await ctx.db.get(args.prospectId);
    const prospectAvatarUrl = extractAvatarUrl(prospect?.data);
    const prospectDisplayName =
      prospect?.displayName || extractDisplayName(prospect?.data);
    const prospectType = prospect?.prospectType;
    const prospectScreenName = extractScreenName(prospect);

    // Update prospect status to "in_progress" when they respond
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

    // Dynamic title using prospect display name
    const title = `${prospectDisplayName || "Prospect"} replied`;

    // Create notification
    await ctx.db.insert("outreachNotifications", {
      userId: plan.userId,
      workspaceId: plan.workspaceId,
      type: "prospect_replied",
      title,
      message: args.responseText
        ? `"${args.responseText.substring(0, 100)}${args.responseText.length > 100 ? "..." : ""}"`
        : "The prospect replied to your outreach.",
      status: "pending",
      prospectId: args.prospectId,
      planId: plan._id,
      taskId: waitingTask?._id,
      // Denormalized prospect data
      prospectAvatarUrl,
      prospectDisplayName,
      prospectType,
      prospectScreenName,
      replyCount: 1,
    });

    // Log activity
    await ctx.db.insert("prospectActivityLog", {
      prospectId: args.prospectId,
      workspaceId: plan.workspaceId,
      type: "responded",
      title: "Response received",
      description: args.responseText,
      metadata: {
        responseTweetId: args.responseTweetId,
        planId: plan._id,
      },
    });

    console.info(
      `[Outreach] Recorded response from prospect ${args.prospectId}, created notification`
    );

    return { success: true };
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
    tweetContent: v.string(),
    targetTweetId: v.string(),
    threadId: v.optional(v.string()),
    // Prospect display data
    prospectAvatarUrl: v.optional(v.string()),
    prospectDisplayName: v.optional(v.string()),
    prospectType: v.optional(prospectTypeValidator),
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

    // Dynamic title with name at the end for natural reading
    const name = args.prospectDisplayName || "prospect";
    const title = `Approve the reply to ${name}`;

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
    const source = findSourcePostInProspect(prospect, args.targetTweetId);
    await ctx.db.patch(args.taskId, {
      approvalContext: {
        panelMode: "approval",
        platform: source?.platform ?? "twitter",
        sourcePostId: source?.sourcePostId ?? args.targetTweetId,
        sourcePostData: source?.sourcePostData,
        sourceContext: "Approval required",
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
      message: `"${args.tweetContent.substring(0, 100)}${args.tweetContent.length > 100 ? "..." : ""}"`,
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
    content: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    mediaDescriptions: v.optional(v.array(v.string())),
    approvalContext: v.optional(outreachTaskApprovalContextValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();
    if (!user) throw new Error("User not found");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (task.type !== "comment") {
      throw new Error("Only comment tasks can be approved with edits");
    }
    const alreadyHandledStatus =
      task.status === "waiting_response" || task.status === "completed";
    const actionableStatus =
      task.status === "pending" || task.status === "executing";
    if (!alreadyHandledStatus && !actionableStatus) {
      throw new Error("Task is no longer actionable");
    }

    const plan = await ctx.db.get(task.planId);
    if (!plan) throw new Error("Plan not found");
    if (plan.userId !== user._id) {
      throw new Error("Not authorized to approve this task");
    }
    if (!task.approvalEventId) {
      throw new Error("Task approval signal is missing. Reopen and retry.");
    }
    if (task.approvedAt || alreadyHandledStatus) {
      return { success: true, duplicate: true };
    }

    const trimmedContent = args.content.trim();
    if (!trimmedContent) throw new Error("Reply content is required");
    if (trimmedContent.length > 280) {
      throw new Error("Reply content exceeds X 280 character limit");
    }

    if (
      args.mediaDescriptions &&
      args.mediaDescriptions.length > (args.mediaUrls?.length ?? 0)
    ) {
      throw new Error("mediaDescriptions cannot exceed mediaUrls length");
    }

    await ctx.db.patch(args.taskId, {
      content: trimmedContent,
      mediaUrls: args.mediaUrls,
      mediaDescriptions: args.mediaDescriptions,
      approvedAt: getCurrentUTCTimestamp(),
      approvalContext: args.approvalContext
        ? {
            ...task.approvalContext,
            ...args.approvalContext,
          }
        : task.approvalContext,
    });

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

/**
 * Approve a specific task (public, for UI).
 * Sends event to resume workflow after user approves.
 */
export const approveTask = mutation({
  args: { taskId: v.id("outreachTasks") },
  handler: async (ctx, { taskId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();
    if (!user) throw new Error("User not found");

    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    const alreadyHandledStatus =
      task.status === "waiting_response" || task.status === "completed";
    const actionableStatus =
      task.status === "pending" || task.status === "executing";
    if (!alreadyHandledStatus && !actionableStatus) {
      throw new Error("Task is no longer actionable");
    }

    const plan = await ctx.db.get(task.planId);
    if (!plan) throw new Error("Plan not found");
    if (plan.userId !== user._id) {
      throw new Error("Not authorized to approve this task");
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

    await ctx.db.patch(taskId, {
      approvedAt: getCurrentUTCTimestamp(),
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
    if (!task.approvalEventId) {
      throw new Error("Task approval signal is missing. Reopen and retry.");
    }
    if (task.approvedAt) {
      console.info(
        `[Outreach] Duplicate internal approval ignored for task ${taskId}`
      );
      return;
    }

    await ctx.db.patch(taskId, {
      approvedAt: getCurrentUTCTimestamp(),
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
