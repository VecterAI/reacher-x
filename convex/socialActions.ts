import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./lib/functionBuilders";
import { internal } from "./_generated/api";
import { requireUser } from "./lib/accessHelpers";
import { createNotification } from "./lib/outreachCore";
import {
  buildNotificationTargetHref,
  dismissNotificationsForActionRequest,
  getProspectDisplayFields,
} from "./lib/notificationHelpers";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  getDmTextLimitError,
  getPostTextLimitError,
  hasPostBody,
} from "../shared/lib/twitter/xPostTextLimit";
import { getEffectivePostTextLimitForUser } from "./lib/xPostLimits";
import { recordMemoryWorkflowEvent } from "./lib/memoryCore";
import {
  twitterActionArgumentsSnapshotValidator,
  twitterActionErrorSummaryValidator,
  twitterActionResultSummaryValidator,
  twitterActionProviderValidator,
  twitterPostRefValidator,
  twitterPostSummaryValidator,
} from "./validators";
import {
  getTwitterActionCatalogEntry,
  isLinkedInActionKey,
  isSocialDmActionKey,
} from "./lib/twitterActionCatalog";

const LINKEDIN_DM_TEXT_MAX = 8000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function createActionRequestNotification(
  ctx: any,
  args: {
    requestId: Id<"agentActionRequests">;
    userId: Id<"users">;
    workspaceId?: Id<"workspaces">;
    prospectId?: Id<"prospects">;
    threadId?: string;
    title: string;
    message: string;
    type:
      | "social_action_request"
      | "social_action_completed"
      | "social_action_failed";
  }
) {
  if (!args.workspaceId) {
    return;
  }

  const prospect = args.prospectId ? await ctx.db.get(args.prospectId) : null;
  const display = getProspectDisplayFields(prospect);

  if (
    args.type === "social_action_completed" ||
    args.type === "social_action_failed"
  ) {
    await dismissNotificationsForActionRequest(ctx, {
      userId: args.userId,
      actionRequestId: args.requestId,
    });
  }

  await createNotification(ctx, {
    userId: args.userId,
    workspaceId: args.workspaceId,
    type: args.type,
    title: args.title,
    message: args.message,
    targetHref: buildNotificationTargetHref({
      prospectId: args.prospectId,
      threadId: args.threadId,
      actionRequestId: args.requestId,
    }),
    contextPlatform: display.prospectPlatform,
    prospectId: args.prospectId,
    threadId: args.threadId,
    actionRequestId: args.requestId,
    ...display,
  });
}

function isPendingDmActionKey(actionKey: string | undefined): boolean {
  return typeof actionKey === "string" && isSocialDmActionKey(actionKey);
}

function isLinkedInCommentActionKey(actionKey: string | undefined): boolean {
  return actionKey === "linkedin_comment_on_post";
}

function isLinkedInInviteActionKey(actionKey: string | undefined): boolean {
  return actionKey === "linkedin_invite_user";
}

function getLinkedInDmTextLimitError(text: string): string | null {
  const len = text.length;
  if (len <= LINKEDIN_DM_TEXT_MAX) {
    return null;
  }
  return `LinkedIn DM text exceeds limit (${len} characters, max ${LINKEDIN_DM_TEXT_MAX}).`;
}

async function getActionDraftValidationError(
  ctx: any,
  args: {
    userId: Id<"users">;
    actionKey: string;
    text: string;
    mediaUrls: string[];
  }
) {
  if (args.actionKey === "reply_to_post" || args.actionKey === "create_post") {
    if (!hasPostBody(args.text, args.mediaUrls)) {
      return "Post text or media is required";
    }
    return getPostTextLimitError(
      args.text,
      await getEffectivePostTextLimitForUser(ctx, args.userId)
    );
  }

  if (isPendingDmActionKey(args.actionKey)) {
    if (!args.text && args.mediaUrls.length === 0) {
      return "DM content is required";
    }
    if (!args.text) {
      return null;
    }
    return isLinkedInActionKey(args.actionKey)
      ? getLinkedInDmTextLimitError(args.text)
      : getDmTextLimitError(args.text);
  }

  if (isLinkedInCommentActionKey(args.actionKey)) {
    return args.text ? null : "Comment text is required";
  }

  if (isLinkedInInviteActionKey(args.actionKey)) {
    return args.text ? null : null;
  }

  return null;
}

function buildPendingActionRequestMessage(args: {
  actionKey: string;
  draftContent?: string;
  mediaUrls?: string[];
  fallback?: string;
}) {
  const trimmedDraft = args.draftContent?.trim();
  if (trimmedDraft) {
    return trimmedDraft;
  }

  if (
    isPendingDmActionKey(args.actionKey) &&
    (args.mediaUrls?.length ?? 0) > 0
  ) {
    return "Approval required for DM with media.";
  }

  return args.fallback ?? "Approval required before posting.";
}

function normalizeMediaUrls(mediaUrls?: unknown): string[] {
  return Array.isArray(mediaUrls)
    ? mediaUrls.filter(
        (value: unknown): value is string =>
          typeof value === "string" && value.trim().length > 0
      )
    : [];
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

async function updatePendingNotificationForActionRequest(
  ctx: any,
  args: {
    actionRequestId: Id<"agentActionRequests">;
    userId: Id<"users">;
    title?: string;
    message?: string;
  }
) {
  const pendingNotifications = await ctx.db
    .query("outreachNotifications")
    .withIndex("by_user_status", (q: any) =>
      q.eq("userId", args.userId).eq("status", "pending")
    )
    .filter((q: any) => q.eq(q.field("actionRequestId"), args.actionRequestId))
    .collect();

  await Promise.all(
    pendingNotifications.map((notification: any) =>
      ctx.db.patch(notification._id, {
        ...(typeof args.title === "string" ? { title: args.title } : {}),
        ...(typeof args.message === "string" ? { message: args.message } : {}),
      })
    )
  );
}

export const createActionRequestInternal = internalMutation({
  args: {
    userId: v.id("users"),
    threadId: v.optional(v.string()),
    prospectId: v.optional(v.id("prospects")),
    workspaceId: v.optional(v.id("workspaces")),
    provider: twitterActionProviderValidator,
    actionKey: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    toolSlug: v.string(),
    toolVersion: v.string(),
    riskLevel: v.string(),
    approvalMode: v.string(),
    uiArtifactType: v.string(),
    entityType: v.string(),
    requiresConnectedAccount: v.boolean(),
    status: v.string(),
    argumentsSnapshot: twitterActionArgumentsSnapshotValidator,
    sourcePostRef: v.optional(twitterPostRefValidator),
    sourcePostSummary: v.optional(twitterPostSummaryValidator),
    sourcePostData: v.optional(v.any()),
    sourcePostId: v.optional(v.string()),
    draftContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("agentActionRequests", {
      ...args,
    } as any);
  },
});

export const getPendingActionRequestForThread = internalQuery({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    return await ctx.db
      .query("agentActionRequests")
      .withIndex("by_thread_status", (q) =>
        q.eq("threadId", threadId).eq("status", "pending_approval")
      )
      .order("desc")
      .first();
  },
});

export const getPendingDmActionRequestForScope = internalQuery({
  args: {
    threadId: v.string(),
    prospectId: v.optional(v.id("prospects")),
  },
  handler: async (ctx, { threadId, prospectId }) => {
    const pendingRequests = await ctx.db
      .query("agentActionRequests")
      .withIndex("by_thread_status", (q) =>
        q.eq("threadId", threadId).eq("status", "pending_approval")
      )
      .order("desc")
      .collect();

    return (
      pendingRequests.find((request) => {
        if (!isPendingDmActionKey(request.actionKey)) {
          return false;
        }

        if (prospectId && request.prospectId !== prospectId) {
          return false;
        }

        return true;
      }) ?? null
    );
  },
});

export const getActionRequestInternal = internalQuery({
  args: {
    actionRequestId: v.id("agentActionRequests"),
  },
  handler: async (ctx, { actionRequestId }) => {
    return ctx.db.get(actionRequestId);
  },
});

export const getActionRequestDraft = query({
  args: {
    actionRequestId: v.id("agentActionRequests"),
  },
  handler: async (ctx, { actionRequestId }) => {
    const user = await requireUser(ctx, {
      notFoundMessage: "User not found",
    });
    const request = await ctx.db.get(actionRequestId);
    if (!request || request.userId !== user._id) {
      return null;
    }

    const snapshot = isRecord(request.argumentsSnapshot)
      ? request.argumentsSnapshot
      : {};

    return {
      actionRequestId: request._id,
      actionKey: request.actionKey,
      status: request.status,
      draftText: request.draftContent ?? "",
      mediaUrls: Array.isArray(snapshot.mediaUrls)
        ? (snapshot.mediaUrls as string[])
        : [],
      mediaDescriptions: Array.isArray(snapshot.mediaDescriptions)
        ? (snapshot.mediaDescriptions as string[])
        : [],
      mediaKinds: normalizeMediaKinds(
        snapshot.mediaKinds,
        normalizeMediaUrls(snapshot.mediaUrls)
      ),
    };
  },
});

export const approveActionRequestInternal = internalMutation({
  args: {
    actionRequestId: v.id("agentActionRequests"),
  },
  handler: async (ctx, { actionRequestId }) => {
    const request = await ctx.db.get(actionRequestId);
    if (!request) {
      throw new Error("Social action request not found");
    }
    if (request.status === "completed") {
      return { success: true, duplicate: true };
    }
    if (request.status !== "pending_approval") {
      throw new Error("Social action request is no longer pending approval");
    }

    await ctx.db.patch(actionRequestId, {
      status: "approved",
      approvedAt: getCurrentUTCTimestamp(),
    });

    return { success: true, duplicate: false };
  },
});

export const markActionRequestExecutingInternal = internalMutation({
  args: {
    actionRequestId: v.id("agentActionRequests"),
  },
  handler: async (ctx, { actionRequestId }) => {
    await ctx.db.patch(actionRequestId, {
      status: "executing",
      executedAt: getCurrentUTCTimestamp(),
    });
  },
});

export const completeActionRequestInternal = internalMutation({
  args: {
    actionRequestId: v.id("agentActionRequests"),
    resultSummary: twitterActionResultSummaryValidator,
  },
  handler: async (ctx, { actionRequestId, resultSummary }) => {
    await ctx.db.patch(actionRequestId, {
      status: "completed",
      resultSummary,
      completedAt: getCurrentUTCTimestamp(),
    });
  },
});

export const failActionRequestInternal = internalMutation({
  args: {
    actionRequestId: v.id("agentActionRequests"),
    errorSummary: twitterActionErrorSummaryValidator,
  },
  handler: async (ctx, { actionRequestId, errorSummary }) => {
    await ctx.db.patch(actionRequestId, {
      status: "failed",
      errorSummary,
      completedAt: getCurrentUTCTimestamp(),
    });
  },
});

export const cancelActionRequestInternal = internalMutation({
  args: {
    actionRequestId: v.id("agentActionRequests"),
  },
  handler: async (ctx, { actionRequestId }) => {
    await ctx.db.patch(actionRequestId, {
      status: "cancelled",
      completedAt: getCurrentUTCTimestamp(),
    });
  },
});

export const createActionRequestNotificationInternal = internalMutation({
  args: {
    actionRequestId: v.id("agentActionRequests"),
    type: v.union(
      v.literal("social_action_request"),
      v.literal("social_action_completed"),
      v.literal("social_action_failed")
    ),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.actionRequestId);
    if (!request) {
      throw new Error("Social action request not found");
    }

    await createActionRequestNotification(ctx, {
      requestId: args.actionRequestId,
      userId: request.userId,
      workspaceId: request.workspaceId,
      prospectId: request.prospectId,
      threadId: request.threadId,
      title: request.title,
      message: args.message,
      type: args.type,
    });
  },
});

export const updatePendingActionRequestInternal = internalMutation({
  args: {
    actionRequestId: v.id("agentActionRequests"),
    actionKey: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    argumentsSnapshot: twitterActionArgumentsSnapshotValidator,
    sourcePostRef: v.optional(twitterPostRefValidator),
    sourcePostSummary: v.optional(twitterPostSummaryValidator),
    sourcePostData: v.optional(v.any()),
    sourcePostId: v.optional(v.string()),
    draftContent: v.optional(v.string()),
    notificationMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.actionRequestId);
    if (!request) {
      throw new Error("Social action request not found");
    }
    if (request.status !== "pending_approval") {
      throw new Error("Social action request is no longer pending approval");
    }

    await ctx.db.patch(args.actionRequestId, {
      actionKey: args.actionKey,
      title: args.title,
      description: args.description,
      argumentsSnapshot: args.argumentsSnapshot,
      sourcePostRef: args.sourcePostRef,
      sourcePostSummary: args.sourcePostSummary,
      sourcePostData: args.sourcePostData,
      sourcePostId: args.sourcePostId,
      draftContent: args.draftContent,
    });

    await updatePendingNotificationForActionRequest(ctx, {
      actionRequestId: args.actionRequestId,
      userId: request.userId,
      title: args.title,
      message: args.notificationMessage,
    });

    return { success: true };
  },
});

export const approveActionRequest = mutation({
  args: {
    actionRequestId: v.id("agentActionRequests"),
  },
  handler: async (
    ctx,
    { actionRequestId }
  ): Promise<{ success: boolean; duplicate: boolean }> => {
    const user = await requireUser(ctx, {
      notFoundMessage: "User not found",
    });
    const request = await ctx.db.get(actionRequestId);
    if (!request || request.userId !== user._id) {
      throw new Error("Social action request not found");
    }

    const approvalResult: { success: boolean; duplicate: boolean } =
      await ctx.runMutation(
        internal.socialActions.approveActionRequestInternal,
        { actionRequestId }
      );

    await ctx.scheduler.runAfter(
      0,
      internal.socialActionExecutors.executeActionRequestInternal,
      { actionRequestId }
    );

    return approvalResult;
  },
});

export const updatePendingActionRequestDraft = mutation({
  args: {
    actionRequestId: v.id("agentActionRequests"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, {
      notFoundMessage: "User not found",
    });
    const request = await ctx.db.get(args.actionRequestId);
    if (!request || request.userId !== user._id) {
      throw new Error("Social action request not found");
    }
    if (request.status !== "pending_approval") {
      throw new Error("Social action request is no longer pending approval");
    }

    const trimmedContent = args.content.trim();
    const snapshot = isRecord(request.argumentsSnapshot)
      ? request.argumentsSnapshot
      : {};
    const mediaUrls = normalizeMediaUrls(snapshot.mediaUrls);
    const limitError = await getActionDraftValidationError(ctx, {
      userId: request.userId,
      actionKey: request.actionKey,
      text: trimmedContent,
      mediaUrls,
    });
    if (limitError) {
      throw new Error(limitError);
    }

    await ctx.db.patch(args.actionRequestId, {
      draftContent: trimmedContent,
      argumentsSnapshot: {
        ...snapshot,
        text: trimmedContent,
      },
    });

    await updatePendingNotificationForActionRequest(ctx, {
      actionRequestId: args.actionRequestId,
      userId: request.userId,
      message: buildPendingActionRequestMessage({
        actionKey: request.actionKey,
        draftContent: trimmedContent,
        mediaUrls,
      }),
    });

    return { success: true };
  },
});

export const approveActionRequestWithEdits = mutation({
  args: {
    actionRequestId: v.id("agentActionRequests"),
    content: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    mediaDescriptions: v.optional(v.array(v.string())),
    mediaKinds: v.optional(
      v.array(v.union(v.literal("image"), v.literal("gif"), v.literal("video")))
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, {
      notFoundMessage: "User not found",
    });
    const request = await ctx.db.get(args.actionRequestId);
    if (!request || request.userId !== user._id) {
      throw new Error("Social action request not found");
    }

    if (request.status === "completed") {
      return { success: true, duplicate: true };
    }

    if (request.status !== "pending_approval") {
      throw new Error("Social action request is no longer pending approval");
    }

    const trimmedContent = args.content.trim();
    const actionKey = request.actionKey;
    const mediaUrls = normalizeMediaUrls(args.mediaUrls);
    if (
      args.mediaDescriptions &&
      args.mediaDescriptions.length > mediaUrls.length
    ) {
      throw new Error("mediaDescriptions cannot exceed mediaUrls length");
    }
    if (args.mediaKinds && args.mediaKinds.length > mediaUrls.length) {
      throw new Error("mediaKinds cannot exceed mediaUrls length");
    }
    const limitError = await getActionDraftValidationError(ctx, {
      userId: request.userId,
      actionKey,
      text: trimmedContent,
      mediaUrls,
    });
    if (limitError) {
      throw new Error(limitError);
    }

    // Preserve original draft for style learning before overwriting
    const originalDraft = request.draftContent;
    const isEdited = trimmedContent !== (originalDraft || "").trim();

    const snapshot = isRecord(request.argumentsSnapshot)
      ? request.argumentsSnapshot
      : {};
    const mediaKinds = normalizeMediaKinds(args.mediaKinds, mediaUrls);

    await ctx.db.patch(args.actionRequestId, {
      draftContent: trimmedContent,
      originalDraftContent: originalDraft,
      argumentsSnapshot: {
        ...snapshot,
        text: trimmedContent,
        mediaUrls,
        mediaDescriptions: args.mediaDescriptions ?? [],
        mediaKinds,
      },
      status: "approved",
      approvedAt: getCurrentUTCTimestamp(),
    });

    // Capture edit diff for writing style learning
    if (isEdited && originalDraft && request.workspaceId) {
      const actionMetadata = getTwitterActionCatalogEntry(
        request.actionKey as any
      );
      let stylePayload:
        | {
            originalDraft: string;
            editedContent: string;
            diffSource: string;
            platform: "twitter" | "linkedin";
            sourceVersion: number;
            sourceExternalUserId: string;
          }
        | undefined;

      if (actionMetadata.platform === "twitter") {
        const xAccount = await ctx.db
          .query("xAccounts")
          .withIndex("by_user", (q) => q.eq("userId", request.userId))
          .first();
        if (xAccount) {
          stylePayload = {
            originalDraft,
            editedContent: trimmedContent,
            diffSource: "action_request",
            platform: "twitter",
            sourceVersion:
              xAccount.styleSourceVersion ?? xAccount._creationTime,
            sourceExternalUserId: xAccount.xUserId,
          };
        }
      } else if (actionMetadata.platform === "linkedin") {
        const linkedInAccount = await ctx.db
          .query("linkedinAccounts")
          .withIndex("by_user", (q) => q.eq("userId", request.userId))
          .first();
        const sourceExternalUserId =
          linkedInAccount?.providerId ?? linkedInAccount?.accountId;
        if (linkedInAccount && sourceExternalUserId) {
          stylePayload = {
            originalDraft,
            editedContent: trimmedContent,
            diffSource: "action_request",
            platform: "linkedin",
            sourceVersion:
              linkedInAccount.styleSourceVersion ??
              linkedInAccount._creationTime,
            sourceExternalUserId,
          };
        }
      }

      if (stylePayload) {
        await recordMemoryWorkflowEvent(ctx, {
          workspaceId: request.workspaceId,
          eventType: "style_edit_diff_captured",
          sourceType: "style_edit_diff",
          sourceId: `action:${args.actionRequestId}:style-edit`,
          prospectId: request.prospectId,
          taskId: request.taskId,
          payload: stylePayload,
          eventKey: `style-edit:action:${args.actionRequestId}`,
        });
      }
    }

    await ctx.scheduler.runAfter(
      0,
      internal.socialActionExecutors.executeActionRequestInternal,
      { actionRequestId: args.actionRequestId }
    );

    return { success: true, duplicate: false };
  },
});

export const getActionRequestPanelContext = query({
  args: {
    actionRequestId: v.id("agentActionRequests"),
  },
  handler: async (ctx, { actionRequestId }) => {
    const user = await requireUser(ctx, {
      notFoundMessage: "User not found",
    });
    const request = await ctx.db.get(actionRequestId);
    if (!request || request.userId !== user._id) {
      return null;
    }

    const mode = request.status === "completed" ? "posted" : "approval";
    const sourceContext =
      isRecord(request.argumentsSnapshot) &&
      typeof request.argumentsSnapshot.context === "string"
        ? request.argumentsSnapshot.context
        : undefined;
    const actionMetadata = getTwitterActionCatalogEntry(
      request.actionKey as any
    );
    const snapshot = isRecord(request.argumentsSnapshot)
      ? request.argumentsSnapshot
      : {};
    const mediaUrls = normalizeMediaUrls(snapshot.mediaUrls);

    return {
      mode,
      platform: actionMetadata.platform,
      actionRequestId: request._id,
      title: request.title,
      description: request.description,
      actionKey: request.actionKey,
      content:
        request.draftContent ||
        (request.resultSummary &&
        typeof request.resultSummary.postedTextPreview === "string"
          ? request.resultSummary.postedTextPreview
          : undefined),
      sourcePostRef: request.sourcePostRef,
      sourcePostSummary: request.sourcePostSummary,
      sourcePostData: request.sourcePostData,
      sourcePostId: request.sourcePostId,
      sourceContext,
      mediaUrls,
      mediaDescriptions: Array.isArray(snapshot.mediaDescriptions)
        ? snapshot.mediaDescriptions.filter(
            (value): value is string => typeof value === "string"
          )
        : [],
      mediaKinds: normalizeMediaKinds(snapshot.mediaKinds, mediaUrls),
      createdTweetId:
        request.resultSummary &&
        typeof request.resultSummary.createdPostId === "string"
          ? request.resultSummary.createdPostId
          : undefined,
      status: request.status,
    };
  },
});

export const cancelActionRequest = mutation({
  args: {
    actionRequestId: v.id("agentActionRequests"),
  },
  handler: async (ctx, { actionRequestId }) => {
    const user = await requireUser(ctx, {
      notFoundMessage: "User not found",
    });
    const request = await ctx.db.get(actionRequestId);
    if (!request || request.userId !== user._id) {
      throw new Error("Social action request not found");
    }

    if (
      request.status === "completed" ||
      request.status === "failed" ||
      request.status === "cancelled"
    ) {
      return { success: true, duplicate: true };
    }

    await ctx.runMutation(internal.socialActions.cancelActionRequestInternal, {
      actionRequestId,
    });

    return { success: true, duplicate: false };
  },
});
