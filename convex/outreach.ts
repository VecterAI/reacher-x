// convex/outreach.ts
// Public queries and internal mutations for outreach system
// Following existing patterns from prospects.ts

import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { WorkflowId } from "@convex-dev/workflow";
import { type QueryCtx, type MutationCtx } from "./_generated/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./lib/functionBuilders";
import { Id, Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { logger } from "../shared/lib/logger";
import {
  buildPlanSnapshot,
  getProspectActivePlan,
  createOutreachPlan,
  deleteOutreachPlanCascade,
  stopActiveOutreachRecoveryMonitorsForPlan,
  refinePlan as refinePlanCore,
  getProspectActivityLog,
  logProspectActivity,
  createNotification,
  completeBrowserEncryptedDmTaskCore,
  stopActiveOutreachRecoveryMonitorsForTask,
  type OutreachPlanInput,
  type OutreachPlanSnapshot,
  type OutreachTaskInput,
} from "./lib/outreachCore";
import { recordMemoryWorkflowEvent } from "./lib/memoryCore";
import { startOutreachPlanExecution } from "./lib/outreachApprovalCore";
import {
  extractAvatarUrl,
  buildNotificationTargetHref,
  extractDisplayName,
  extractScreenName,
  getProspectDisplayFields,
  upsertNotificationByKey,
  dismissNotificationsByKey,
} from "./lib/notificationHelpers";
import { getLatestActiveProspectThreadLink } from "./lib/relationshipHelpers";
import {
  outreachStrategyValidator,
  outreachEditableTaskTypeValidator,
  outreachApprovableTaskTypeValidator,
  outreachTaskApprovalContextValidator,
  outreachTaskInputValidator,
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
import { getProspectDisplayLabel } from "./lib/prospectIdentityCore";
import { ensureCurrentOutreachPlanRevision } from "./lib/outreachPlanRevisionCore";
import { getResolvedWorkspaceAgentSettings } from "./lib/workspaceAgentSettingsCore";
import {
  getDefaultWorkspaceForUser,
  getOwnedPlan,
  getOwnedTask,
  requireOwnedPlan,
  requireOwnedProspect,
  requireOwnedTask,
  requireOwnedWorkspace,
  getUserByIdentity,
  requireUser,
  requireProspectEligibleForOutreach,
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
import { matchesLinkedInPostReference } from "../shared/lib/linkedin/comments";
import { toFallbackTweetFromSummary } from "../shared/lib/twitter/ui";
import {
  getDmTextLimitError,
  getPostTextLimitError,
  getXPostWeightedLength,
  hasDmBody,
  hasPostBody,
} from "../shared/lib/twitter/xPostTextLimit";
import { resolveTaskDmComposerState } from "../shared/lib/outreach/taskDmComposerHelpers";
import { getEffectivePostTextLimitForUser } from "./lib/xPostLimits";
import { resumeOutreachPlansAfterUnarchiveCore } from "./lib/resumeOutreachAfterUnarchive";
import {
  getPostedOutreachArtifactId,
  hasRequiredPostedOutreachArtifact,
} from "./lib/outreachResultCore";
import {
  assertOutreachMediaCapability,
  getMediaCapabilityErrorMessage,
  resolveOwnedOutreachMedia,
  withAttachmentNames,
  type OutreachMediaPlatform,
  type ResolvedOutreachMedia,
} from "./lib/mediaCapabilityCore";

type PanelMode = "approval" | "posted";
const outreachLogger = logger.withScope("Outreach");

const AUTH_FAILURE_CLASSES = new Set(["reauth_required", "scope_missing"]);
const LINKEDIN_DM_TEXT_MAX = 8_000;
const OUTREACH_TASK_TYPES = new Set<Doc<"outreachTasks">["type"]>([
  "comment",
  "dm",
  "react",
  "wait",
  "ask_human",
]);
const OUTREACH_REACTION_TYPES = new Set<
  NonNullable<Doc<"outreachTasks">["reactionType"]>
>(["like", "celebrate", "support", "love", "insightful", "funny"]);
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
  void workflowId;
  return `prospects-found:${workspaceId}`;
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
): Array<"image" | "gif" | "video" | "file"> {
  const normalized = Array.isArray(mediaKinds)
    ? mediaKinds.filter(
        (value): value is "image" | "gif" | "video" | "file" =>
          value === "image" ||
          value === "gif" ||
          value === "video" ||
          value === "file"
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

function parseOutreachReactionType(
  value: unknown
): Doc<"outreachTasks">["reactionType"] {
  return typeof value === "string" &&
    OUTREACH_REACTION_TYPES.has(
      value as NonNullable<Doc<"outreachTasks">["reactionType"]>
    )
    ? (value as NonNullable<Doc<"outreachTasks">["reactionType"]>)
    : undefined;
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
  if (prospect) {
    return prospect.platform === "linkedin" ? "linkedin" : "twitter";
  }
  return task.approvalContext?.platform ?? "twitter";
}

interface TaskDraftValidationResult {
  error: string | null;
  media: ResolvedOutreachMedia[];
  platform: OutreachMediaPlatform;
}

async function validateTaskDraft(
  ctx: MutationCtx,
  args: {
    task: Pick<
      Doc<"outreachTasks">,
      | "type"
      | "description"
      | "approvalContext"
      | "mediaUrls"
      | "mediaUploadIds"
    >;
    prospect?: Pick<Doc<"prospects">, "platform"> | null;
    userId: Id<"users">;
    workspaceId: Id<"workspaces">;
    content: string;
    mediaUrls: string[];
    mediaUploadIds?: Id<"mediaUploads">[];
  }
): Promise<TaskDraftValidationResult> {
  const platform = getRecordedPlatform(args.task, args.prospect);

  if (args.task.type === "comment") {
    const hasValidBody =
      platform === "linkedin"
        ? args.content.length > 0
        : hasPostBody(args.content, args.mediaUrls);
    if (!hasValidBody) {
      return {
        error:
          platform === "linkedin"
            ? "LinkedIn comment text is required"
            : "Reply text or media is required",
        media: [],
        platform,
      };
    }

    if (platform === "twitter" && args.content) {
      const postLimit = await getEffectivePostTextLimitForUser(
        ctx,
        args.userId
      );
      const textError = getPostTextLimitError(args.content, postLimit);
      if (textError) return { error: textError, media: [], platform };
    }
  }

  if (args.task.type === "dm") {
    if (!hasDmBody(args.content, args.mediaUrls)) {
      return { error: "DM content is required", media: [], platform };
    }

    if (platform === "linkedin") {
      if (args.content.length > LINKEDIN_DM_TEXT_MAX) {
        return {
          error: `LinkedIn DM text exceeds limit (${args.content.length} characters, max ${LINKEDIN_DM_TEXT_MAX}).`,
          media: [],
          platform,
        };
      }
    } else if (args.content) {
      const textError = getDmTextLimitError(args.content);
      if (textError) return { error: textError, media: [], platform };
    }
  }

  try {
    const media = await resolveOwnedOutreachMedia(ctx, {
      userId: args.userId,
      workspaceId: args.workspaceId,
      mediaUrls: args.mediaUrls,
      mediaUploadIds: args.mediaUploadIds,
    });
    if (args.task.type === "comment" || args.task.type === "dm") {
      assertOutreachMediaCapability({
        platform,
        surface: args.task.type,
        media,
      });
    }
    return { error: null, media, platform };
  } catch (error) {
    const mediaError = getMediaCapabilityErrorMessage(error);
    if (mediaError) return { error: mediaError, media: [], platform };
    throw error;
  }
}

function assertExpectedTaskType(
  task: Pick<Doc<"outreachTasks">, "type">,
  expectedType: "comment" | "dm" | "react"
): void {
  if (task.type !== expectedType) {
    throw new Error(
      expectedType === "dm"
        ? "This draft belongs to a reply task, not a DM task."
        : expectedType === "react"
          ? "This task is not a reaction task."
          : "This draft belongs to a DM task, not a reply task."
    );
  }
}

async function recordEditableTaskApprovalMemory(
  ctx: MutationCtx,
  args: {
    task: Doc<"outreachTasks">;
    plan: Doc<"outreachPlans">;
    content: string;
    originalDraft?: string;
    platform: "twitter" | "linkedin";
  }
): Promise<void> {
  const isEdited = args.content.trim() !== (args.originalDraft ?? "").trim();
  await recordMemoryWorkflowEvent(ctx, {
    workspaceId: args.plan.workspaceId,
    eventType: "outreach_task_approved",
    sourceType: "outreach_task",
    sourceId: String(args.task._id),
    planId: args.plan._id,
    taskId: args.task._id,
    prospectId: args.plan.prospectId,
    payload: {
      edited: isEdited,
      contentLength: args.content.length,
      weightedLength:
        args.task.type === "comment"
          ? getXPostWeightedLength(args.content)
          : undefined,
    },
    eventKey: `outreach-task:${args.task._id}:approved:${args.task.approvalNonce ?? 0}`,
  });

  if (!isEdited || !args.originalDraft) return;
  const xAccount = await ctx.db
    .query("xAccounts")
    .withIndex("by_user", (q) => q.eq("userId", args.plan.userId))
    .first();
  if (!xAccount) return;

  await recordMemoryWorkflowEvent(ctx, {
    workspaceId: args.plan.workspaceId,
    eventType: "style_edit_diff_captured",
    sourceType: "style_edit_diff",
    sourceId: `task:${args.task._id}:style-edit`,
    prospectId: args.plan.prospectId,
    planId: args.plan._id,
    taskId: args.task._id,
    payload: {
      originalDraft: args.originalDraft,
      editedContent: args.content,
      diffSource: "outreach_task",
      platform: args.platform,
      sourceVersion: xAccount.styleSourceVersion ?? xAccount._creationTime,
      sourceExternalUserId: xAccount.xUserId,
    },
    eventKey: `style-edit:task:${args.task._id}:${args.task.approvalNonce ?? 0}`,
  });
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
      targetCommentId:
        typeof task.targetCommentId === "string"
          ? task.targetCommentId
          : undefined,
      reactionType: parseOutreachReactionType(task.reactionType),
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
  sourcePostData?: unknown;
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
      sourcePostData: candidatePosts[0],
      sourcePostRef:
        platform === "twitter"
          ? getTwitterPostRef(candidatePosts[0])
          : undefined,
      sourcePostSummary: platform === "twitter" ? firstSummary : undefined,
    };
  }

  const matched = candidatePosts.find((post) => {
    return platform === "linkedin"
      ? matchesLinkedInPostReference(post, targetTweetId)
      : getTweetIdFromPostData(post) === targetTweetId;
  });

  if (!matched) {
    return null;
  }

  return {
    platform,
    sourcePostData: matched,
    sourcePostRef:
      platform === "twitter" ? getTwitterPostRef(matched) : undefined,
    sourcePostSummary:
      platform === "twitter" ? summarizeTwitterPost(matched) : undefined,
  };
}

function buildOutreachPlanViewTasks(
  tasks: Doc<"outreachTasks">[],
  prospect: Doc<"prospects"> | null
) {
  return tasks
    .filter((task) => task.supersededAt === undefined)
    .map((task) => {
      const fallbackSource = findSourcePostInProspect(
        prospect,
        task.targetTweetId
      );
      const sourcePostSummary =
        task.approvalContext?.sourcePostSummary ??
        fallbackSource?.sourcePostSummary;
      const sourcePostRef =
        task.approvalContext?.sourcePostRef ?? fallbackSource?.sourcePostRef;
      const sourcePostData = fallbackSource?.sourcePostData;
      const sourcePlatform =
        task.approvalContext?.platform ?? fallbackSource?.platform;

      return {
        ...task,
        approvalReady: Boolean(task.approvalEventId),
        originalPost:
          task.type === "comment" &&
          sourcePlatform &&
          (sourcePostSummary || sourcePostData)
            ? {
                platform: sourcePlatform,
                postRef: sourcePostRef,
                postSummary: sourcePostSummary,
                postData: sourcePostData,
              }
            : null,
      };
    });
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
          candidate.type === "comment" &&
          candidate.status === status &&
          candidate.supersededAt === undefined
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
    const currentTasks = tasks.filter(
      (task) => task.supersededAt === undefined
    );
    const candidate =
      currentTasks.find(
        (task) =>
          task.type === "comment" &&
          (task.status === "pending" || task.status === "executing")
      ) ??
      currentTasks.find(
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
    const activePlan = await getProspectActivePlan(ctx, prospectId);
    if (!activePlan) {
      return null;
    }

    const prospect = await ctx.db.get(prospectId);
    const tasks = buildOutreachPlanViewTasks(activePlan.tasks, prospect);

    return {
      plan: activePlan.plan,
      tasks,
    };
  },
});

/**
 * Get a specific plan by id with tasks (public).
 */
export const getPlanById = query({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    const user = await requireViewerUser(ctx);
    const plan = await getOwnedPlan(ctx, planId, user._id);
    if (!plan) {
      return null;
    }

    const tasks = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_order", (q) => q.eq("planId", planId))
      .collect();
    const prospect = await ctx.db.get(plan.prospectId);

    return {
      plan,
      tasks: buildOutreachPlanViewTasks(tasks, prospect),
    };
  },
});

/**
 * Get activity log for a prospect (public).
 * Returns timeline entries with optional plan snapshots for plan_created events.
 */
export const getActivityLog = query({
  args: {
    prospectId: v.id("prospects"),
    paginationOpts: paginationOptsValidator,
    type: v.optional(prospectActivityTypeValidator),
    search: v.optional(v.string()),
  },
  handler: async (ctx, { prospectId, paginationOpts, type, search }) => {
    const user = await requireViewerUser(ctx);
    await requireOwnedProspect(ctx, prospectId, {
      user,
      notFoundMessage: "Prospect not found",
      notAuthorizedMessage: "Not authorized to view this prospect",
    });

    const searchTerm = search?.trim() ?? "";
    const activityQuery = type
      ? ctx.db
          .query("prospectActivityLog")
          .withIndex("by_prospect_type", (q) =>
            q.eq("prospectId", prospectId).eq("type", type)
          )
          .order("desc")
      : ctx.db
          .query("prospectActivityLog")
          .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
          .order("desc");
    const paginatedActivities = await activityQuery.paginate(paginationOpts);
    const pageActivities = searchTerm
      ? paginatedActivities.page.filter((activity) =>
          matchesActivitySearch(activity, searchTerm)
        )
      : paginatedActivities.page;

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

        planSnapshotByPlanId.set(
          planId,
          buildPlanSnapshot(
            plan,
            tasks.filter((task) => task.supersededAt === undefined)
          )
        );
      })
    );

    return {
      ...paginatedActivities,
      page: pageActivities.map((activity) => {
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
    };
  },
});

/**
 * List notifications for the current user (public).
 * Returns a stable event-time cursor page for the notifications inbox.
 */
export const listNotifications = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { workspaceId, paginationOpts }) => {
    const user = await requireViewerUser(ctx);

    // Backward-compatible: if workspaceId isn't provided, use active default workspace.
    let resolvedWorkspaceId = workspaceId;
    if (!resolvedWorkspaceId) {
      const defaultWorkspace = await getDefaultWorkspaceForUser(ctx, user._id);
      resolvedWorkspaceId = defaultWorkspace?._id;
    }

    if (!resolvedWorkspaceId) {
      return {
        page: [],
        isDone: true,
        continueCursor: paginationOpts.cursor ?? "",
      };
    }

    await requireOwnedWorkspace(ctx, resolvedWorkspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to view this workspace",
    });

    // Order by the latest meaningful event, not only document creation. Keyed
    // notifications are reused, so an updated older document must re-enter the
    // live result set for its new event version to toast.
    return await ctx.db
      .query("outreachNotifications")
      .withIndex("by_user_workspace_event_updated_at", (q) =>
        q.eq("userId", user._id).eq("workspaceId", resolvedWorkspaceId)
      )
      .filter((q) => q.neq(q.field("status"), "dismissed"))
      .order("desc")
      .paginate(paginationOpts);
  },
});

/**
 * List pending notifications for the live toast monitor.
 *
 * The inbox uses cursor pagination, while the toast monitor intentionally
 * stays a small pending-only query so newly-created approval/reply events can
 * be detected without loading the entire notification history into the app.
 */
export const listPendingNotifications = query({
  args: { workspaceId: v.optional(v.id("workspaces")) },
  handler: async (ctx, { workspaceId }) => {
    const user = await requireViewerUser(ctx);

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

    return await ctx.db
      .query("outreachNotifications")
      .withIndex("by_user_workspace_status_event_updated_at", (q) =>
        q
          .eq("userId", user._id)
          .eq("workspaceId", resolvedWorkspaceId)
          .eq("status", "pending")
      )
      .order("desc")
      .take(100);
  },
});

export const resolveNotificationTarget = query({
  args: {
    notificationId: v.id("outreachNotifications"),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { notificationId, workspaceId }) => {
    const user = await requireViewerUser(ctx);
    const notification = await ctx.db.get(notificationId);
    if (!notification || notification.userId !== user._id) {
      return null;
    }

    const resolvedWorkspaceId = workspaceId ?? notification.workspaceId;
    await requireOwnedWorkspace(ctx, resolvedWorkspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage:
        "Not authorized to resolve notifications for this workspace",
    });

    let resolvedThreadId = notification.threadId;
    if (notification.prospectId) {
      const activeThread = await getLatestActiveProspectThreadLink(
        ctx.db,
        notification.prospectId
      );
      resolvedThreadId = activeThread?.threadId ?? resolvedThreadId;
    }

    return (
      buildNotificationTargetHref({
        targetHref: notification.targetHref,
        prospectId: notification.prospectId,
        threadId: resolvedThreadId,
        taskId: notification.taskId,
        actionRequestId: notification.actionRequestId,
      }) ?? notification.targetHref
    );
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
      messageParts.push(`${twitterSaved} on X/Twitter`);
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
      title: `△ Agent found ${prospectsFound} new ${entityPluralLower}`,
      message:
        messageParts.length > 0
          ? `${messageParts.join(", ")}. Review the strongest matches when you're ready.`
          : `Fresh ${entityPluralLower} are ready for review.`,
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
      actionLabel: "Reconnect",
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

    const tasks = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_order", (q) => q.eq("planId", planId))
      .collect();
    return tasks.filter((task) => task.supersededAt === undefined);
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
        const postedArtifactId = getPostedOutreachArtifactId(
          task,
          task.resultData
        );
        const statusImpliesPosted =
          task.status === "waiting_response" || task.status === "completed";
        const bridgedPosted = task.statusBridgeState === "posted";

        if (!postedArtifactId && (statusImpliesPosted || bridgedPosted)) {
          rows.push({
            planId: plan._id,
            taskId: task._id,
            planStatus: plan.status,
            taskStatus: task.status,
            issue: bridgedPosted
              ? "Chat bridge marked posted without a provider artifact ID"
              : "Task status implies posted without a provider artifact ID",
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
    const taskDraft = {
      content: task.content || "",
      mediaUrls: task.mediaUrls || [],
      mediaDescriptions: task.mediaDescriptions || [],
      mediaKinds: normalizeMediaKinds(task.mediaKinds, task.mediaUrls || []),
    };
    const draft =
      task.type === "dm"
        ? (resolveTaskDmComposerState({
            taskId: task._id,
            taskMode: mode,
            taskStatus: task.status,
            taskDraft,
          }).draft ?? null)
        : taskDraft;

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
      draft,
      originalPost:
        task.type === "comment" &&
        (sourcePostSummary || fallbackSource?.sourcePostData)
          ? {
              platform: sourcePlatform,
              postId: sourcePostId,
              context: sourceContext,
              postData: fallbackSource?.sourcePostData,
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
    tasks: v.array(outreachTaskInputValidator),
    threadId: v.optional(v.string()),
    planBatchItemId: v.optional(v.id("planBatchItems")),
  },
  handler: async (ctx, args) => {
    const input: OutreachPlanInput = {
      prospectId: args.prospectId,
      workspaceId: args.workspaceId,
      userId: args.userId,
      strategy: args.strategy,
      tasks: args.tasks,
      threadId: args.threadId,
      planBatchItemId: args.planBatchItemId,
    };

    const planId = await createOutreachPlan(ctx, input);
    const plan = await ctx.db.get("outreachPlans", planId);
    if (plan?.status === "approved" && args.threadId) {
      await startOutreachPlanExecution(ctx, planId, {
        approvalSource: "autonomy",
      });
    }
    return planId;
  },
});

export const attachPlanThreadInternal = internalMutation({
  args: {
    planId: v.id("outreachPlans"),
    threadId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { planId, threadId }) => {
    const plan = await ctx.db.get(planId);
    if (!plan) {
      throw new Error("Plan not found");
    }
    if (plan.threadId && plan.threadId !== threadId) {
      throw new Error("Plan is already attached to a different thread");
    }
    if (!plan.threadId) {
      await ctx.db.patch(planId, {
        threadId,
        updatedAt: getCurrentUTCTimestamp(),
      });
    }
    if (plan.status === "approved") {
      await startOutreachPlanExecution(ctx, planId, {
        approvalSource: "autonomy",
      });
    }
    return null;
  },
});

/**
 * Refine an existing plan (internal, called by agent).
 */
export const updatePlan = internalMutation({
  args: {
    planId: v.id("outreachPlans"),
    strategy: v.optional(outreachStrategyValidator),
    tasks: v.optional(v.array(outreachTaskInputValidator)),
    removeTaskIds: v.optional(v.array(v.id("outreachTasks"))),
    threadId: v.optional(v.string()),
    planBatchItemId: v.optional(v.id("planBatchItems")),
  },
  handler: async (ctx, args) => {
    await refinePlanCore(ctx, args.planId, {
      strategy: args.strategy,
      tasks: args.tasks as OutreachTaskInput[] | undefined,
      removeTaskIds: args.removeTaskIds,
      threadId: args.threadId,
      planBatchItemId: args.planBatchItemId,
    });
  },
});

/**
 * Approve a plan for execution (internal, called by agent).
 */
export const approvePlanMutation = internalMutation({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    await startOutreachPlanExecution(ctx, planId, {
      approvalSource: "manual",
    });
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
    await requireOwnedPlan(ctx, planId, {
      user,
      notFoundMessage: "Plan not found",
      notAuthorizedMessage: "Not authorized to approve this plan",
    });

    await startOutreachPlanExecution(ctx, planId, {
      approvalSource: "manual",
    });
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
    const waitingManualTask = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_status", (q) =>
        q.eq("planId", planId).eq("status", "waiting_manual")
      )
      .first();
    if (waitingManualTask) {
      throw new Error(
        "This plan is waiting for a manual X reply that ReacherX is monitoring automatically"
      );
    }
    const waitingConnectionTask = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_status", (q) =>
        q.eq("planId", planId).eq("status", "waiting_connection")
      )
      .first();
    if (waitingConnectionTask) {
      throw new Error(
        "This plan is waiting for a LinkedIn connection; ReacherX will resume it automatically"
      );
    }

    const prospectResume = await ctx.db.get(plan.prospectId);
    if (!prospectResume) {
      throw new Error("Prospect not found");
    }
    requireProspectEligibleForOutreach(prospectResume);

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
    requireProspectEligibleForOutreach(prospectPause);

    await ctx.db.patch(planId, {
      status: "paused",
      updatedAt: getCurrentUTCTimestamp(),
    });
  },
});

async function cancelOwnedPlan(
  ctx: MutationCtx,
  planId: Id<"outreachPlans">
): Promise<void> {
  const user = await requireViewerUser(ctx);
  const plan = await requireOwnedPlan(ctx, planId, {
    user,
    notFoundMessage: "Plan not found",
    notAuthorizedMessage: "Not authorized to cancel this plan",
  });

  if (
    plan.status !== "draft" &&
    plan.status !== "approved" &&
    plan.status !== "executing" &&
    plan.status !== "paused" &&
    plan.status !== "blocked_auth"
  ) {
    throw new Error(
      "Can only cancel draft, approved, executing, paused, or blocked plans"
    );
  }

  await ctx.db.patch(planId, {
    status: "abandoned",
    updatedAt: getCurrentUTCTimestamp(),
  });
  await stopActiveOutreachRecoveryMonitorsForPlan(ctx, planId);
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
}

/**
 * Abandon a plan (public).
 */
export const abandonPlan = mutation({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    await cancelOwnedPlan(ctx, planId);
  },
});

/**
 * Cancel a plan (public alias for product copy).
 */
export const cancelPlan = mutation({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    await cancelOwnedPlan(ctx, planId);
  },
});

/**
 * Permanently delete a plan and its dependent UI/runtime records.
 */
export const deletePlan = mutation({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    const user = await requireViewerUser(ctx);
    const plan = await requireOwnedPlan(ctx, planId, {
      user,
      notFoundMessage: "Plan not found",
      notAuthorizedMessage: "Not authorized to delete this plan",
    });

    await deleteOutreachPlanCascade(ctx, plan);
    return { success: true };
  },
});

/**
 * Plan lifecycle control for the △ Agent (internal, no viewer auth).
 * Mirrors the public pause/resume/cancel guards. The caller (agent tool)
 * is responsible for resolving the plan from thread context.
 */
export const setPlanLifecycleInternal = internalMutation({
  args: {
    planId: v.id("outreachPlans"),
    action: v.union(
      v.literal("pause"),
      v.literal("resume"),
      v.literal("cancel")
    ),
  },
  handler: async (
    ctx,
    { planId, action }
  ): Promise<{ status: Doc<"outreachPlans">["status"] }> => {
    const plan = await ctx.db.get(planId);
    if (!plan) {
      throw new Error("Plan not found");
    }

    if (action === "pause") {
      if (plan.status !== "executing") {
        throw new Error("Can only pause executing plans");
      }
      await ctx.db.patch(planId, {
        status: "paused",
        updatedAt: getCurrentUTCTimestamp(),
      });
      return { status: "paused" };
    }

    if (action === "resume") {
      if (plan.status !== "paused" && plan.status !== "blocked_auth") {
        throw new Error("Can only resume paused or blocked plans");
      }
      const waitingManualTask = await ctx.db
        .query("outreachTasks")
        .withIndex("by_plan_status", (q) =>
          q.eq("planId", planId).eq("status", "waiting_manual")
        )
        .first();
      if (waitingManualTask) {
        throw new Error(
          "This plan is waiting for a manual X reply that ReacherX is monitoring automatically"
        );
      }
      const waitingConnectionTask = await ctx.db
        .query("outreachTasks")
        .withIndex("by_plan_status", (q) =>
          q.eq("planId", planId).eq("status", "waiting_connection")
        )
        .first();
      if (waitingConnectionTask) {
        throw new Error(
          "This plan is waiting for a LinkedIn connection; ReacherX will resume it automatically"
        );
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
      return { status: "approved" };
    }

    // Cancel
    if (
      plan.status !== "draft" &&
      plan.status !== "approved" &&
      plan.status !== "executing" &&
      plan.status !== "paused" &&
      plan.status !== "blocked_auth"
    ) {
      throw new Error(
        "Can only cancel draft, approved, executing, paused, or blocked plans"
      );
    }
    await ctx.db.patch(planId, {
      status: "abandoned",
      updatedAt: getCurrentUTCTimestamp(),
    });
    await stopActiveOutreachRecoveryMonitorsForPlan(ctx, planId);
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
    return { status: "abandoned" };
  },
});

/**
 * Permanently delete a plan for the △ Agent after thread-context resolution.
 */
export const deletePlanInternal = internalMutation({
  args: {
    planId: v.id("outreachPlans"),
  },
  handler: async (ctx, { planId }) => {
    const plan = await ctx.db.get(planId);
    if (!plan) {
      throw new Error("Plan not found");
    }

    await deleteOutreachPlanCascade(ctx, plan);
    return { success: true };
  },
});

const WORKSPACE_PLAN_OVERVIEW_STATUSES = [
  "draft",
  "approved",
  "executing",
  "paused",
  "blocked_auth",
] as const;

/**
 * Workspace-wide plan overview for the main △ Agent (internal).
 * Returns active plans with prospect display info for fan-out decisions.
 */
export const listWorkspacePlansInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const plansByStatus = await Promise.all(
      WORKSPACE_PLAN_OVERVIEW_STATUSES.map((status) =>
        ctx.db
          .query("outreachPlans")
          .withIndex("by_workspace_status", (q) =>
            q.eq("workspaceId", workspaceId).eq("status", status)
          )
          .order("desc")
          .take(50)
      )
    );

    const plans = plansByStatus.flat();
    return await Promise.all(
      plans.map(async (plan) => {
        const prospect = await ctx.db.get(plan.prospectId);
        const tasks = await ctx.db
          .query("outreachTasks")
          .withIndex("by_plan", (q) => q.eq("planId", plan._id))
          .collect();
        const currentTasks = tasks.filter(
          (task) => task.supersededAt === undefined
        );
        const completedTasks = currentTasks.filter(
          (task) => task.status === "completed"
        ).length;
        return {
          planId: plan._id,
          prospectId: plan.prospectId,
          prospectName: getProspectDisplayLabel(prospect),
          prospectPlatform: prospect?.platform ?? "twitter",
          prospectStatus: prospect?.status ?? "unknown",
          planStatus: plan.status,
          version: plan.version,
          rationale: plan.strategy.rationale,
          taskCount: currentTasks.length,
          completedTasks,
          updatedAt: plan.updatedAt,
        };
      })
    );
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

    return {
      plan,
      tasks: tasks.filter((task) => task.supersededAt === undefined),
    };
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
      .order("desc")
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
      .order("desc")
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
      .order("desc")
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

    return {
      plan,
      tasks: tasks.filter((task) => task.supersededAt === undefined),
    };
  },
});

export const getProspectActivityLogInternal = internalQuery({
  args: {
    prospectId: v.id("prospects"),
    limit: v.number(),
  },
  handler: async (ctx, { prospectId, limit }) => {
    const boundedLimit = Math.min(50, Math.max(1, Math.floor(limit)));
    return await getProspectActivityLog(ctx, prospectId, {
      limit: boundedLimit,
    });
  },
});

/**
 * Update plan status (internal, for workflow).
 */
export const updatePlanStatus = internalMutation({
  args: {
    planId: v.id("outreachPlans"),
    status: outreachPlanStatusValidator,
    expectedExecutionGeneration: v.optional(v.number()),
  },
  handler: async (ctx, { planId, status, expectedExecutionGeneration }) => {
    const plan = await ctx.db.get(planId);
    if (!plan) {
      throw new Error("Plan not found");
    }
    if (
      expectedExecutionGeneration !== undefined &&
      (plan.executionGeneration ?? 0) !== expectedExecutionGeneration
    ) {
      return false;
    }
    await ctx.db.patch(planId, {
      status,
      updatedAt: getCurrentUTCTimestamp(),
    });
    await syncPlanCompletedNotification(ctx, { ...plan, status }, status);
    return true;
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

export const createTaskExecutionFailureNotification = internalMutation({
  args: {
    taskId: v.id("outreachTasks"),
    attemptId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      return null;
    }

    const plan = await ctx.db.get(task.planId);
    if (!plan) {
      return null;
    }

    const prospect = await ctx.db.get(plan.prospectId);
    const display = getProspectDisplayFields(prospect);
    const platform = getRecordedPlatform(task, prospect);
    const title =
      task.type === "react"
        ? `${platform === "linkedin" ? "LinkedIn reaction" : "X like"} failed`
        : platform === "linkedin"
          ? task.type === "dm"
            ? "LinkedIn message failed"
            : "LinkedIn comment failed"
          : task.type === "dm"
            ? "DM failed on X/Twitter"
            : "Reply failed on X/Twitter";

    return await upsertNotificationByKey(ctx, {
      userId: plan.userId,
      workspaceId: plan.workspaceId,
      type: "error",
      notificationKey: `outreach-task-failed:${args.taskId}:${args.attemptId}`,
      title,
      message: args.message,
      prospectId: plan.prospectId,
      planId: plan._id,
      taskId: task._id,
      threadId: plan.threadId,
      contextPlatform: platform,
      ...display,
    });
  },
});

export const createPlanMediaCapabilityNotification = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    prospectId: v.id("prospects"),
    threadId: v.optional(v.string()),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const prospect = await ctx.db.get(args.prospectId);
    if (
      !prospect ||
      prospect.userId !== args.userId ||
      prospect.workspaceId !== args.workspaceId
    ) {
      return null;
    }
    const platform = prospect.platform === "linkedin" ? "linkedin" : "twitter";
    return await createNotification(ctx, {
      userId: args.userId,
      workspaceId: args.workspaceId,
      type: "error",
      title: `Attachment not supported on ${platform === "linkedin" ? "LinkedIn" : "X/Twitter"}`,
      message: args.message,
      notificationKey: `plan-media-capability:${args.prospectId}:${getCurrentUTCTimestamp()}`,
      prospectId: args.prospectId,
      threadId: args.threadId,
      contextPlatform: platform,
      ...getProspectDisplayFields(prospect),
    });
  },
});

export const createExistingPlanMediaCapabilityNotification = internalMutation({
  args: {
    planId: v.id("outreachPlans"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.planId);
    if (!plan) return null;
    const prospect = await ctx.db.get(plan.prospectId);
    if (!prospect) return null;
    const platform = prospect.platform === "linkedin" ? "linkedin" : "twitter";
    return await createNotification(ctx, {
      userId: plan.userId,
      workspaceId: plan.workspaceId,
      type: "error",
      title: `Attachment not supported on ${platform === "linkedin" ? "LinkedIn" : "X/Twitter"}`,
      message: args.message,
      notificationKey: `plan-media-capability:${args.planId}:${getCurrentUTCTimestamp()}`,
      prospectId: plan.prospectId,
      planId: plan._id,
      threadId: plan.threadId,
      contextPlatform: platform,
      ...getProspectDisplayFields(prospect),
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

/** Revalidate attachment ownership and current platform rules before sending. */
export const validateTaskMediaForExecution = internalQuery({
  args: { taskId: v.id("outreachTasks") },
  returns: v.object({
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    mediaUrls: v.array(v.string()),
  }),
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (task.type !== "comment" && task.type !== "dm") {
      throw new Error("Only comment and DM tasks can contain attachments");
    }

    const plan = await ctx.db.get(task.planId);
    if (!plan) throw new Error("Plan not found");
    const prospect = await ctx.db.get(plan.prospectId);
    if (
      !prospect ||
      prospect.userId !== plan.userId ||
      prospect.workspaceId !== plan.workspaceId
    ) {
      throw new Error("Prospect not found for this plan");
    }

    const platform = getRecordedPlatform(task, prospect);
    const media = await resolveOwnedOutreachMedia(ctx, {
      userId: plan.userId,
      workspaceId: plan.workspaceId,
      mediaUrls: toStringArray(task.mediaUrls),
      mediaUploadIds: task.mediaUploadIds,
    });
    assertOutreachMediaCapability({
      platform,
      surface: task.type,
      media,
    });

    return {
      platform,
      mediaUrls: media.map((attachment) => attachment.url),
    };
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
    const requiresPostedArtifact = !hasRequiredPostedOutreachArtifact(
      task,
      args.resultData
    );
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
      args.status === "completed" ||
      args.status === "failed" ||
      args.status === "skipped"
    ) {
      await stopActiveOutreachRecoveryMonitorsForTask(ctx, args.taskId);
    }

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
        actionLabel: "Reconnect",
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
  ctx: MutationCtx,
  args: {
    prospectId: Id<"prospects">;
    planId?: Id<"outreachPlans">;
    responseText?: string;
    responseData?: unknown;
    responseChannel:
      | "twitter_reply"
      | "twitter_dm"
      | "linkedin_dm"
      | "linkedin_comment"
      | "linkedin_invite";
    responseMessageId: string;
    conversationId?: string;
    recordArtifacts?: boolean;
  }
) {
  const now = getCurrentUTCTimestamp();
  const prospect = await ctx.db.get(args.prospectId);
  if (!prospect) {
    outreachLogger.warn("Received prospect response for missing prospect", {
      prospectId: String(args.prospectId),
    });
    return { success: false, error: "Prospect not found" };
  }

  const eventKey = [
    "outreach_interaction",
    String(args.prospectId),
    args.responseChannel,
    args.responseMessageId,
  ].join(":");
  const duplicateEvent = await ctx.db
    .query("outreachInteractionEvents")
    .withIndex("by_event_key", (q) => q.eq("eventKey", eventKey))
    .unique();
  if (duplicateEvent) {
    return {
      success: true,
      duplicate: true,
      eventId: duplicateEvent._id,
    };
  }

  let plan = null;
  if (args.planId) {
    plan = await ctx.db.get(args.planId);
  }

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
    plan = await ctx.db
      .query("outreachPlans")
      .withIndex("by_prospect", (q) => q.eq("prospectId", args.prospectId))
      .order("desc")
      .first();
  }

  if (!plan) {
    const eventId = await ctx.db.insert("outreachInteractionEvents", {
      eventKey,
      prospectId: args.prospectId,
      workspaceId: prospect.workspaceId,
      userId: prospect.userId,
      channel: args.responseChannel,
      responseMessageId: args.responseMessageId,
      responseText: args.responseText,
      conversationId: args.conversationId,
      status: "ignored",
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
      completedAt: now,
    });

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
          : `Reply from ${prospectDisplayName || entitySingular}`,
      message: args.responseText
        ? `"${args.responseText.substring(0, 100)}${args.responseText.length > 100 ? "..." : ""}"`
        : args.responseChannel === "linkedin_invite"
          ? `The ${entitySingularLower} accepted your LinkedIn invitation.`
          : args.responseChannel === "twitter_reply"
            ? "A new reply came in on X."
            : args.responseChannel === "linkedin_comment"
              ? "A new reply came in under your LinkedIn comment."
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
          : args.responseChannel === "linkedin_comment"
            ? "LinkedIn comment response received"
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
        responseCommentId:
          args.responseChannel === "linkedin_comment"
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

    return { success: true, planless: true, eventId };
  }

  const currentPlanTasks = await ctx.db
    .query("outreachTasks")
    .withIndex("by_plan_order", (q) => q.eq("planId", plan._id))
    .collect();
  await ensureCurrentOutreachPlanRevision(ctx, plan, currentPlanTasks);

  const waitingTasks = await ctx.db
    .query("outreachTasks")
    .withIndex("by_plan_status", (q) =>
      q.eq("planId", plan._id).eq("status", "waiting_response")
    )
    .take(20);
  const waitingTask = waitingTasks.find((task: Doc<"outreachTasks">) => {
    const platform = task.approvalContext?.platform ?? "twitter";
    if (args.responseChannel === "twitter_reply") {
      return task.type === "comment" && platform === "twitter";
    }
    if (args.responseChannel === "linkedin_comment") {
      return task.type === "comment" && platform === "linkedin";
    }
    if (args.responseChannel === "twitter_dm") {
      return task.type === "dm" && platform === "twitter";
    }
    if (args.responseChannel === "linkedin_dm") {
      return task.type === "dm" && platform === "linkedin";
    }
    return false;
  });

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
          args.responseChannel === "twitter_dm" ||
          args.responseChannel === "linkedin_dm"
            ? args.responseMessageId
            : undefined,
        responseCommentId:
          args.responseChannel === "linkedin_comment"
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

  const shouldAdaptPlan = args.responseChannel !== "linkedin_invite";
  const nextExecutionGeneration = (plan.executionGeneration ?? 0) + 1;
  const eventId = await ctx.db.insert("outreachInteractionEvents", {
    eventKey,
    prospectId: args.prospectId,
    workspaceId: plan.workspaceId,
    userId: plan.userId,
    planId: plan._id,
    taskId: waitingTask?._id,
    basePlanVersion: plan.version,
    executionGeneration: shouldAdaptPlan
      ? nextExecutionGeneration
      : plan.executionGeneration,
    channel: args.responseChannel,
    responseMessageId: args.responseMessageId,
    responseText: args.responseText,
    conversationId: args.conversationId,
    status: shouldAdaptPlan ? "pending" : "ignored",
    attemptCount: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: shouldAdaptPlan ? undefined : now,
  });

  if (shouldAdaptPlan) {
    if (plan.workflowId) {
      try {
        const workflowId = plan.workflowId as WorkflowId;
        const workflowStatus = await workflowManager.status(ctx, workflowId);
        if (workflowStatus.type === "inProgress") {
          await workflowManager.cancel(ctx, workflowId);
        }
      } catch (error) {
        outreachLogger.warn(
          "Failed to cancel superseded outreach workflow",
          {
            planId: String(plan._id),
            workflowId: plan.workflowId,
          },
          error
        );
      }
    }
    const recoveryMonitors = await ctx.db
      .query("outreachRecoveryMonitors")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .collect();
    for (const monitor of recoveryMonitors) {
      if (monitor.status === "active") {
        await ctx.db.patch(monitor._id, {
          status: "completed",
          completedAt: now,
          lastCheckedAt: now,
          nextCheckAt: undefined,
          lastErrorMessage: undefined,
        });
      }
    }
    const prospectMonitors = await ctx.db
      .query("prospectMonitors")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .collect();
    for (const monitor of prospectMonitors) {
      if (monitor.status !== "deleted") {
        await ctx.scheduler.runAfter(
          0,
          internal.prospectMonitors.deleteProspectMonitor,
          { monitorId: monitor.monitorId }
        );
      }
      await ctx.db.delete(monitor._id);
    }
    await ctx.db.patch(plan._id, {
      status: "paused",
      workflowId: undefined,
      executionGeneration: nextExecutionGeneration,
      updatedAt: now,
    });
    const adaptiveWorkflowId = await workflowManager.start(
      ctx,
      internal.workflows.adaptiveOutreach.adaptiveOutreachWorkflow,
      { eventId },
      {
        onComplete:
          internal.workflows.adaptiveOutreach
            .handleAdaptiveOutreachWorkflowComplete,
        context: { eventId },
      }
    );
    await ctx.db.patch(eventId, {
      workflowId: adaptiveWorkflowId.toString(),
      updatedAt: now,
    });
  }

  const prospectAvatarUrl = extractAvatarUrl(prospect.data);
  const prospectDisplayName =
    prospect.displayName || extractDisplayName(prospect.data);
  const prospectType = prospect.prospectType;
  const prospectScreenName = extractScreenName(prospect);

  await ctx.db.patch(args.prospectId, {
    status: "in_progress",
    pipelineStage: "in_progress",
    stageTimestamps: {
      ...prospect.stageTimestamps,
      in_progress: now,
    },
    updatedAt: now,
  });

  const workspace = await ctx.db.get(plan.workspaceId);
  const useCase = getWorkspaceUseCase(workspace?.useCaseKey);
  const entitySingular = useCase.entitySingular;
  const entitySingularLower = entitySingular.toLowerCase();
  const title =
    args.responseChannel === "linkedin_invite"
      ? `${prospectDisplayName || entitySingular} accepted your invitation`
      : `Reply from ${prospectDisplayName || entitySingular}`;

  if (args.recordArtifacts !== false) {
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
      prospectPlatform: prospect.platform,
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
          : args.responseChannel === "linkedin_comment"
            ? "LinkedIn comment response received"
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
        responseCommentId:
          args.responseChannel === "linkedin_comment"
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
  }

  return { success: true, eventId, adaptiveReplanScheduled: shouldAdaptPlan };
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
    responseType: v.union(
      v.literal("dm"),
      v.literal("invite"),
      v.literal("comment")
    ),
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
        args.responseType === "invite"
          ? "linkedin_invite"
          : args.responseType === "comment"
            ? "linkedin_comment"
            : "linkedin_dm",
      responseMessageId: args.responseMessageId,
      conversationId: args.conversationId,
    });
  },
});

/**
 * Replays a previously recorded LinkedIn comment response through adaptive
 * planning without duplicating user-facing reply artifacts.
 */
export const replayHistoricalLinkedInCommentResponse = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    planId: v.id("outreachPlans"),
    responseCommentId: v.string(),
    responseText: v.string(),
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const [prospect, plan] = await Promise.all([
      ctx.db.get(args.prospectId),
      ctx.db.get(args.planId),
    ]);
    if (!prospect || !plan || plan.prospectId !== args.prospectId) {
      throw new Error(
        "Historical replay target does not match an outreach plan"
      );
    }
    if (plan.status !== "paused") {
      throw new Error("Historical replay requires a paused outreach plan");
    }

    const workspace = await ctx.db.get(plan.workspaceId);
    if (!workspace) {
      throw new Error("Historical replay workspace not found");
    }
    const settings = await getResolvedWorkspaceAgentSettings(ctx, workspace);
    if (settings.autonomyMode !== "review_required") {
      throw new Error(
        "Historical replay requires approval-required workspace settings"
      );
    }

    const recordedResponses = await ctx.db
      .query("prospectActivityLog")
      .withIndex("by_prospect_type", (q) =>
        q.eq("prospectId", args.prospectId).eq("type", "responded")
      )
      .order("desc")
      .take(100);
    const recordedResponse = recordedResponses.find(
      (activity) =>
        activity.metadata?.responseCommentId === args.responseCommentId &&
        activity.metadata.conversationId === args.conversationId
    );
    if (!recordedResponse) {
      throw new Error("Matching historical LinkedIn response was not recorded");
    }

    return await handleProspectResponseCore(ctx, {
      prospectId: args.prospectId,
      planId: args.planId,
      responseText: args.responseText,
      responseChannel: "linkedin_comment",
      responseMessageId: args.responseCommentId,
      conversationId: args.conversationId,
      recordArtifacts: false,
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
    expectedExecutionGeneration: v.number(),
  },
  handler: async (ctx, { planId, workflowId, expectedExecutionGeneration }) => {
    const plan = await ctx.db.get(planId);
    if (
      !plan ||
      (plan.executionGeneration ?? 0) !== expectedExecutionGeneration
    ) {
      return false;
    }
    await ctx.db.patch(planId, {
      workflowId,
      // Don't change status here - the workflow handler checks for "approved"
      // and sets to "executing" after the check passes
      updatedAt: getCurrentUTCTimestamp(),
    });
    return true;
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
      }
    }

    const workspace = await ctx.db.get(args.workspaceId);
    const useCase = getWorkspaceUseCase(workspace?.useCaseKey);
    const name =
      args.prospectDisplayName || useCase.entitySingular.toLowerCase();

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    const taskPlatform = args.platform ?? "twitter";
    const title =
      task.type === "dm"
        ? `Approve the ${taskPlatform === "linkedin" ? "LinkedIn message" : "DM"} to ${name}`
        : task.type === "react"
          ? `Approve the ${taskPlatform === "linkedin" ? "LinkedIn reaction" : "X like"} for ${name}`
          : `Approve the ${taskPlatform === "linkedin" ? "LinkedIn comment" : "reply"} to ${name}`;

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
      message:
        task.type === "react"
          ? task.description
          : args.content.trim()
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
    const validation = await validateTaskDraft(ctx, {
      task,
      prospect,
      userId: plan.userId,
      workspaceId: plan.workspaceId,
      content: trimmedContent,
      mediaUrls,
    });
    if (validation.error) {
      throw new Error(validation.error);
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
    const mediaKinds = validation.media.map((media) => media.kind);

    await ctx.db.patch(args.taskId, {
      description: withAttachmentNames(task.description, validation.media),
      content: trimmedContent,
      originalDraftContent: originalDraft,
      mediaUrls: validation.media.map((media) => media.url),
      mediaUploadIds: validation.media.map((media) => media.uploadId),
      mediaDescriptions: args.mediaDescriptions,
      mediaKinds,
      approvedAt: getCurrentUTCTimestamp(),
      approvalContext: args.approvalContext
        ? {
            ...task.approvalContext,
            ...args.approvalContext,
            platform: validation.platform,
          }
        : {
            ...task.approvalContext,
            platform: validation.platform,
          },
    });

    await recordEditableTaskApprovalMemory(ctx, {
      task,
      plan,
      content: trimmedContent,
      originalDraft,
      platform: validation.platform,
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

export const completeBrowserEncryptedDmTaskInternal = internalMutation({
  args: {
    userId: v.id("users"),
    taskId: v.id("outreachTasks"),
    clientRequestId: v.string(),
    conversationId: v.string(),
    messageId: v.string(),
  },
  returns: v.object({ success: v.literal(true), duplicate: v.boolean() }),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const plan = await ctx.db.get(task.planId);
    if (!plan || plan.userId !== args.userId) {
      throw new Error("Not authorized to complete this task");
    }
    if (task.type !== "dm") {
      throw new Error("Only DM tasks can use encrypted XChat completion");
    }

    const result = await completeBrowserEncryptedDmTaskCore(ctx, {
      userId: args.userId,
      taskId: task._id,
      clientRequestId: args.clientRequestId,
      conversationId: args.conversationId,
      messageId: args.messageId,
    });
    if (!result.duplicate) {
      await recordEditableTaskApprovalMemory(ctx, {
        task,
        plan,
        content: task.content ?? "",
        originalDraft: task.originalDraftContent,
        platform: "twitter",
      });
    }
    return { success: true as const, duplicate: result.duplicate };
  },
});

export const updatePendingTaskDraft = mutation({
  args: {
    taskId: v.id("outreachTasks"),
    expectedType: outreachEditableTaskTypeValidator,
    content: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    mediaDescriptions: v.optional(v.array(v.string())),
    mediaKinds: v.optional(v.array(twitterMediaKindValidator)),
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
    const hasMediaSnapshot =
      args.mediaUrls !== undefined ||
      args.mediaDescriptions !== undefined ||
      args.mediaKinds !== undefined;
    const currentMediaUrls =
      task.mediaUrls?.filter(
        (mediaUrl): mediaUrl is string =>
          typeof mediaUrl === "string" && mediaUrl.trim().length > 0
      ) ?? [];
    const mediaUrls = hasMediaSnapshot
      ? (args.mediaUrls?.filter(
          (mediaUrl): mediaUrl is string =>
            typeof mediaUrl === "string" && mediaUrl.trim().length > 0
        ) ?? [])
      : currentMediaUrls;

    if (
      args.mediaDescriptions &&
      args.mediaDescriptions.length > mediaUrls.length
    ) {
      throw new Error("mediaDescriptions cannot exceed mediaUrls length");
    }
    if (args.mediaKinds && args.mediaKinds.length > mediaUrls.length) {
      throw new Error("mediaKinds cannot exceed mediaUrls length");
    }

    const prospect = await ctx.db.get(plan.prospectId);
    const validation = await validateTaskDraft(ctx, {
      task,
      prospect,
      userId: plan.userId,
      workspaceId: plan.workspaceId,
      content: trimmedContent,
      mediaUrls,
      mediaUploadIds: hasMediaSnapshot ? undefined : task.mediaUploadIds,
    });
    if (validation.error) {
      throw new Error(validation.error);
    }

    await ctx.db.patch(args.taskId, {
      description: withAttachmentNames(task.description, validation.media),
      content: trimmedContent,
      originalDraftContent: task.originalDraftContent ?? task.content,
      mediaUrls: validation.media.map((media) => media.url),
      mediaUploadIds: validation.media.map((media) => media.uploadId),
      mediaKinds: validation.media.map((media) => media.kind),
      approvalContext: {
        ...task.approvalContext,
        platform: validation.platform,
      },
      ...(hasMediaSnapshot
        ? {
            mediaDescriptions: args.mediaDescriptions,
          }
        : {}),
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
    expectedType: v.optional(outreachApprovableTaskTypeValidator),
  },
  handler: async (ctx, { taskId, expectedType }) => {
    const user = await requireViewerUser(ctx);
    const { task, plan } = await requireOwnedTask(ctx, taskId, {
      user,
      notFoundMessage: "Task not found",
      notAuthorizedMessage: "Not authorized to approve this task",
    });
    if (
      task.type !== "comment" &&
      task.type !== "dm" &&
      task.type !== "react"
    ) {
      throw new Error("Only comment, DM, and reaction tasks can be approved");
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
      return;
    }

    const prospectApprove = await ctx.db.get(plan.prospectId);
    if (!prospectApprove) {
      throw new Error("Prospect not found");
    }
    requireProspectEligibleForOutreach(prospectApprove);

    const mediaUrls =
      task.mediaUrls?.filter(
        (mediaUrl): mediaUrl is string =>
          typeof mediaUrl === "string" && mediaUrl.trim().length > 0
      ) ?? [];
    const validation = await validateTaskDraft(ctx, {
      task,
      prospect: prospectApprove,
      userId: plan.userId,
      workspaceId: plan.workspaceId,
      content: task.content?.trim() ?? "",
      mediaUrls,
      mediaUploadIds: task.mediaUploadIds,
    });
    if (validation.error) {
      throw new Error(validation.error);
    }

    await ctx.db.patch(taskId, {
      description: withAttachmentNames(task.description, validation.media),
      mediaUrls: validation.media.map((media) => media.url),
      mediaUploadIds: validation.media.map((media) => media.uploadId),
      mediaKinds: validation.media.map((media) => media.kind),
      approvalContext: {
        ...task.approvalContext,
        platform: validation.platform,
      },
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
      return;
    }

    const prospectInternalApprove = await ctx.db.get(plan.prospectId);
    if (!prospectInternalApprove) {
      throw new Error("Prospect not found");
    }
    requireProspectEligibleForOutreach(prospectInternalApprove);

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
  },
});
