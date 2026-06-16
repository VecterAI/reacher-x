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
import { getLinkedInFailure } from "./lib/unipileClient";
import {
  getTwitterPostId,
  getTwitterPostRef,
  summarizeTwitterActionError,
  summarizeTwitterActionResult,
  summarizeTwitterPost,
  type TwitterPostRef,
  type TwitterPostSummary,
} from "../shared/lib/twitter/contracts";
import { logger } from "../shared/lib/logger";
import { resolveProspectTwitterIdentity } from "../shared/lib/twitter/prospectTwitterIdentity";
import { assertTwitterActionTextValid } from "../shared/lib/twitter/xPostTextLimit";

const internalLinkedInApi = (internal as any).linkedin;
const socialActionExecutorsLogger = logger.withScope("SocialActionExecutors");

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
  eligibilityReasonCode?: string;
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

type ExecuteActionRequestResult =
  | {
      success: true;
      duplicate: true;
    }
  | {
      success: true;
      result: TwitterActionExecutionResult | { actionKey: string };
    }
  | {
      success: false;
      error: string;
      failure: unknown;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function shouldMarkProspectContacted(
  actionKey: CuratedTwitterActionKey
): boolean {
  return (
    actionKey === "reply_to_post" ||
    actionKey === "send_dm" ||
    actionKey === "send_dm_in_existing_conversation" ||
    actionKey === "linkedin_send_message" ||
    actionKey === "linkedin_send_message_existing_conversation" ||
    actionKey === "linkedin_comment_on_post" ||
    actionKey === "linkedin_invite_user"
  );
}

function getContactedDescription(actionKey: CuratedTwitterActionKey): string {
  switch (actionKey) {
    case "reply_to_post":
      return "Posted a reply on X.";
    case "send_dm":
    case "send_dm_in_existing_conversation":
      return "Sent a DM on X.";
    case "linkedin_send_message":
    case "linkedin_send_message_existing_conversation":
      return "Sent a LinkedIn message.";
    case "linkedin_comment_on_post":
      return "Posted a comment on LinkedIn.";
    case "linkedin_invite_user":
      return "Sent a LinkedIn invitation.";
    default:
      return "Started outreach.";
  }
}

function getLinkedInSourceUrl(sourcePostData: unknown): string | undefined {
  if (!isRecord(sourcePostData)) {
    return undefined;
  }

  if (typeof sourcePostData.url === "string") {
    return sourcePostData.url;
  }

  if (typeof sourcePostData.postURL === "string") {
    return sourcePostData.postURL;
  }

  return undefined;
}

function findSourcePostInProspect(
  prospect: Doc<"prospects"> | null,
  targetTweetId?: string
): {
  sourcePostSummary?: TwitterPostSummary;
  sourcePostRef?: TwitterPostRef;
} | null {
  if (!prospect) {
    return targetTweetId
      ? {
          sourcePostRef: {
            platform: "twitter",
            postId: targetTweetId,
          },
        }
      : null;
  }

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
    return targetTweetId
      ? {
          sourcePostRef: {
            platform: "twitter",
            postId: targetTweetId,
          },
        }
      : null;
  }

  const sourcePostSummary = summarizeTwitterPost(matched) ?? undefined;
  const sourcePostRef = getTwitterPostRef(matched) ??
    sourcePostSummary?.ref ?? {
      platform: "twitter",
      postId: targetTweetId,
    };
  if (!sourcePostSummary && !sourcePostRef) {
    return null;
  }

  return {
    sourcePostSummary,
    sourcePostRef,
  };
}

async function hydrateMissingTwitterSourcePost(args: {
  ctx: any;
  userId: Id<"users">;
  targetTweetId?: string;
  source: {
    sourcePostSummary?: TwitterPostSummary;
    sourcePostRef?: TwitterPostRef;
  } | null;
}) {
  if (!args.targetTweetId || args.source?.sourcePostSummary) {
    return args.source;
  }

  const hydrated = await args.ctx.runAction(
    internal.x.getHydratedTwitterPostInternal,
    {
      userId: args.userId,
      tweetId: args.targetTweetId,
    }
  );
  const tweet = hydrated?.tweet;
  const sourcePostSummary = summarizeTwitterPost(tweet) ?? undefined;

  if (!sourcePostSummary) {
    return args.source;
  }

  const sourcePostRef =
    getTwitterPostRef(tweet) ??
    sourcePostSummary.ref ??
    args.source?.sourcePostRef;

  return {
    sourcePostRef,
    sourcePostSummary,
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
      return args.targetLabel
        ? `Approve DM to ${args.targetLabel}`
        : "Approve DM";
    case "send_dm_in_existing_conversation":
      return args.targetLabel
        ? `Approve DM to ${args.targetLabel}`
        : "Approve DM";
    default:
      return "Social action";
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

function resolveDmTargetLabel(
  threadContext: ThreadContext
): string | undefined {
  const prospect = threadContext.prospect;
  const displayName = prospect?.displayName;

  if (displayName?.trim()) {
    return displayName.trim();
  }

  const identity = prospect
    ? resolveProspectTwitterIdentity(
        prospect as unknown as Record<string, unknown>
      )
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
  handler: async (
    ctx,
    { actionRequestId }
  ): Promise<ExecuteActionRequestResult> => {
    const request: any = await ctx.runQuery(
      internal.socialActions.getActionRequestInternal,
      {
        actionRequestId,
      }
    );

    if (!request) {
      throw new Error("Social action request not found");
    }

    if (request.status === "completed" || request.status === "executing") {
      return { success: true, duplicate: true };
    }

    if (
      request.status !== "approved" &&
      request.status !== "pending_approval"
    ) {
      throw new Error(
        `Social action request is not actionable (status=${request.status})`
      );
    }

    await ctx.runMutation(
      internal.socialActions.markActionRequestExecutingInternal,
      {
        actionRequestId,
      }
    );

    const metadata = getTwitterActionCatalogEntry(
      request.actionKey as CuratedTwitterActionKey
    );

    if (metadata.provider === "linkedin_unipile") {
      try {
        const argsSnapshot = isRecord(request.argumentsSnapshot)
          ? request.argumentsSnapshot
          : {};
        const draftText =
          typeof argsSnapshot.text === "string"
            ? argsSnapshot.text
            : request.draftContent;
        const mediaUrls = Array.isArray(argsSnapshot.mediaUrls)
          ? argsSnapshot.mediaUrls.filter(
              (value: unknown): value is string => typeof value === "string"
            )
          : undefined;
        const postId =
          typeof argsSnapshot.postId === "string"
            ? argsSnapshot.postId.trim()
            : typeof request.sourcePostId === "string"
              ? request.sourcePostId
              : undefined;

        let targetUserId: string | undefined;
        let postedText: string | undefined;
        let linkedinCommentId: string | undefined;

        switch (request.actionKey as CuratedTwitterActionKey) {
          case "linkedin_send_message":
          case "linkedin_send_message_existing_conversation": {
            if (!request.prospectId) {
              throw new Error(
                "LinkedIn messages require a prospect in the current thread."
              );
            }
            const result = await ctx.runAction(
              internalLinkedInApi.sendLinkedInMessageInternal,
              {
                userId: request.userId,
                prospectId: request.prospectId,
                conversationId:
                  typeof argsSnapshot.conversationId === "string"
                    ? argsSnapshot.conversationId
                    : undefined,
                text: draftText ?? "",
                mediaUrls,
              }
            );
            postedText = draftText ?? undefined;
            targetUserId =
              typeof argsSnapshot.targetUserId === "string"
                ? argsSnapshot.targetUserId
                : result?.conversationId;
            break;
          }
          case "linkedin_react_to_post": {
            if (!request.prospectId || !postId) {
              throw new Error(
                "LinkedIn reactions require a prospect and post id."
              );
            }
            const result = await ctx.runAction(
              internalLinkedInApi.reactToLinkedInPostInternal,
              {
                userId: request.userId,
                prospectId: request.prospectId,
                postId,
                reactionType:
                  typeof argsSnapshot.reactionType === "string"
                    ? argsSnapshot.reactionType
                    : undefined,
              }
            );
            targetUserId = result?.targetUserId;
            break;
          }
          case "linkedin_comment_on_post": {
            if (!request.prospectId || !postId) {
              throw new Error(
                "LinkedIn comments require a prospect and post id."
              );
            }
            const parentCommentId =
              typeof argsSnapshot.parentCommentId === "string"
                ? argsSnapshot.parentCommentId
                : typeof argsSnapshot.replyToCommentId === "string"
                  ? argsSnapshot.replyToCommentId
                  : undefined;
            const result = await ctx.runAction(
              internalLinkedInApi.commentOnLinkedInPostInternal,
              {
                userId: request.userId,
                prospectId: request.prospectId,
                postId,
                text: draftText ?? "",
                commentId: parentCommentId,
                mediaUrls,
              }
            );
            postedText = result?.postedTextPreview ?? draftText ?? undefined;
            targetUserId = result?.targetUserId;
            linkedinCommentId =
              typeof result?.commentId === "string"
                ? result.commentId
                : undefined;
            break;
          }
          case "linkedin_invite_user": {
            if (!request.prospectId) {
              throw new Error(
                "LinkedIn invitations require a prospect in the current thread."
              );
            }
            const result = await ctx.runAction(
              internalLinkedInApi.sendLinkedInInvitationInternal,
              {
                userId: request.userId,
                prospectId: request.prospectId,
                message: draftText ?? undefined,
              }
            );
            postedText = result?.postedTextPreview ?? draftText ?? undefined;
            targetUserId = result?.targetUserId;
            break;
          }
          default:
            throw new Error(
              `Unsupported LinkedIn action: ${request.actionKey}`
            );
        }

        await ctx.runMutation(
          internal.socialActions.completeActionRequestInternal,
          {
            actionRequestId,
            resultSummary: summarizeTwitterActionResult({
              actionKey: request.actionKey,
              toolSlug: request.toolSlug,
              toolVersion: request.toolVersion,
              completedAt: Date.now(),
              targetPostId: postId,
              targetUserId,
              postedText,
            }),
          }
        );

        await ctx.runMutation(
          internal.socialActions.createActionRequestNotificationInternal,
          {
            actionRequestId,
            type: "social_action_completed",
            message: postedText ?? request.title,
          }
        );

        if (
          request.prospectId &&
          request.workspaceId &&
          shouldMarkProspectContacted(
            request.actionKey as CuratedTwitterActionKey
          )
        ) {
          await ctx.runMutation(
            internal.outreach.markProspectContactedFromSuccessfulOutreach,
            {
              prospectId: request.prospectId,
              workspaceId: request.workspaceId,
              description: getContactedDescription(
                request.actionKey as CuratedTwitterActionKey
              ),
            }
          );
        }

        if (
          request.actionKey === "linkedin_comment_on_post" &&
          request.prospectId &&
          postId &&
          postedText
        ) {
          await ctx.runMutation(
            internal.interactions.upsertLinkedInCommentInteractionInternal,
            {
              userId: request.userId,
              prospectId: request.prospectId,
              sourcePostId: postId,
              replyPostId:
                linkedinCommentId ?? `${postId}:comment:${Date.now()}`,
              threadId: postId,
              sourcePostData: request.sourcePostData,
              sourceUrl: getLinkedInSourceUrl(request.sourcePostData),
              replyText: postedText,
              interactionType:
                typeof argsSnapshot.parentCommentId === "string" ||
                typeof argsSnapshot.replyToCommentId === "string"
                  ? "comment_reply_posted"
                  : "comment_posted",
              origin: request.threadId ? "agent" : "manual_reacherx",
              discoveredVia: "action_request",
              status: "active",
              direction: "outgoing",
              discoveredAt: Date.now(),
              lastSeenAt: Date.now(),
            }
          );
        }

        return { success: true, result: { actionKey: request.actionKey } };
      } catch (error) {
        const failure = getLinkedInFailure(error);

        await ctx.runMutation(
          internal.socialActions.failActionRequestInternal,
          {
            actionRequestId,
            errorSummary: summarizeTwitterActionError({
              classification: failure.classification,
              message: failure.message,
              retryable: failure.retryable,
              completedAt: Date.now(),
              code: failure.status,
            }),
          }
        );

        await ctx.runMutation(
          internal.socialActions.createActionRequestNotificationInternal,
          {
            actionRequestId,
            type: "social_action_failed",
            message: failure.message,
          }
        );

        return {
          success: false,
          error: failure.message,
          failure,
        };
      }
    }

    try {
      const argsSnapshot = isRecord(request.argumentsSnapshot)
        ? request.argumentsSnapshot
        : {};
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
      const mediaDescriptionsForExecution = Array.isArray(
        argsSnapshot.mediaDescriptions
      )
        ? argsSnapshot.mediaDescriptions.filter(
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
        mediaDescriptions: mediaDescriptionsForExecution,
        conversationId: resolvedConversationId,
      });

      await ctx.runMutation(
        internal.socialActions.completeActionRequestInternal,
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
        internal.socialActions.createActionRequestNotificationInternal,
        {
          actionRequestId,
          type: "social_action_completed",
          message:
            execution.actionKey === "reply_to_post" ||
            execution.actionKey === "create_post"
              ? (execution.postedText ?? "Social action completed.")
              : request.title,
        }
      );

      if (
        (actionKey === "send_dm" ||
          actionKey === "send_dm_in_existing_conversation") &&
        request.prospectId
      ) {
        const effectiveConversationId =
          resolvedConversationId ||
          (typeof execution.createdTweetId === "string"
            ? execution.createdTweetId
            : undefined);
        if (effectiveConversationId) {
          try {
            await ctx.runAction(internal.x.syncDmConversationInternal, {
              userId: request.userId,
              conversationId: effectiveConversationId,
            });
          } catch (syncError) {
            socialActionExecutorsLogger.warn(
              "Unable to refresh DM conversation after send",
              {
                actionRequestId,
                conversationId: effectiveConversationId,
                error:
                  syncError instanceof Error
                    ? syncError.message
                    : String(syncError),
              }
            );
          }
        }
      }

      if (
        request.prospectId &&
        request.workspaceId &&
        shouldMarkProspectContacted(actionKey)
      ) {
        await ctx.runMutation(
          internal.outreach.markProspectContactedFromSuccessfulOutreach,
          {
            prospectId: request.prospectId,
            workspaceId: request.workspaceId,
            description: getContactedDescription(actionKey),
          }
        );
      }

      if (
        actionKey === "reply_to_post" &&
        request.prospectId &&
        execution.createdTweetId
      ) {
        const fallbackSourcePostRef =
          request.sourcePostRef ??
          (typeof argsSnapshot.tweetId === "string"
            ? {
                platform: "twitter" as const,
                postId: argsSnapshot.tweetId,
                conversationId: argsSnapshot.tweetId,
              }
            : undefined);

        if (fallbackSourcePostRef) {
          await ctx.runMutation(internal.outreach.upsertTwitterInteraction, {
            userId: request.userId,
            prospectId: request.prospectId,
            sourcePostRef: fallbackSourcePostRef,
            sourcePostSummary: request.sourcePostSummary,
            replyPostRef: {
              platform: "twitter",
              postId: execution.createdTweetId,
              conversationId:
                fallbackSourcePostRef.conversationId ??
                fallbackSourcePostRef.postId,
            },
            threadId:
              fallbackSourcePostRef.conversationId ??
              fallbackSourcePostRef.postId,
            repliedAt: Date.now(),
            origin: request.threadId ? "agent" : "manual_reacherx",
            discoveredVia: "action_request",
            status: "active",
            direction: "outgoing",
            discoveredAt: Date.now(),
            lastSeenAt: Date.now(),
          });
        }
      }

      return { success: true, result: execution };
    } catch (error) {
      const failure = getXExecutionFailure(error);

      await ctx.runMutation(internal.socialActions.failActionRequestInternal, {
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
        internal.socialActions.createActionRequestNotificationInternal,
        {
          actionRequestId,
          type: "social_action_failed",
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
    mediaKinds: v.optional(
      v.array(v.union(v.literal("image"), v.literal("gif"), v.literal("video")))
    ),
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
    const source = await hydrateMissingTwitterSourcePost({
      ctx,
      userId: threadContext.userId,
      targetTweetId: args.tweetId,
      source: findSourcePostInProspect(
        threadContext.prospect ?? null,
        args.tweetId
      ),
    });
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
          eligibilityReasonCode: dmState?.eligibility.reasonCode,
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
        internal.socialActions.getPendingDmActionRequestForScope,
        {
          threadId: threadContext.threadId,
          prospectId: threadContext.prospectId,
        }
      );

      if (
        existingPendingRequest &&
        (!args.replaceExistingPending ||
          existingPendingRequest.actionKey !== args.actionKey ||
          existingPendingRequest.draftContent !==
            (args.text?.trim() || undefined))
      ) {
        if (!args.replaceExistingPending) {
          return {
            success: true,
            executed: false,
            pendingApproval: true,
            actionKey:
              existingPendingRequest.actionKey as CuratedTwitterActionKey,
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
              existingPendingRequest.draftContent ||
              args.text?.trim() ||
              undefined,
            requiresReplacementConfirmation: true,
          };
        }

        await ctx.runMutation(
          internal.socialActions.updatePendingActionRequestInternal,
          {
            actionRequestId: existingPendingRequest._id,
            actionKey: args.actionKey,
            title,
            description,
            argumentsSnapshot: {
              tweetId: args.tweetId,
              targetUserId: resolvedTargetUserIdForRequest ?? args.targetUserId,
              conversationId:
                resolvedConversationIdForRequest ?? args.conversationId,
              text: args.text,
              mediaUrls: args.mediaUrls ?? [],
              mediaDescriptions: args.mediaDescriptions ?? [],
              mediaKinds: args.mediaKinds ?? [],
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
          message:
            "Pending DM draft updated. It is ready for review and approval.",
          approvalMode: metadata.approvalMode,
          riskLevel: metadata.riskLevel,
          targetTweetId: source?.sourcePostRef?.postId ?? args.tweetId,
          sourcePostRef: source?.sourcePostRef,
          sourcePostSummary: source?.sourcePostSummary,
          sourceContext: args.context,
          draftContent: args.text?.trim() || undefined,
          replacedExisting: true,
        };
      }
    }

    const requestId = await ctx.runMutation(
      internal.socialActions.createActionRequestInternal,
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
          mediaKinds: args.mediaKinds ?? [],
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
        internal.socialActions.createActionRequestNotificationInternal,
        {
          actionRequestId: requestId,
          type: "social_action_request",
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
        targetTweetId: source?.sourcePostRef?.postId ?? args.tweetId,
        sourcePostRef: source?.sourcePostRef,
        sourcePostSummary: source?.sourcePostSummary,
        sourceContext: args.context,
        draftContent: args.text?.trim() || undefined,
      };
    }

    const executed = await ctx.runAction(
      internal.socialActionExecutors.executeActionRequestInternal,
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
        message: "Social action failed.",
        approvalMode: metadata.approvalMode,
        riskLevel: metadata.riskLevel,
        targetTweetId: source?.sourcePostRef?.postId ?? args.tweetId,
        sourcePostRef: source?.sourcePostRef,
        sourcePostSummary: source?.sourcePostSummary,
        sourceContext: args.context,
        draftContent: args.text?.trim() || undefined,
        error: executed.error,
      };
    }

    if ("duplicate" in executed) {
      return {
        success: true,
        executed: false,
        pendingApproval: false,
        actionKey: args.actionKey,
        actionRequestId: requestId,
        prospectId: threadContext.prospectId
          ? String(threadContext.prospectId)
          : undefined,
        title,
        message: "Social action is already being processed.",
        approvalMode: metadata.approvalMode,
        riskLevel: metadata.riskLevel,
        targetTweetId: source?.sourcePostRef?.postId ?? args.tweetId,
        sourcePostRef: source?.sourcePostRef,
        sourcePostSummary: source?.sourcePostSummary,
        sourceContext: args.context,
        draftContent: args.text?.trim() || undefined,
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
      message: "Social action completed.",
      approvalMode: metadata.approvalMode,
      riskLevel: metadata.riskLevel,
      targetTweetId: source?.sourcePostRef?.postId ?? args.tweetId,
      sourcePostRef: source?.sourcePostRef,
      sourcePostSummary: source?.sourcePostSummary,
      sourceContext: args.context,
      draftContent: args.text?.trim() || undefined,
      createdTweetId: result.createdTweetId,
    };
  },
});
