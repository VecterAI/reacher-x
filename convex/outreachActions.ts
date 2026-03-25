"use node";

// convex/outreachActions.ts
// Node.js runtime actions for outreach system
// Contains Composio-backed task execution for outreach actions
// Contains auto plan generation for high-score prospects (>= 90)

import { v } from "convex/values";
import { action, internalAction } from "./lib/functionBuilders";
import { internal, api, components } from "./_generated/api";
import { createThread } from "@convex-dev/agent";
import { outreachAgent } from "./agents/outreach";
import { buildOutreachAgentPrompt } from "./agents/prompts";
import { persistRawModelResponse } from "./lib/modelTelemetry";
import { outreachPlanPool } from "./lib/outreachPlanPool";
import { AUTO_PLAN_GENERATION_THRESHOLD } from "./lib/outreachCore";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { getWorkspaceUseCase } from "../shared/lib/workspaceUseCases";
import {
  getXConnectionStatusForUser,
  getXProviderContextForUser,
} from "./lib/xdkAuth";
import {
  executeCuratedTwitterAction,
  getHydratedPostsByIds,
  getHydratedTimelinePage,
  getXExecutionFailure,
} from "./lib/xdkTwitterProvider";
import { getTwitterActionCatalogEntry } from "./lib/twitterActionCatalog";
import {
  buildTwitterPostUrl,
  getTwitterConversationId,
  getTwitterPostId,
  getTwitterPostRef,
  summarizeTwitterPost,
  type TwitterConversationParticipant,
  type TwitterInteractionDiscoverySource,
  type TwitterInteractionOrigin,
  type TwitterPostRef,
  type TwitterPostSummary,
} from "../shared/lib/twitter/contracts";
import {
  X_LONG_FORM_POST_MAX_CHARS,
  X_POST_WEIGHTED_MAX,
  getPostTextLimitError,
} from "../shared/lib/twitter/xPostTextLimit";
import type { Tweet } from "../features/threads/types";

type OutreachFailureClass =
  | "reauth_required"
  | "scope_missing"
  | "duplicate_content"
  | "rate_limited"
  | "transient_network"
  | "api_policy_forbidden"
  | "content_too_long"
  | "target_not_found"
  | "unknown_error";

type StructuredOutreachError = {
  classification: OutreachFailureClass;
  message: string;
  retryable: boolean;
  suggestion?: string;
  code?: number;
  details?: unknown;
};

type ExecuteCommentTaskResult =
  | {
      success: true;
      tweetId: string;
      attemptId: string;
    }
  | {
      success: false;
      errorClass: OutreachFailureClass;
      errorMessage: string;
      retryable: boolean;
      attemptId: string;
    };

function getAttemptId(): string {
  return `${getCurrentUTCTimestamp()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseTwitterError(error: unknown): StructuredOutreachError {
  const xFailure = getXExecutionFailure(error);
  if (xFailure) {
    return {
      classification: xFailure.classification,
      message: xFailure.message,
      retryable: xFailure.retryable,
      suggestion: xFailure.suggestion,
      code: xFailure.code,
      details: xFailure.details,
    };
  }

  if (error instanceof Error) {
    const normalized = error.message.toLowerCase();
    if (
      normalized.includes("timeout") ||
      normalized.includes("timed out") ||
      normalized.includes("econnreset") ||
      normalized.includes("enotfound") ||
      normalized.includes("network")
    ) {
      return {
        classification: "transient_network",
        message: error.message,
        retryable: true,
      };
    }
    return {
      classification: "unknown_error",
      message: error.message,
      retryable: false,
    };
  }

  return {
    classification: "unknown_error",
    message: "An unknown error occurred",
    retryable: false,
  };
}

/**
 * Execute comment task (internal action, for workflow).
 *
 * Posts a reply to a target tweet using the user's linked X account.
 * Handles errors gracefully and stores detailed error information
 * for the agent to retrieve and potentially fix.
 */
export const executeCommentTask = internalAction({
  args: {
    taskId: v.id("outreachTasks"),
    planId: v.id("outreachPlans"),
    workflowId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ExecuteCommentTaskResult> => {
    const attemptId = getAttemptId();
    const bridgeStatusMessage = async () => {
      try {
        await ctx.runAction(internal.chat.bridgeOutreachTaskStatusToThread, {
          taskId: args.taskId,
        });
      } catch (bridgeError) {
        console.warn(
          `[Outreach] Failed to bridge task status for task ${args.taskId}`,
          bridgeError
        );
      }
    };

    // Get task details
    const task = await ctx.runQuery(internal.outreach.getTaskInternal, {
      taskId: args.taskId,
    });

    if (!task) {
      throw new Error("Task not found");
    }

    if (!task.targetTweetId || !task.content) {
      throw new Error("Task missing required data for comment");
    }

    const planData = await ctx.runQuery(internal.outreach.getPlanInternal, {
      planId: args.planId,
    });
    const planUserId = planData?.plan.userId;
    if (!planUserId) {
      throw new Error("Plan not found");
    }
    const limit = await ctx.runQuery(
      internal.xPostLimits.getEffectivePostLimitInternal,
      { userId: planUserId }
    );
    const postLimitErr = getPostTextLimitError(task.content, limit);
    if (postLimitErr) {
      const errorDetails: StructuredOutreachError = {
        classification: "content_too_long",
        message: postLimitErr,
        retryable: false,
        suggestion:
          limit.mode === "short"
            ? `Shorten the reply to at most ${X_POST_WEIGHTED_MAX} weighted characters (URLs count as fewer raw characters on X).`
            : `Shorten the reply to at most ${X_LONG_FORM_POST_MAX_CHARS} characters.`,
      };

      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "failed",
        errorMessage: errorDetails.message,
        resultData: {
          error: {
            ...errorDetails,
            attemptId,
          },
        },
      });

      await bridgeStatusMessage();
      return {
        success: false,
        errorClass: errorDetails.classification,
        errorMessage: errorDetails.message,
        retryable: false,
        attemptId,
      };
    }

    const { plan } = planData;

    try {
      console.info(
        `[Outreach] Posting reply via XDK to tweet ${task.targetTweetId}: "${task.content.substring(0, 50)}..."`
      );

      const entry = getTwitterActionCatalogEntry("reply_to_post");
      const provider = await getXProviderContextForUser(ctx, internal.xStore, {
        userId: plan.userId,
        requiredScopes: entry.requiredScopes,
      });
      const result = await executeCuratedTwitterAction(provider, {
        actionKey: "reply_to_post",
        toolSlug: entry.toolSlug,
        toolVersion: entry.toolVersion,
        tweetId: task.targetTweetId,
        text: task.content,
        mediaUrls: task.mediaUrls || [],
      });

      if (!result.createdTweetId) {
        throw new Error(
          "Composio reply succeeded but did not return a created tweet id."
        );
      }

      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "waiting_response",
        resultData: {
          postedTweetId: result.createdTweetId,
          postedAt: getCurrentUTCTimestamp(),
          postedText: result.postedText || task.content,
          postedMediaUrls: task.mediaUrls || [],
          postedMediaDescriptions: task.mediaDescriptions || [],
          postedBy: {
            name: "You",
          },
          attemptId,
          text: result.postedText || task.content,
          xdk: {
            toolSlug: result.toolSlug,
            toolVersion: result.toolVersion,
          },
        },
      });

      const connectionStatus = await getXConnectionStatusForUser(
        ctx,
        internal.xStore,
        plan.userId
      );
      const sourcePostRef =
        task.approvalContext?.sourcePostRef ??
        ({
          platform: "twitter",
          postId: task.targetTweetId,
          conversationId:
            task.approvalContext?.sourcePostRef?.conversationId ??
            task.targetTweetId,
        } satisfies TwitterPostRef);
      const replyPostRef = {
        platform: "twitter" as const,
        postId: result.createdTweetId,
        conversationId:
          sourcePostRef.conversationId ??
          getTwitterConversationId(sourcePostRef),
        authorHandle: connectionStatus.screenName,
        url: buildTwitterPostUrl({
          postId: result.createdTweetId,
          authorHandle: connectionStatus.screenName,
        }),
      };

      await ctx.runMutation(internal.outreach.upsertTwitterInteraction, {
        userId: plan.userId,
        prospectId: plan.prospectId,
        sourcePostRef,
        sourcePostSummary: task.approvalContext?.sourcePostSummary,
        replyPostRef,
        replyPostSummary: {
          platform: "twitter",
          ref: replyPostRef,
          url: replyPostRef.url!,
          textPreview: result.postedText || task.content,
          createdAt: getCurrentUTCTimestamp(),
          author:
            connectionStatus.screenName || connectionStatus.name
              ? {
                  handle: connectionStatus.screenName,
                  name: connectionStatus.name,
                  avatarUrl: connectionStatus.profileImageUrl,
                }
              : undefined,
        },
        threadId: sourcePostRef.conversationId ?? sourcePostRef.postId,
        repliedAt: getCurrentUTCTimestamp(),
        origin: "agent",
        discoveredVia: "outreach_task",
        participants: [
          {
            handle: connectionStatus.screenName,
            name: connectionStatus.name ?? "You",
            avatarUrl: connectionStatus.profileImageUrl,
            isViewer: true,
          },
        ],
      });

      console.info(
        `[Outreach] planId=${args.planId} workflowId=${args.workflowId ?? "unknown"} taskId=${args.taskId} attemptId=${attemptId} postedTweetId=${result.createdTweetId}`
      );

      await bridgeStatusMessage();
      return {
        success: true,
        tweetId: result.createdTweetId,
        attemptId,
      };
    } catch (error) {
      const errorDetails = parseTwitterError(error);

      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "failed",
        errorMessage: errorDetails.message,
        resultData: {
          error: {
            ...errorDetails,
            attemptId,
          },
        },
      });

      console.error(
        `[Outreach] planId=${args.planId} workflowId=${args.workflowId ?? "unknown"} taskId=${args.taskId} attemptId=${attemptId} failed class=${errorDetails.classification} message=${errorDetails.message}`
      );

      if (errorDetails.retryable) {
        throw new Error(
          `${errorDetails.classification}:${args.planId}:${args.taskId}:${attemptId}:${errorDetails.message}`
        );
      }

      await bridgeStatusMessage();
      return {
        success: false,
        errorClass: errorDetails.classification,
        errorMessage: errorDetails.message,
        retryable: false,
        attemptId,
      };
    }
  },
});

// ============================================================================
// Public Actions
// ============================================================================

interface InteractionParticipant {
  name: string;
  username: string;
  avatarUrl?: string;
}

/**
 * Formatted interaction for UI
 */
interface FormattedInteraction {
  id: string;
  originalPost: unknown;
  participants: InteractionParticipant[];
  threadId: string;
  repliedAt: number;
  sourcePostRef?: TwitterPostRef | null;
  sourcePostSummary?: TwitterPostSummary | null;
  replyPostRef?: TwitterPostRef | null;
  replyPostSummary?: TwitterPostSummary | null;
  origin: TwitterInteractionOrigin;
  discoveredVia: TwitterInteractionDiscoverySource;
  lastReplyPreview?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

function normalizeHandle(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/^@/, "").toLowerCase();
  return normalized ? normalized : undefined;
}

function getProspectTwitterIdentity(prospect: Record<string, unknown>): {
  userId?: string;
  handle?: string;
  name?: string;
  avatarUrl?: string;
} {
  const data = asRecord(prospect.data);
  const user = asRecord(data?.user);
  const author = asRecord(data?.author);
  const source = user ?? author ?? data;

  const firstSummary = collectProspectTwitterSourcePosts(prospect)[0]?.summary;

  return {
    userId:
      pickString(source?.id_str, source?.id, firstSummary?.author?.id) ??
      undefined,
    handle:
      normalizeHandle(
        pickString(
          source?.screen_name,
          source?.username,
          source?.handle,
          firstSummary?.author?.handle
        )
      ) ?? undefined,
    name: pickString(
      source?.name,
      firstSummary?.author?.name,
      prospect.displayName
    ),
    avatarUrl: pickString(
      source?.profile_image_url_https,
      source?.profile_image_url,
      firstSummary?.author?.avatarUrl
    ),
  };
}

function isTweetAuthoredByProspect(options: {
  tweet: unknown;
  prospectHandle?: string;
  prospectUserId?: string;
}): boolean {
  const tweetRecord = asRecord(options.tweet);
  const user = asRecord(tweetRecord?.user);
  const tweetHandle = normalizeHandle(
    pickString(user?.screen_name, user?.username, user?.handle)
  );
  const tweetUserId = pickString(user?.id_str, user?.id);

  if (
    options.prospectUserId &&
    tweetUserId &&
    tweetUserId === options.prospectUserId
  ) {
    return true;
  }

  return Boolean(
    options.prospectHandle && tweetHandle === options.prospectHandle
  );
}

function buildInteractionParticipants(input: {
  sourceTweet?: unknown;
  prospectHandle?: string;
  prospectName?: string;
  prospectAvatarUrl?: string;
  viewerHandle?: string;
  viewerName?: string;
  viewerAvatarUrl?: string;
}): TwitterConversationParticipant[] {
  const participants = new Map<string, TwitterConversationParticipant>();

  const sourceUser = asRecord(asRecord(input.sourceTweet)?.user);
  const sourceHandle = normalizeHandle(
    pickString(
      sourceUser?.screen_name,
      sourceUser?.username,
      sourceUser?.handle
    )
  );
  const sourceId = pickString(sourceUser?.id_str, sourceUser?.id);
  if (sourceHandle || sourceId) {
    participants.set(sourceId ?? sourceHandle!, {
      id: sourceId,
      handle: sourceHandle,
      name: pickString(sourceUser?.name, input.prospectName),
      avatarUrl: pickString(
        sourceUser?.profile_image_url_https,
        sourceUser?.profile_image_url,
        input.prospectAvatarUrl
      ),
    });
  } else if (input.prospectHandle || input.prospectName) {
    participants.set(input.prospectHandle ?? "prospect", {
      handle: input.prospectHandle,
      name: input.prospectName ?? input.prospectHandle ?? "Prospect",
      avatarUrl: input.prospectAvatarUrl,
    });
  }

  if (input.viewerHandle || input.viewerName) {
    participants.set(input.viewerHandle ?? "viewer", {
      handle: input.viewerHandle,
      name: input.viewerName ?? input.viewerHandle ?? "You",
      avatarUrl: input.viewerAvatarUrl,
      isViewer: true,
    });
  }

  return Array.from(participants.values());
}

async function collectViewerTimelineTweets(
  provider: Awaited<ReturnType<typeof getXProviderContextForUser>>,
  viewerUserId: string,
  mode: "replies" | "quotes"
): Promise<unknown[]> {
  const tweets: unknown[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 4; page += 1) {
    const result = await getHydratedTimelinePage(provider, {
      userId: viewerUserId,
      mode,
      cursor,
      maxResults: 20,
    });
    tweets.push(...result.tweets);
    cursor = result.nextCursor;
    if (!cursor) {
      break;
    }
  }

  return Array.from(
    new Map(
      tweets
        .map((tweet) => {
          const tweetId = getTwitterPostId(tweet);
          return tweetId ? ([tweetId, tweet] as const) : null;
        })
        .filter((entry): entry is readonly [string, unknown] => entry !== null)
    ).values()
  );
}

function pickRelevantSourceTweet(input: {
  viewerTweet: unknown;
  rootTweet?: unknown;
  parentTweet?: unknown;
  quotedTweet?: unknown;
  prospectHandle?: string;
  prospectUserId?: string;
}): unknown | undefined {
  if (
    input.quotedTweet &&
    isTweetAuthoredByProspect({
      tweet: input.quotedTweet,
      prospectHandle: input.prospectHandle,
      prospectUserId: input.prospectUserId,
    })
  ) {
    return input.quotedTweet;
  }

  if (
    input.parentTweet &&
    isTweetAuthoredByProspect({
      tweet: input.parentTweet,
      prospectHandle: input.prospectHandle,
      prospectUserId: input.prospectUserId,
    })
  ) {
    return input.parentTweet;
  }

  if (
    input.rootTweet &&
    isTweetAuthoredByProspect({
      tweet: input.rootTweet,
      prospectHandle: input.prospectHandle,
      prospectUserId: input.prospectUserId,
    })
  ) {
    return input.rootTweet;
  }

  const directReplyHandle = normalizeHandle(
    pickString(asRecord(input.viewerTweet)?.in_reply_to_screen_name)
  );
  const directReplyUserId = pickString(
    asRecord(input.viewerTweet)?.in_reply_to_user_id_str,
    asRecord(input.viewerTweet)?.in_reply_to_user_id
  );
  if (
    (input.prospectHandle && directReplyHandle === input.prospectHandle) ||
    (input.prospectUserId &&
      directReplyUserId &&
      directReplyUserId === input.prospectUserId)
  ) {
    return input.parentTweet ?? input.rootTweet;
  }

  return undefined;
}

function collectProspectTwitterSourcePosts(
  prospect: Record<string, unknown>
): Array<{ ref: TwitterPostRef; summary?: TwitterPostSummary }> {
  const candidates: unknown[] = [];

  candidates.push(prospect.data);
  candidates.push(...asArray(prospect.evidencePosts));

  const finance = asRecord(prospect.finance);
  candidates.push(...asArray(finance?.evidencePosts));

  for (const painPoint of asArray(prospect.painPoints)) {
    const record = asRecord(painPoint);
    candidates.push(...asArray(record?.evidencePosts));
  }

  const seen = new Set<string>();
  const normalized: Array<{
    ref: TwitterPostRef;
    summary?: TwitterPostSummary;
  }> = [];

  for (const candidate of candidates) {
    const ref = getTwitterPostRef(candidate);
    if (!ref || seen.has(ref.postId)) {
      continue;
    }
    seen.add(ref.postId);
    normalized.push({
      ref,
      summary: summarizeTwitterPost(candidate),
    });
  }

  return normalized;
}

async function fetchConversationTweets(
  ctx: any,
  originalTweetId: string
): Promise<unknown[]> {
  const threadResult = await ctx.runAction(
    internal.integrations.twitter.getThread.getThread,
    { threadId: originalTweetId }
  );
  const originalTweet =
    threadResult.success && threadResult.tweets?.length
      ? threadResult.tweets[0]
      : null;

  const searchResult = await ctx.runAction(
    internal.integrations.twitter.searchPosts.searchInternal,
    { query: `conversation_id:${originalTweetId}` }
  );

  const replies =
    searchResult.success && Array.isArray(searchResult.posts)
      ? searchResult.posts
      : [];

  const combined: unknown[] = [];
  if (originalTweet) {
    combined.push(originalTweet);
  }
  combined.push(...replies);

  const deduped = new Map<string, unknown>();
  for (const tweet of combined) {
    const tweetId = getTwitterPostId(tweet);
    if (!tweetId || deduped.has(tweetId)) {
      continue;
    }
    deduped.set(tweetId, tweet);
  }

  return Array.from(deduped.values()).sort((a, b) => {
    const aSummary = summarizeTwitterPost(a);
    const bSummary = summarizeTwitterPost(b);
    return (aSummary?.createdAt ?? 0) - (bSummary?.createdAt ?? 0);
  });
}

export const reconcileProspectInteractions = internalAction({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }): Promise<{ syncedCount: number }> => {
    const prospect = await ctx.runQuery(
      internal.prospects.getProspectInternal,
      {
        prospectId,
      }
    );

    if (!prospect || prospect.platform !== "twitter") {
      return { syncedCount: 0 };
    }

    const connectionStatus = await getXConnectionStatusForUser(
      ctx,
      internal.xStore,
      prospect.userId
    );
    if (!connectionStatus.isConnected) {
      return { syncedCount: 0 };
    }

    if (!connectionStatus.xUserId) {
      return { syncedCount: 0 };
    }

    const prospectIdentity = getProspectTwitterIdentity(prospect);
    if (!prospectIdentity.handle && !prospectIdentity.userId) {
      return { syncedCount: 0 };
    }

    try {
      const provider = await getXProviderContextForUser(ctx, internal.xStore, {
        userId: prospect.userId,
        requiredScopes: ["tweet.read", "users.read"],
      });

      const viewerTweets = Array.from(
        new Map(
          [
            ...(await collectViewerTimelineTweets(
              provider,
              connectionStatus.xUserId,
              "replies"
            )),
            ...(await collectViewerTimelineTweets(
              provider,
              connectionStatus.xUserId,
              "quotes"
            )),
          ]
            .map((tweet) => {
              const tweetId = getTwitterPostId(tweet);
              return tweetId ? ([tweetId, tweet] as const) : null;
            })
            .filter(
              (entry): entry is readonly [string, unknown] => entry !== null
            )
        ).values()
      );

      const lookupIds = Array.from(
        new Set(
          viewerTweets.flatMap((tweet) => {
            const record = asRecord(tweet);
            return [
              pickString(record?.conversation_id_str),
              pickString(record?.in_reply_to_status_id_str),
              pickString(record?.quoted_status_id_str),
            ].filter((value): value is string => Boolean(value));
          })
        )
      );
      const lookupTweets =
        lookupIds.length > 0
          ? await getHydratedPostsByIds(provider, lookupIds)
          : [];
      const lookupEntries = lookupTweets
        .map((tweet) => {
          const tweetId = getTwitterPostId(tweet);
          return tweetId ? ([tweetId, tweet] as const) : null;
        })
        .filter((entry): entry is readonly [string, Tweet] => entry !== null);
      const lookupMap = new Map(lookupEntries);

      let syncedCount = 0;
      for (const viewerTweet of viewerTweets) {
        const record = asRecord(viewerTweet);
        const sourceTweet = pickRelevantSourceTweet({
          viewerTweet,
          rootTweet: pickString(record?.conversation_id_str)
            ? lookupMap.get(pickString(record?.conversation_id_str)!)
            : undefined,
          parentTweet: pickString(record?.in_reply_to_status_id_str)
            ? lookupMap.get(pickString(record?.in_reply_to_status_id_str)!)
            : undefined,
          quotedTweet:
            record?.quoted_status ??
            (pickString(record?.quoted_status_id_str)
              ? lookupMap.get(pickString(record?.quoted_status_id_str)!)
              : undefined),
          prospectHandle: prospectIdentity.handle,
          prospectUserId: prospectIdentity.userId,
        });

        const sourceRef = getTwitterPostRef(sourceTweet);
        const replyRef = getTwitterPostRef(viewerTweet);
        if (!sourceRef || !replyRef) {
          continue;
        }

        const sourceSummary = summarizeTwitterPost(sourceTweet);
        const replySummary = summarizeTwitterPost(viewerTweet);
        await ctx.runMutation(internal.outreach.upsertTwitterInteraction, {
          userId: prospect.userId,
          prospectId,
          sourcePostRef: sourceRef,
          sourcePostSummary: sourceSummary,
          replyPostRef: replyRef,
          replyPostSummary: replySummary,
          threadId: sourceRef.conversationId ?? sourceRef.postId,
          repliedAt: replySummary?.createdAt ?? getCurrentUTCTimestamp(),
          origin: "external_x",
          discoveredVia: "live_reconcile",
          participants: buildInteractionParticipants({
            sourceTweet,
            prospectHandle: prospectIdentity.handle,
            prospectName: prospectIdentity.name,
            prospectAvatarUrl: prospectIdentity.avatarUrl,
            viewerHandle: normalizeHandle(connectionStatus.screenName),
            viewerName: connectionStatus.name,
            viewerAvatarUrl: connectionStatus.profileImageUrl,
          }),
        });
        syncedCount += 1;
      }

      return { syncedCount };
    } catch (error) {
      console.error(
        `[Outreach] Failed viewer-first interaction discovery for prospect ${prospectId}:`,
        error
      );
      return { syncedCount: 0 };
    }
  },
});

/**
 * Public action to fetch prospect interactions with tweet data.
 * This is the public wrapper that UI components call.
 */
export const fetchProspectInteractions = action({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }): Promise<FormattedInteraction[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const prospect = await ctx.runQuery(api.prospects.getProspect, {
      prospectId,
    });
    if (!prospect) {
      throw new Error("Not authorized to view this prospect");
    }

    await ctx.runAction(
      internal.outreachActions.reconcileProspectInteractions,
      {
        prospectId,
      }
    );

    return (await ctx.runQuery(api.outreach.getProspectInteractions, {
      prospectId,
    })) as FormattedInteraction[];
  },
});

/**
 * Result from fetchConversationReplies
 */
interface ConversationResult {
  success: boolean;
  tweets: unknown[];
  error?: string;
}

/**
 * Fetch a full conversation (original tweet + all replies) using the
 * SocialAPI `conversation_id:TWEET_ID` search operator.
 *
 * This returns cross-user replies (our reply + prospect's response),
 * unlike the thread endpoint which only returns same-author threads.
 */
export const fetchConversationReplies = action({
  args: {
    originalTweetId: v.string(),
    prospectId: v.optional(v.id("prospects")),
  },
  handler: async (
    ctx,
    { originalTweetId, prospectId }
  ): Promise<ConversationResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, tweets: [], error: "Not authenticated" };
    }

    if (prospectId) {
      const prospect = await ctx.runQuery(api.prospects.getProspect, {
        prospectId,
      });
      if (!prospect) {
        return {
          success: false,
          tweets: [],
          error: "Not authorized to view this prospect",
        };
      }
    }

    try {
      return {
        success: true,
        tweets: await fetchConversationTweets(ctx, originalTweetId),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[Outreach] Error fetching conversation for ${originalTweetId}:`,
        errorMessage
      );
      return { success: false, tweets: [], error: errorMessage };
    }
  },
});

// ============================================================================
// Auto Outreach Plan Generation (for >= 90 score prospects)
// ============================================================================

/**
 * Enqueue auto plan generation via Workpool.
 * Called by enrichment workflow for >= 90 score prospects.
 * This is the entry point - follows startQualification/startEnrichment pattern.
 *
 * Per AGENT_CONTEXT.txt lines 140-148: Uses *Pool.ts naming convention
 */
export const startAutoPlanGeneration = internalAction({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{ workId: string }> => {
    const workId = await outreachPlanPool.enqueueAction(
      ctx,
      internal.outreachActions.runAutoPlanGeneration,
      args
    );

    console.info(
      `[OutreachPlan] Enqueued workId ${workId} for prospect ${args.prospectId}`
    );

    return { workId: workId.toString() };
  },
});

/** Return type for runAutoPlanGeneration */
type AutoPlanGenerationResult =
  | { success: false; reason: string }
  | {
      success: true;
      planId?: string;
      threadId?: string;
      finishReason?: string;
    };

/**
 * Execute auto plan generation for a single prospect.
 * Called by Workpool - runs in parallel with other plan generations.
 *
 * Flow:
 * 1. Create thread for prospect (title: "outreach:{prospectId}")
 * 2. Generate plan using outreach agent
 * 3. Update status to completed/failed
 */
export const runAutoPlanGeneration = internalAction({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<AutoPlanGenerationResult> => {
    const startTime = getCurrentUTCTimestamp();

    try {
      // 1. Verify prospect still qualifies for auto plan generation
      const prospect = await ctx.runQuery(
        internal.prospects.getProspectInternal,
        { prospectId: args.prospectId }
      );

      if (!prospect) {
        throw new Error("Prospect not found");
      }

      if (prospect.status === "archived") {
        await ctx.runMutation(internal.prospects.updatePlanGenerationStatus, {
          prospectId: args.prospectId,
          status: "idle",
        });
        return { success: false, reason: "Prospect archived" };
      }

      // Skip if score is below threshold (could have been updated)
      if (
        prospect.qualificationScore === undefined ||
        prospect.qualificationScore < AUTO_PLAN_GENERATION_THRESHOLD
      ) {
        console.info(
          `[OutreachPlan] Skipping auto plan for prospect ${args.prospectId} - score ${prospect.qualificationScore} below threshold ${AUTO_PLAN_GENERATION_THRESHOLD}`
        );
        await ctx.runMutation(internal.prospects.updatePlanGenerationStatus, {
          prospectId: args.prospectId,
          status: "idle",
        });
        return { success: false, reason: "Score below threshold" };
      }

      // 2. Check if plan already exists
      const existingPlan = await ctx.runQuery(
        internal.outreach.getProspectActivePlanInternal,
        { prospectId: args.prospectId }
      );

      if (existingPlan) {
        console.info(
          `[OutreachPlan] Plan already exists for prospect ${args.prospectId}`
        );
        await ctx.runMutation(internal.prospects.updatePlanGenerationStatus, {
          prospectId: args.prospectId,
          status: "completed",
        });
        return { success: true, planId: existingPlan.plan._id };
      }

      const workspace = await ctx.runQuery(internal.workspaces.getById, {
        workspaceId: args.workspaceId,
      });
      const useCase = getWorkspaceUseCase(workspace?.useCaseKey);
      const entitySingularLower = useCase.entitySingular.toLowerCase();

      // 3. Create thread for prospect
      const threadId = await createThread(ctx, components.agent, {
        userId: args.userId,
        title: `outreach:${args.prospectId}`,
        summary: `Auto-generated outreach plan for high-match ${entitySingularLower}`,
      });

      await ctx.runMutation(internal.prospectThreads.ensureThreadLink, {
        prospectId: args.prospectId,
        threadId,
        userId: args.userId,
      });

      console.info(
        `[OutreachPlan] Created thread ${threadId} for prospect ${args.prospectId}`
      );

      // 4. Generate plan using outreach agent
      const prospectName = prospect.displayName || "this prospect";
      const prospectTitle = prospect.title || "prospect";

      const prompt = `Generate an outreach plan for ${prospectName} (${prospectTitle}).

This is a high-match ${entitySingularLower} with a ${prospect.qualificationScore}% fit score. Create a personalized, non-spammy engagement strategy for the "${useCase.displayName}" workspace.

Please:
1. First use getProspectContext to understand their background and pain points
2. Then use analyzeBestEngagement to find the best tweet to engage with
3. Finally use generatePlan to create a tailored outreach plan with specific, personalized content

Remember: Quality over quantity. The goal is genuine connection, not spam, and success in this workspace means ${useCase.promptContext.successDefinition}.`;

      let finishReason: string | undefined;
      const result = await outreachAgent.streamText(
        ctx,
        { threadId },
        {
          prompt,
          system: buildOutreachAgentPrompt(useCase),
        },
        {
          saveStreamDeltas: {
            chunking: "word",
            throttleMs: 100,
          },
        }
      );
      await result.consumeStream();
      await persistRawModelResponse(ctx, {
        userId: prospect.userId,
        threadId,
        agentName: "Outreach Agent",
        request: result.request,
        response: result.response,
        providerMetadata: result.providerMetadata,
      });
      finishReason = await result.finishReason;

      // 5. Update status to completed
      await ctx.runMutation(internal.prospects.updatePlanGenerationStatus, {
        prospectId: args.prospectId,
        status: "completed",
      });

      const duration = getCurrentUTCTimestamp() - startTime;
      console.info(
        `[OutreachPlan] Auto-generated plan for prospect ${args.prospectId} in ${duration}ms`
      );

      return {
        success: true,
        threadId,
        finishReason,
      };
    } catch (error) {
      // Update status to failed
      await ctx.runMutation(internal.prospects.updatePlanGenerationStatus, {
        prospectId: args.prospectId,
        status: "failed",
      });

      const duration = getCurrentUTCTimestamp() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error(
        `[OutreachPlan] Failed for prospect ${args.prospectId} after ${duration}ms:`,
        errorMessage
      );

      // Re-throw for Workpool retry
      throw error;
    }
  },
});
