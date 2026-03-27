"use node";

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction } from "./lib/functionBuilders";
import { internal, components } from "./_generated/api";
import {
  type TwitterActionExecutionResult,
  executeCuratedTwitterAction,
  getXExecutionFailure,
} from "./lib/xdkTwitterProvider";
import {
  getTwitterActionCatalogEntry,
  type CuratedTwitterActionKey,
} from "./lib/twitterActionCatalog";
import { getXProviderContextForUser } from "./lib/xdkAuth";
import {
  getTwitterPostId,
  getTwitterPostRef,
  summarizeTwitterActionError,
  summarizeTwitterActionResult,
  summarizeTwitterPost,
  type TwitterPostRef,
  type TwitterPostSummary,
} from "../shared/lib/twitter/contracts";
import { resolveProspectTwitterIdentity } from "../shared/lib/twitter/prospectTwitterIdentity";
import { assertTwitterActionTextValid } from "../shared/lib/twitter/xPostTextLimit";

type ThreadContext = {
  userId: Id<"users">;
  threadId: string;
  prospectId?: Id<"prospects">;
  workspaceId?: Id<"workspaces">;
  prospect?: Doc<"prospects"> | null;
};

type SubmitTwitterActionResult = {
  success: boolean;
  executed: boolean;
  pendingApproval: boolean;
  actionKey: CuratedTwitterActionKey;
  actionRequestId?: string;
  prospectId?: string;
  title: string;
  message: string;
  approvalMode?: string;
  riskLevel?: string;
  targetTweetId?: string;
  sourcePostRef?: TwitterPostRef;
  sourcePostSummary?: TwitterPostSummary;
  sourceContext?: string;
  draftContent?: string;
  createdTweetId?: string;
  replacedExisting?: boolean;
  requiresReplacementConfirmation?: boolean;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function findSourcePostInProspect(
  prospect: Doc<"prospects"> | null,
  targetTweetId?: string
): {
  sourcePostSummary: TwitterPostSummary;
  sourcePostRef: TwitterPostRef;
} | null {
  if (!prospect) return null;

  const candidatePosts: unknown[] = [];
  if (prospect.data) candidatePosts.push(prospect.data);
  if (Array.isArray(prospect.evidencePosts)) {
    candidatePosts.push(...prospect.evidencePosts);
  }

  if (!targetTweetId) {
    const firstSummary = candidatePosts
      .map((post) => summarizeTwitterPost(post))
      .find((post): post is TwitterPostSummary => Boolean(post));
    if (!firstSummary) return null;
    return {
      sourcePostSummary: firstSummary,
      sourcePostRef: firstSummary.ref,
    };
  }

  const matched = candidatePosts.find((post) => {
    return getTwitterPostId(post) === targetTweetId;
  });

  if (!matched) {
    return null;
  }

  const sourcePostSummary = summarizeTwitterPost(matched);
  const sourcePostRef = getTwitterPostRef(matched);
  if (!sourcePostSummary || !sourcePostRef) {
    return null;
  }

  return {
    sourcePostSummary,
    sourcePostRef,
  };
}

function buildActionTitle(args: {
  actionKey: CuratedTwitterActionKey;
  targetLabel?: string;
}): string {
  const suffix = args.targetLabel ? ` ${args.targetLabel}` : "";
  switch (args.actionKey) {
    case "like_post":
      return `Liked post${suffix}`;
    case "unlike_post":
      return `Removed like${suffix}`;
    case "bookmark_post":
      return `Bookmarked post${suffix}`;
    case "unbookmark_post":
      return `Removed bookmark${suffix}`;
    case "retweet_post":
      return `Approve repost${suffix}`;
    case "unretweet_post":
      return `Approve undo repost${suffix}`;
    case "follow_user":
      return `Approve follow${suffix}`;
    case "unfollow_user":
      return `Approve unfollow${suffix}`;
    case "reply_to_post":
      return `Approve reply${suffix}`;
    case "create_post":
      return "Approve new post";
    case "send_dm":
      return args.targetLabel ? `Approve DM to ${args.targetLabel}` : "Approve DM";
    case "send_dm_in_existing_conversation":
      return args.targetLabel ? `Approve DM to ${args.targetLabel}` : "Approve DM";
    default:
      return "Twitter action";
  }
}

function buildActionDescription(args: {
  actionKey: CuratedTwitterActionKey;
  text?: string;
  context?: string;
}): string | undefined {
  const trimmedText = args.text?.trim();
  if (
    args.actionKey === "reply_to_post" ||
    args.actionKey === "create_post" ||
    args.actionKey === "send_dm" ||
    args.actionKey === "send_dm_in_existing_conversation"
  ) {
    return trimmedText || args.context;
  }
  return args.context;
}

async function resolveThreadContext(
  ctx: any,
  threadId: string
): Promise<ThreadContext> {
  const thread = await ctx.runQuery(components.agent.threads.getThread, {
    threadId,
  });
  const userId = thread?.userId as Id<"users"> | undefined;
  if (!userId) {
    throw new Error("User not found for thread");
  }

  const threadProspectContext = await ctx.runQuery(
    internal.prospectThreads.getThreadProspectContext,
    { threadId }
  );

  const prospectId = threadProspectContext?.prospectId;
  const workspaceId = threadProspectContext?.workspaceId;
  const prospect = prospectId
    ? await ctx.runQuery(internal.prospects.getProspectInternal, { prospectId })
    : null;

  return {
    userId,
    threadId,
    prospectId,
    workspaceId,
    prospect,
  };
}

function resolveDmTargetLabel(threadContext: ThreadContext): string | undefined {
  const prospect = threadContext.prospect;
  const displayName = prospect?.displayName;

  if (displayName?.trim()) {
    return displayName.trim();
  }

  const identity = prospect
    ? resolveProspectTwitterIdentity(prospect as unknown as Record<string, unknown>)
    : null;
  if (identity?.username?.trim()) {
    return identity.username.trim();
  }

  return undefined;
}

export const executeActionRequestInternal = internalAction({
  args: {
    actionRequestId: v.id("agentActionRequests"),
  },
  handler: async (ctx, { actionRequestId }) => {
    const request = await ctx.runQuery(
      internal.twitterActions.getActionRequestInternal,
      {
        actionRequestId,
      }
    );

    if (!request) {
      throw new Error("Twitter action request not found");
    }

    if (request.status === "completed" || request.status === "executing") {
      return { success: true, duplicate: true };
    }

    if (
      request.status !== "approved" &&
      request.status !== "pending_approval"
    ) {
      throw new Error(
        `Twitter action request is not actionable (status=${request.status})`
      );
    }

    await ctx.runMutation(
      internal.twitterActions.markActionRequestExecutingInternal,
      {
        actionRequestId,
      }
    );

    try {
      const argsSnapshot = isRecord(request.argumentsSnapshot)
        ? request.argumentsSnapshot
        : {};
      const metadata = getTwitterActionCatalogEntry(
        request.actionKey as CuratedTwitterActionKey
      );
      const provider = await getXProviderContextForUser(ctx, internal.xStore, {
        userId: request.userId,
        requiredScopes: metadata.requiredScopes,
      });
      const draftText =
        typeof argsSnapshot.text === "string"
          ? argsSnapshot.text
          : request.draftContent;
      const mediaUrlsForValidation = Array.isArray(argsSnapshot.mediaUrls)
        ? argsSnapshot.mediaUrls.filter(
            (value: unknown): value is string => typeof value === "string"
          )
        : undefined;
      const postLimit = await ctx.runQuery(
        internal.xPostLimits.getEffectivePostLimitInternal,
        { userId: request.userId }
      );
      assertTwitterActionTextValid(
        request.actionKey as CuratedTwitterActionKey,
        draftText,
        postLimit,
        mediaUrlsForValidation
      );

      const actionKey = request.actionKey as CuratedTwitterActionKey;
      let resolvedTargetUserId =
        typeof argsSnapshot.targetUserId === "string"
          ? argsSnapshot.targetUserId.trim()
          : undefined;
      let resolvedConversationId =
        typeof argsSnapshot.conversationId === "string"
          ? argsSnapshot.conversationId.trim()
          : undefined;

      if (
        actionKey === "send_dm" ||
        actionKey === "send_dm_in_existing_conversation"
      ) {
        let dmState: {
          participantUserId?: string;
          conversationId?: string;
        } | null = null;
        if (request.prospectId) {
          dmState = await ctx.runAction(internal.x.getProspectDmStateInternal, {
            userId: request.userId,
            prospectId: request.prospectId,
          });
        }
        if (actionKey === "send_dm") {
          if (!resolvedTargetUserId && request.prospectId) {
            const prospect = await ctx.runQuery(
              internal.prospects.getProspectInternal,
              { prospectId: request.prospectId }
            );
            if (prospect) {
              resolvedTargetUserId = resolveProspectTwitterIdentity(
                prospect as unknown as Record<string, unknown>
              ).userId;
            }
          }
          if (!resolvedTargetUserId && dmState?.participantUserId) {
            resolvedTargetUserId = dmState.participantUserId;
          }
          if (!resolvedTargetUserId) {
            throw new Error(
              "Could not resolve X participant id for DM. Reconnect or refresh prospect data."
            );
          }
        }
        if (actionKey === "send_dm_in_existing_conversation") {
          if (!resolvedConversationId && dmState?.conversationId) {
            resolvedConversationId = dmState.conversationId;
          }
          if (!resolvedConversationId) {
            throw new Error(
              "Could not resolve DM conversation id. Open the DM panel to sync first."
            );
          }
        }
      }

      const execution = await executeCuratedTwitterAction(provider, {
        actionKey,
        toolSlug: metadata.toolSlug,
        toolVersion: metadata.toolVersion,
        tweetId:
          typeof argsSnapshot.tweetId === "string"
            ? argsSnapshot.tweetId
            : undefined,
        targetUserId: resolvedTargetUserId,
        text: draftText,
        mediaUrls: mediaUrlsForValidation,
        conversationId: resolvedConversationId,
      });

      await ctx.runMutation(
        internal.twitterActions.completeActionRequestInternal,
        {
          actionRequestId,
          resultSummary: summarizeTwitterActionResult({
            actionKey: execution.actionKey,
            toolSlug: execution.toolSlug,
            toolVersion: execution.toolVersion,
            completedAt: Date.now(),
            targetPostId:
              typeof argsSnapshot.tweetId === "string"
                ? argsSnapshot.tweetId
                : undefined,
            targetUserId: resolvedTargetUserId,
            createdPostId: execution.createdTweetId,
            postedText: execution.postedText,
          }),
        }
      );

      await ctx.runMutation(
        internal.twitterActions.createActionRequestNotificationInternal,
        {
          actionRequestId,
          type: "twitter_action_completed",
          message:
            execution.actionKey === "reply_to_post" ||
            execution.actionKey === "create_post"
              ? (execution.postedText ?? "Twitter action completed.")
              : request.title,
        }
      );

      return { success: true, result: execution };
    } catch (error) {
      const failure = getXExecutionFailure(error);

      await ctx.runMutation(internal.twitterActions.failActionRequestInternal, {
        actionRequestId,
        errorSummary: summarizeTwitterActionError({
          classification: failure.classification,
          message: failure.message,
          retryable: failure.retryable,
          suggestion: failure.suggestion,
          code: failure.code,
          completedAt: Date.now(),
        }),
      });

      await ctx.runMutation(
        internal.twitterActions.createActionRequestNotificationInternal,
        {
          actionRequestId,
          type: "twitter_action_failed",
          message: failure.message,
        }
      );

      return {
        success: false,
        error: failure.message,
        failure,
      };
    }
  },
});

export const submitTwitterActionForThread = internalAction({
  args: {
    threadId: v.string(),
    actionKey: v.union(
      v.literal("like_post"),
      v.literal("unlike_post"),
      v.literal("bookmark_post"),
      v.literal("unbookmark_post"),
      v.literal("retweet_post"),
      v.literal("unretweet_post"),
      v.literal("follow_user"),
      v.literal("unfollow_user"),
      v.literal("reply_to_post"),
      v.literal("create_post"),
      v.literal("send_dm"),
      v.literal("send_dm_in_existing_conversation")
    ),
    tweetId: v.optional(v.string()),
    targetUserId: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    text: v.optional(v.string()),
    mediaUrls: v.optional(v.array(v.string())),
    mediaDescriptions: v.optional(v.array(v.string())),
    targetLabel: v.optional(v.string()),
    context: v.optional(v.string()),
    replaceExistingPending: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<SubmitTwitterActionResult> => {
    const threadContext = await resolveThreadContext(ctx, args.threadId);
    const limit = await ctx.runQuery(
      internal.xPostLimits.getEffectivePostLimitInternal,
      { userId: threadContext.userId }
    );
    assertTwitterActionTextValid(
      args.actionKey,
      args.text,
      limit,
      args.mediaUrls ?? undefined
    );

    let resolvedTargetUserIdForRequest =
      typeof args.targetUserId === "string"
        ? args.targetUserId.trim()
        : undefined;
    let resolvedConversationIdForRequest =
      typeof args.conversationId === "string"
        ? args.conversationId.trim()
        : undefined;

    const metadata = getTwitterActionCatalogEntry(args.actionKey);
    const effectiveTargetLabel =
      args.targetLabel ??
      ((args.actionKey === "send_dm" ||
        args.actionKey === "send_dm_in_existing_conversation") &&
      threadContext.prospect
        ? resolveDmTargetLabel(threadContext)
        : undefined);
    const source = findSourcePostInProspect(
      threadContext.prospect ?? null,
      args.tweetId
    );
    const title = buildActionTitle({
      actionKey: args.actionKey,
      targetLabel: effectiveTargetLabel,
    });
    const description = buildActionDescription({
      actionKey: args.actionKey,
      text: args.text,
      context: args.context,
    });

    if (
      args.actionKey === "send_dm" ||
      args.actionKey === "send_dm_in_existing_conversation"
    ) {
      if (!threadContext.prospectId) {
        return {
          success: false,
          executed: false,
          pendingApproval: false,
          actionKey: args.actionKey,
          title,
          message: "DMs require a prospect in the current thread.",
          approvalMode: metadata.approvalMode,
          riskLevel: metadata.riskLevel,
          sourceContext: args.context,
          draftContent: args.text?.trim() || undefined,
          error: "Missing prospect context for DM action.",
        };
      }

      const dmState = await ctx.runAction(
        internal.x.getProspectDmStateInternal,
        {
          userId: threadContext.userId,
          prospectId: threadContext.prospectId,
        }
      );

      if (!dmState?.eligibility.enabled) {
        const reason =
          dmState?.eligibility.reasonLabel ??
          "DM eligibility unavailable right now.";
        return {
          success: false,
          executed: false,
          pendingApproval: false,
          actionKey: args.actionKey,
          prospectId: String(threadContext.prospectId),
          title: "DM unavailable",
          message: reason,
          approvalMode: metadata.approvalMode,
          riskLevel: metadata.riskLevel,
          sourceContext: args.context,
          draftContent: args.text?.trim() || undefined,
          error: reason,
        };
      }

      if (args.actionKey === "send_dm") {
        if (!resolvedTargetUserIdForRequest && threadContext.prospect) {
          resolvedTargetUserIdForRequest = resolveProspectTwitterIdentity(
            threadContext.prospect as unknown as Record<string, unknown>
          ).userId;
        }
        if (!resolvedTargetUserIdForRequest && dmState.participantUserId) {
          resolvedTargetUserIdForRequest = dmState.participantUserId;
        }
        if (!resolvedTargetUserIdForRequest) {
          return {
            success: false,
            executed: false,
            pendingApproval: false,
            actionKey: args.actionKey,
            prospectId: String(threadContext.prospectId),
            title: "DM unavailable",
            message:
              "Could not resolve the prospect's X user id. Refresh enrichment or open the DM panel.",
            approvalMode: metadata.approvalMode,
            riskLevel: metadata.riskLevel,
            sourceContext: args.context,
            draftContent: args.text?.trim() || undefined,
            error: "Missing X participant id for DM.",
          };
        }
      }

      if (args.actionKey === "send_dm_in_existing_conversation") {
        if (!resolvedConversationIdForRequest && dmState.conversationId) {
          resolvedConversationIdForRequest = dmState.conversationId;
        }
        if (!resolvedConversationIdForRequest) {
          return {
            success: false,
            executed: false,
            pendingApproval: false,
            actionKey: args.actionKey,
            prospectId: String(threadContext.prospectId),
            title: "DM unavailable",
            message:
              "No DM conversation id yet. Open the DM panel to sync the thread first.",
            approvalMode: metadata.approvalMode,
            riskLevel: metadata.riskLevel,
            sourceContext: args.context,
            draftContent: args.text?.trim() || undefined,
            error: "Missing conversation id for DM reply.",
          };
        }
      }

      const existingPendingRequest = await ctx.runQuery(
        internal.twitterActions.getPendingDmActionRequestForScope,
        {
          threadId: threadContext.threadId,
          prospectId: threadContext.prospectId,
        }
      );

      if (
        existingPendingRequest &&
        (!args.replaceExistingPending ||
          existingPendingRequest.actionKey !== args.actionKey ||
          existingPendingRequest.draftContent !== (args.text?.trim() || undefined))
      ) {
        if (!args.replaceExistingPending) {
          return {
            success: true,
            executed: false,
            pendingApproval: true,
            actionKey: existingPendingRequest.actionKey as CuratedTwitterActionKey,
            actionRequestId: String(existingPendingRequest._id),
            prospectId: threadContext.prospectId
              ? String(threadContext.prospectId)
              : undefined,
            title: existingPendingRequest.title,
            message:
              "A pending DM draft already exists for this person. Ask the user whether they want to replace it before updating the draft.",
            approvalMode: metadata.approvalMode,
            riskLevel: metadata.riskLevel,
            sourceContext: args.context,
            draftContent:
              existingPendingRequest.draftContent || args.text?.trim() || undefined,
            requiresReplacementConfirmation: true,
          };
        }

        await ctx.runMutation(
          internal.twitterActions.updatePendingActionRequestInternal,
          {
            actionRequestId: existingPendingRequest._id,
            actionKey: args.actionKey,
            title,
            description,
            argumentsSnapshot: {
              tweetId: args.tweetId,
              targetUserId:
                resolvedTargetUserIdForRequest ?? args.targetUserId,
              conversationId:
                resolvedConversationIdForRequest ?? args.conversationId,
              text: args.text,
              mediaUrls: args.mediaUrls ?? [],
              mediaDescriptions: args.mediaDescriptions ?? [],
              targetLabel: effectiveTargetLabel,
              context: args.context,
            },
            sourcePostRef: source?.sourcePostRef,
            sourcePostSummary: source?.sourcePostSummary,
            draftContent: args.text?.trim() || undefined,
            notificationMessage:
              args.text?.trim() ||
              ((args.mediaUrls?.length ?? 0) > 0
                ? "Approval required for DM with media."
                : "Approval required before posting."),
          }
        );

        return {
          success: true,
          executed: false,
          pendingApproval: true,
          actionKey: args.actionKey,
          actionRequestId: String(existingPendingRequest._id),
          prospectId: threadContext.prospectId
            ? String(threadContext.prospectId)
            : undefined,
          title,
          message: "Pending DM draft updated. It is ready for review and approval.",
          approvalMode: metadata.approvalMode,
          riskLevel: metadata.riskLevel,
          targetTweetId: source?.sourcePostRef.postId ?? args.tweetId,
          sourcePostRef: source?.sourcePostRef,
          sourcePostSummary: source?.sourcePostSummary,
          sourceContext: args.context,
          draftContent: args.text?.trim() || undefined,
          replacedExisting: true,
        };
      }
    }

    const requestId = await ctx.runMutation(
      internal.twitterActions.createActionRequestInternal,
      {
        userId: threadContext.userId,
        threadId: threadContext.threadId,
        prospectId: threadContext.prospectId,
        workspaceId: threadContext.workspaceId,
        provider: "x_twitter_sdk",
        actionKey: args.actionKey,
        title,
        description,
        toolSlug: metadata.toolSlug,
        toolVersion: metadata.toolVersion,
        riskLevel: metadata.riskLevel,
        approvalMode: metadata.approvalMode,
        uiArtifactType: metadata.uiArtifactType,
        entityType: metadata.entityType,
        requiresConnectedAccount: metadata.requiresConnectedAccount,
        status:
          metadata.approvalMode === "auto_execute"
            ? "executing"
            : "pending_approval",
        argumentsSnapshot: {
          tweetId: args.tweetId,
          targetUserId: resolvedTargetUserIdForRequest ?? args.targetUserId,
          conversationId:
            resolvedConversationIdForRequest ?? args.conversationId,
          text: args.text,
          mediaUrls: args.mediaUrls ?? [],
          mediaDescriptions: args.mediaDescriptions ?? [],
          targetLabel: effectiveTargetLabel,
          context: args.context,
        },
        sourcePostRef: source?.sourcePostRef,
        sourcePostSummary: source?.sourcePostSummary,
        draftContent: args.text?.trim() || undefined,
      }
    );

    if (metadata.approvalMode !== "auto_execute") {
      const dmApprovalMessage =
        args.text?.trim() ||
        (args.mediaUrls && args.mediaUrls.length > 0
          ? "Approval required for DM with media."
          : "Approval required before posting.");
      await ctx.runMutation(
        internal.twitterActions.createActionRequestNotificationInternal,
        {
          actionRequestId: requestId,
          type: "twitter_action_request",
          message:
            args.actionKey === "reply_to_post" ||
            args.actionKey === "create_post" ||
            args.actionKey === "send_dm" ||
            args.actionKey === "send_dm_in_existing_conversation"
              ? dmApprovalMessage
              : description || title,
        }
      );

      return {
        success: true,
        executed: false,
        pendingApproval: true,
        actionKey: args.actionKey,
        actionRequestId: requestId,
        prospectId: threadContext.prospectId
          ? String(threadContext.prospectId)
          : undefined,
        title,
        message:
          metadata.approvalMode === "confirm_first"
            ? "Approval required before this action executes."
            : "Draft ready for review and approval.",
        approvalMode: metadata.approvalMode,
        riskLevel: metadata.riskLevel,
        targetTweetId: source?.sourcePostRef.postId ?? args.tweetId,
        sourcePostRef: source?.sourcePostRef,
        sourcePostSummary: source?.sourcePostSummary,
        sourceContext: args.context,
        draftContent: args.text?.trim() || undefined,
      };
    }

    const executed = await ctx.runAction(
      internal.twitterActionExecutors.executeActionRequestInternal,
      {
        actionRequestId: requestId,
      }
    );

    if (!executed.success) {
      return {
        success: false,
        executed: false,
        pendingApproval: false,
        actionKey: args.actionKey,
        actionRequestId: requestId,
        title,
        message: "Twitter action failed.",
        approvalMode: metadata.approvalMode,
        riskLevel: metadata.riskLevel,
        targetTweetId: source?.sourcePostRef.postId ?? args.tweetId,
        sourcePostRef: source?.sourcePostRef,
        sourcePostSummary: source?.sourcePostSummary,
        sourceContext: args.context,
        draftContent: args.text?.trim() || undefined,
        error: executed.error,
      };
    }

    const result = executed.result as TwitterActionExecutionResult;
    return {
      success: true,
      executed: true,
      pendingApproval: false,
      actionKey: args.actionKey,
      actionRequestId: requestId,
      prospectId: threadContext.prospectId
        ? String(threadContext.prospectId)
        : undefined,
      title,
      message: "Twitter action completed.",
      approvalMode: metadata.approvalMode,
      riskLevel: metadata.riskLevel,
      targetTweetId: source?.sourcePostRef.postId ?? args.tweetId,
      sourcePostRef: source?.sourcePostRef,
      sourcePostSummary: source?.sourcePostSummary,
      sourceContext: args.context,
      draftContent: args.text?.trim() || undefined,
      createdTweetId: result.createdTweetId,
    };
  },
});
