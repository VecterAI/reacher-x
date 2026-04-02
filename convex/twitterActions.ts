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
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  getDmTextLimitError,
  getPostTextLimitError,
} from "../shared/lib/twitter/xPostTextLimit";
import { getEffectivePostTextLimitForUser } from "./lib/xPostLimits";
import {
  twitterActionArgumentsSnapshotValidator,
  twitterActionErrorSummaryValidator,
  twitterActionResultSummaryValidator,
  twitterActionProviderValidator,
  twitterPostRefValidator,
  twitterPostSummaryValidator,
} from "./validators";

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
      | "twitter_action_request"
      | "twitter_action_completed"
      | "twitter_action_failed";
  }
) {
  if (!args.workspaceId) {
    return;
  }

  const prospect = args.prospectId ? await ctx.db.get(args.prospectId) : null;

  await createNotification(ctx, {
    userId: args.userId,
    workspaceId: args.workspaceId,
    type: args.type,
    title: args.title,
    message: args.message,
    prospectId: args.prospectId,
    threadId: args.threadId,
    actionRequestId: args.requestId,
    prospectAvatarUrl: prospect?.avatarUrl,
    prospectDisplayName: prospect?.name ?? prospect?.displayName,
    prospectType: prospect?.prospectType,
    prospectPlatform: prospect?.platform,
    prospectScreenName:
      typeof (prospect as any)?.screenName === "string"
        ? (prospect as any).screenName
        : undefined,
  });
}

function isPendingDmActionKey(actionKey: string | undefined): boolean {
  return (
    actionKey === "send_dm" ||
    actionKey === "send_dm_in_existing_conversation"
  );
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

  if (isPendingDmActionKey(args.actionKey) && (args.mediaUrls?.length ?? 0) > 0) {
    return "Approval required for DM with media.";
  }

  return args.fallback ?? "Approval required before posting.";
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
      throw new Error("Twitter action request not found");
    }
    if (request.status === "completed") {
      return { success: true, duplicate: true };
    }
    if (request.status !== "pending_approval") {
      throw new Error("Twitter action request is no longer pending approval");
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
      v.literal("twitter_action_request"),
      v.literal("twitter_action_completed"),
      v.literal("twitter_action_failed")
    ),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.actionRequestId);
    if (!request) {
      throw new Error("Twitter action request not found");
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
    draftContent: v.optional(v.string()),
    notificationMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.actionRequestId);
    if (!request) {
      throw new Error("Twitter action request not found");
    }
    if (request.status !== "pending_approval") {
      throw new Error("Twitter action request is no longer pending approval");
    }

    await ctx.db.patch(args.actionRequestId, {
      actionKey: args.actionKey,
      title: args.title,
      description: args.description,
      argumentsSnapshot: args.argumentsSnapshot,
      sourcePostRef: args.sourcePostRef,
      sourcePostSummary: args.sourcePostSummary,
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
      throw new Error("Twitter action request not found");
    }

    const approvalResult: { success: boolean; duplicate: boolean } =
      await ctx.runMutation(
        internal.twitterActions.approveActionRequestInternal,
        { actionRequestId }
      );

    await ctx.scheduler.runAfter(
      0,
      internal.twitterActionExecutors.executeActionRequestInternal,
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
      throw new Error("Twitter action request not found");
    }
    if (request.status !== "pending_approval") {
      throw new Error("Twitter action request is no longer pending approval");
    }

    const trimmedContent = args.content.trim();
    const isDm = isPendingDmActionKey(request.actionKey);
    if (!trimmedContent) {
      throw new Error(isDm ? "DM content is required" : "Post content is required");
    }

    const limitError = isDm
      ? getDmTextLimitError(trimmedContent)
      : getPostTextLimitError(
          trimmedContent,
          await getEffectivePostTextLimitForUser(ctx, request.userId)
        );
    if (limitError) {
      throw new Error(limitError);
    }

    const snapshot = isRecord(request.argumentsSnapshot)
      ? request.argumentsSnapshot
      : {};

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
        mediaUrls: Array.isArray(snapshot.mediaUrls)
          ? (snapshot.mediaUrls as string[])
          : [],
      }),
    });

    return { success: true };
  },
});

export const approveActionRequestWithEdits = mutation({
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
      throw new Error("Twitter action request not found");
    }

    if (request.status === "completed") {
      return { success: true, duplicate: true };
    }

    if (request.status !== "pending_approval") {
      throw new Error("Twitter action request is no longer pending approval");
    }

    const trimmedContent = args.content.trim();
    if (!trimmedContent) {
      throw new Error("Post content is required");
    }
    const actionKey = request.actionKey;
    const isDm =
      actionKey === "send_dm" ||
      actionKey === "send_dm_in_existing_conversation";
    const limitError = isDm
      ? getDmTextLimitError(trimmedContent)
      : getPostTextLimitError(
          trimmedContent,
          await getEffectivePostTextLimitForUser(ctx, request.userId)
        );
    if (limitError) {
      throw new Error(limitError);
    }

    const snapshot = isRecord(request.argumentsSnapshot)
      ? request.argumentsSnapshot
      : {};

    await ctx.db.patch(args.actionRequestId, {
      draftContent: trimmedContent,
      argumentsSnapshot: {
        ...snapshot,
        text: trimmedContent,
      },
      status: "approved",
      approvedAt: getCurrentUTCTimestamp(),
    });

    await ctx.scheduler.runAfter(
      0,
      internal.twitterActionExecutors.executeActionRequestInternal,
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

    return {
      mode,
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
      sourceContext,
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
      throw new Error("Twitter action request not found");
    }

    if (
      request.status === "completed" ||
      request.status === "failed" ||
      request.status === "cancelled"
    ) {
      return { success: true, duplicate: true };
    }

    await ctx.runMutation(internal.twitterActions.cancelActionRequestInternal, {
      actionRequestId,
    });

    return { success: true, duplicate: false };
  },
});
