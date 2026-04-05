"use node";

// convex/styleAnalysisActions.ts
// Node.js actions for writing style analysis: backfill and distillation.
// Queries/mutations live in styleAnalysis.ts (standard Convex runtime).

import { internalAction } from "./lib/functionBuilders";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { acquireSocialApiBudget } from "./lib/socialApiBudget";
import { distillWritingStyleProfile } from "./lib/styleDistillation";
import { retrier } from "./lib/retrier";
import { BATCH_ANALYSIS_THRESHOLD } from "./styleAnalysis";

// ============================================================================
// Constants
// ============================================================================

const SOCIALAPI_BASE_URL = "https://api.socialapi.me";
/** Maximum backfill pages to fetch (each ~20 tweets). */
const MAX_BACKFILL_PAGES = 3;
const STYLE_ANALYSIS_PROMPT_VERSION = "style-distillation-v1";
const TIMELINE_ENDPOINTS = ["tweets", "tweets-and-replies"] as const;
const EMPTY_RETRIEVAL_STATS = {
  relevantMemories: 0,
  semanticMatches: 0,
  matchedQueries: 0,
} as const;

// ============================================================================
// Types
// ============================================================================

interface SocialApiSearchResponse {
  tweets?: Array<{
    id_str: string;
    full_text?: string;
    text?: string;
    tweet_created_at?: string;
    created_at?: string;
    retweeted_status?: unknown;
    in_reply_to_status_id_str?: string | null;
    user?: {
      id_str: string;
      screen_name: string;
    };
  }>;
  next_cursor?: string;
}

function normalizeTimelineTweet(
  tweet: NonNullable<SocialApiSearchResponse["tweets"]>[number]
): NonNullable<SocialApiSearchResponse["tweets"]>[number] {
  return {
    id_str: String(tweet.id_str),
    full_text:
      typeof tweet.full_text === "string" ? tweet.full_text : undefined,
    text: typeof tweet.text === "string" ? tweet.text : undefined,
    tweet_created_at:
      typeof tweet.tweet_created_at === "string"
        ? tweet.tweet_created_at
        : undefined,
    created_at:
      typeof tweet.created_at === "string" ? tweet.created_at : undefined,
    retweeted_status: tweet.retweeted_status ? true : undefined,
    in_reply_to_status_id_str:
      typeof tweet.in_reply_to_status_id_str === "string"
        ? tweet.in_reply_to_status_id_str
        : null,
    user:
      tweet.user &&
      typeof tweet.user.id_str === "string" &&
      typeof tweet.user.screen_name === "string"
        ? {
            id_str: tweet.user.id_str,
            screen_name: tweet.user.screen_name,
          }
        : undefined,
  };
}

type TimelineEndpoint = (typeof TIMELINE_ENDPOINTS)[number];

interface SocialApiTimelineFetchResult {
  success: boolean;
  endpoint: TimelineEndpoint;
  tweets: SocialApiSearchResponse["tweets"];
  nextCursor?: string;
  hasMore: boolean;
  error?: string;
}

export const fetchUserTimelinePage = internalAction({
  args: {
    xUserId: v.string(),
    endpoint: v.union(v.literal("tweets"), v.literal("tweets-and-replies")),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SocialApiTimelineFetchResult> => {
    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        endpoint: args.endpoint,
        tweets: [],
        hasMore: false,
        error: "SOCIALAPI_API_KEY not set",
      };
    }

    await acquireSocialApiBudget(
      ctx,
      `styleAnalysis.timeline.${args.endpoint}`
    );

    const url = new URL(
      `${SOCIALAPI_BASE_URL}/twitter/user/${args.xUserId}/${args.endpoint}`
    );
    if (args.cursor) {
      url.searchParams.set("cursor", args.cursor);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Timeline API (${args.endpoint}) returned ${response.status}: ${errorText}`
      );
    }

    const data: SocialApiSearchResponse = await response.json();
    const tweets = (data.tweets ?? []).map(normalizeTimelineTweet);

    return {
      success: true,
      endpoint: args.endpoint,
      tweets,
      nextCursor: data.next_cursor,
      hasMore: !!data.next_cursor,
    };
  },
});

async function fetchUserTimelinePageWithRetry(
  ctx: any,
  args: {
    xUserId: string;
    endpoint: TimelineEndpoint;
    cursor?: string;
  }
): Promise<SocialApiTimelineFetchResult> {
  const runId = await retrier.run(
    ctx,
    internal.styleAnalysisActions.fetchUserTimelinePage,
    args
  );

  while (true) {
    const status = await retrier.status(ctx, runId);
    if (status.type === "inProgress") {
      await new Promise((resolve) => setTimeout(resolve, 500));
      continue;
    }

    if (status.type === "completed") {
      if (status.result.type === "success") {
        return status.result.returnValue as SocialApiTimelineFetchResult;
      }

      if (status.result.type === "failed") {
        return {
          success: false,
          endpoint: args.endpoint,
          tweets: [],
          hasMore: false,
          error: `Failed after retries: ${status.result.error}`,
        };
      }
    }

    return {
      success: false,
      endpoint: args.endpoint,
      tweets: [],
      hasMore: false,
      error: "Timeline request was canceled",
    };
  }
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Backfill user's timeline from SocialAPI for initial style analysis.
 * Uses the user timeline endpoint, with a fallback to tweets-and-replies.
 */
export const backfillUserTimeline = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // 1. Get X account
    const xAccount = await ctx.runQuery(
      internal.xStore.getXAccountForUserInternal,
      { userId: args.userId }
    );

    if (!xAccount || xAccount.status !== "connected") {
      console.warn(
        `[StyleAnalysis] No connected X account for user ${args.userId}`
      );
      return;
    }

    // 2. Update backfill status
    await ctx.runMutation(internal.styleMonitors.updateBackfillStatus, {
      userId: args.userId,
      platform: "twitter",
      status: "in_progress",
    });

    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) {
      console.error("[StyleAnalysis] SOCIALAPI_API_KEY not set");
      await ctx.runMutation(internal.styleMonitors.updateBackfillStatus, {
        userId: args.userId,
        platform: "twitter",
        status: "failed",
      });
      return;
    }

    // 3. Fetch user's timeline using the dedicated user timeline endpoint.
    let allTweets: SocialApiSearchResponse["tweets"] = [];
    let endpointUsed: TimelineEndpoint | null = null;
    let lastFetchError: string | undefined;

    try {
      for (const endpoint of TIMELINE_ENDPOINTS) {
        const endpointTweets: NonNullable<SocialApiSearchResponse["tweets"]> =
          [];
        let cursor: string | undefined;
        let endpointFailed = false;

        for (
          let page = 0;
          page < MAX_BACKFILL_PAGES && endpointTweets.length < 60;
          page++
        ) {
          const result = await fetchUserTimelinePageWithRetry(ctx, {
            xUserId: xAccount.xUserId,
            endpoint,
            cursor,
          });

          if (!result.success) {
            lastFetchError = result.error;
            endpointFailed = true;
            console.warn(
              `[StyleAnalysis] Timeline fetch failed for @${xAccount.username} via ${endpoint}: ${result.error}`
            );
            break;
          }

          endpointTweets.push(...(result.tweets ?? []));
          cursor = result.nextCursor;

          if (!cursor) {
            break;
          }
        }

        if (endpointTweets.length > 0) {
          allTweets = endpointTweets;
          endpointUsed = endpoint;
          break;
        }

        if (!endpointFailed) {
          endpointUsed = endpoint;
        }
      }
    } catch (error) {
      console.error(
        `[StyleAnalysis] Backfill failed for @${xAccount.username}:`,
        error
      );
      await ctx.runMutation(internal.styleMonitors.updateBackfillStatus, {
        userId: args.userId,
        platform: "twitter",
        status: "failed",
      });
      return;
    }

    if ((allTweets?.length ?? 0) === 0) {
      console.error(
        `[StyleAnalysis] Backfill returned 0 timeline tweets for @${xAccount.username} (xUserId=${xAccount.xUserId}, lastError=${lastFetchError ?? "none"})`
      );
      await ctx.runMutation(internal.styleMonitors.updateBackfillStatus, {
        userId: args.userId,
        platform: "twitter",
        status: "failed",
      });
      return;
    }

    // 4. Ingest valid original tweets only.
    let ingestedCount = 0;
    let skippedReplies = 0;
    let skippedReposts = 0;
    let duplicateCount = 0;
    let duplicateBackfillCount = 0;
    let duplicateWebhookCount = 0;
    let duplicateProcessedCount = 0;
    let duplicateUnprocessedCount = 0;
    let tooShortCount = 0;
    let shortestRejectedLength: number | null = null;
    let longestRejectedLength = 0;
    let repeatedOriginalIdsInTimeline = 0;
    const repeatedOriginalIdSamples: string[] = [];
    const seenOriginalTweetIds = new Set<string>();
    for (const tweet of allTweets ?? []) {
      const fullText = tweet.full_text || tweet.text || "";
      const isRetweet = !!tweet.retweeted_status;
      const isReply = !!tweet.in_reply_to_status_id_str;

      if (isRetweet) {
        skippedReposts++;
        continue;
      }

      if (isReply) {
        skippedReplies++;
        continue;
      }

      if (seenOriginalTweetIds.has(tweet.id_str)) {
        repeatedOriginalIdsInTimeline++;
        if (repeatedOriginalIdSamples.length < 5) {
          repeatedOriginalIdSamples.push(tweet.id_str);
        }
        continue;
      }
      seenOriginalTweetIds.add(tweet.id_str);

      const result = await ctx.runMutation(
        internal.styleAnalysis.ingestStyleContent,
        {
          userId: args.userId,
          platform: "twitter",
          externalContentId: tweet.id_str,
          fullText,
          contentType: "original_post",
          postedAt: new Date(
            tweet.tweet_created_at || tweet.created_at || Date.now()
          ).getTime(),
          source: "backfill",
        }
      );

      if (result.inserted) {
        ingestedCount++;
        continue;
      }

      if (result.reason === "duplicate") {
        duplicateCount++;
        if (result.existingSource === "backfill") duplicateBackfillCount++;
        if (result.existingSource === "monitor_webhook") duplicateWebhookCount++;
        if (result.existingProcessedForStyle) {
          duplicateProcessedCount++;
        } else {
          duplicateUnprocessedCount++;
        }
        continue;
      }

      if (result.reason === "too_short") {
        tooShortCount++;
        const textLength =
          typeof result.textLength === "number" ? result.textLength : 0;
        shortestRejectedLength =
          shortestRejectedLength === null
            ? textLength
            : Math.min(shortestRejectedLength, textLength);
        longestRejectedLength = Math.max(longestRejectedLength, textLength);
      }
    }

    // 5. Update backfill status
    await ctx.runMutation(internal.styleMonitors.updateBackfillStatus, {
      userId: args.userId,
      platform: "twitter",
      status: "completed",
      sampleCount: ingestedCount,
    });

    console.info(
      `[StyleAnalysis] Backfill complete for @${xAccount.username} via ${
        endpointUsed ?? "unknown"
      }: raw=${allTweets.length}, skippedReplies=${skippedReplies}, skippedReposts=${skippedReposts}, repeatedOriginalIdsInTimeline=${repeatedOriginalIdsInTimeline}${
        repeatedOriginalIdSamples.length > 0
          ? `, repeatedOriginalIdSamples=${repeatedOriginalIdSamples.join(",")}`
          : ""
      }, ingested=${ingestedCount}, duplicates=${duplicateCount} (webhook=${duplicateWebhookCount}, backfill=${duplicateBackfillCount}, processed=${duplicateProcessedCount}, unprocessed=${duplicateUnprocessedCount}), tooShort=${tooShortCount}${
        tooShortCount > 0
          ? `, rejectedTextLengthRange=${shortestRejectedLength ?? 0}-${longestRejectedLength}`
          : ""
      }`
    );

    // 6. Trigger style analysis for each workspace this user owns
    const workspaces = await ctx.runQuery(
      internal.workspaces.getUserWorkspacesInternal,
      { userId: args.userId }
    );

    for (const ws of workspaces) {
      await ctx.runMutation(internal.styleAnalysis.recordStyleBackfillEvent, {
        workspaceId: ws._id,
        userId: args.userId,
        sampleCount: ingestedCount,
      });
    }
  },
});

/**
 * Build a style analysis plan for the evaluator pipeline.
 * Gathers samples and edit diffs, runs LLM distillation, returns drafts.
 */
export const buildStyleAnalysisPlan = internalAction({
  args: { eventId: v.id("memoryWorkflowEvents") },
  handler: async (ctx, args): Promise<any> => {
    // 1. Load the triggering event
    const event: any = await ctx.runQuery(
      internal.evaluator.getMemoryWorkflowEventByIdInternal,
      { eventId: args.eventId }
    );
    if (!event) {
      return {
        status: "ignored" as const,
        ignoredReason: "event_not_found",
        summary: "Style analysis event no longer exists.",
        promptVersion: STYLE_ANALYSIS_PROMPT_VERSION,
        drafts: [],
        queryPerformanceUpdates: [],
        retrievalStats: EMPTY_RETRIEVAL_STATS,
      };
    }

    const workspace: any = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: event.workspaceId,
    });
    if (!workspace) {
      return {
        status: "ignored" as const,
        ignoredReason: "workspace_not_found",
        summary: "Workspace missing for style analysis event.",
        promptVersion: STYLE_ANALYSIS_PROMPT_VERSION,
        drafts: [],
        queryPerformanceUpdates: [],
        retrievalStats: EMPTY_RETRIEVAL_STATS,
      };
    }

    // 2. Gather ALL samples for this user (processed + unprocessed for full picture)
    const allSamples = await ctx.runQuery(
      internal.styleAnalysis.getAllSamplesForUser,
      { userId: workspace.userId, limit: 100 }
    );

    // Filter to original posts and replies (not reposts)
    const usableSamples: Array<{
      fullText: string;
      contentType: string;
      postedAt: number;
      source?: string;
      processedForStyle?: boolean;
    }> = allSamples.filter((s: any) => s.contentType !== "repost");

    const sampleBreakdown = {
      allSamples: allSamples.length,
      usableSamples: usableSamples.length,
      originalPosts: usableSamples.filter((s) => s.contentType === "original_post")
        .length,
      replies: usableSamples.filter((s) => s.contentType === "reply").length,
      backfill: usableSamples.filter((s) => s.source === "backfill").length,
      monitorWebhook: usableSamples.filter((s) => s.source === "monitor_webhook")
        .length,
      processed: usableSamples.filter((s) => s.processedForStyle === true).length,
      unprocessed: usableSamples.filter((s) => s.processedForStyle === false)
        .length,
    };

    console.info(
      `[StyleAnalysis] Sample breakdown for workspace ${event.workspaceId}: all=${sampleBreakdown.allSamples}, usable=${sampleBreakdown.usableSamples}, originalPosts=${sampleBreakdown.originalPosts}, replies=${sampleBreakdown.replies}, backfill=${sampleBreakdown.backfill}, webhook=${sampleBreakdown.monitorWebhook}, processed=${sampleBreakdown.processed}, unprocessed=${sampleBreakdown.unprocessed}`
    );

    // 3. Gather edit diffs from processed style events
    const editDiffs: Array<{
      originalDraft: string;
      editedContent: string;
      diffSource: string;
    }> = await ctx.runQuery(internal.styleAnalysis.getEditDiffsForUser, {
      workspaceId: event.workspaceId,
    });

    // 4. Check thresholds
    if (
      usableSamples.length < BATCH_ANALYSIS_THRESHOLD &&
      editDiffs.length === 0
    ) {
      // Update workspace to "collecting" state
      await ctx.runMutation(internal.styleAnalysis.updateWorkspaceStyleStatus, {
        workspaceId: event.workspaceId,
        status: "collecting",
      });
      return {
        status: "ignored" as const,
        ignoredReason: "insufficient_samples",
        summary:
          "Waiting for more posts or edit corrections before learning voice.",
        promptVersion: STYLE_ANALYSIS_PROMPT_VERSION,
        drafts: [],
        queryPerformanceUpdates: [],
        retrievalStats: {
          ...EMPTY_RETRIEVAL_STATS,
          relevantMemories: editDiffs.length,
        },
      };
    }

    // 5. Update workspace status to analyzing
    await ctx.runMutation(internal.styleAnalysis.updateWorkspaceStyleStatus, {
      workspaceId: event.workspaceId,
      status: "analyzing",
    });

    // 6. Load existing profile for incremental refinement
    const existingMemories = await ctx.runQuery(
      internal.memory.findRelevantBuiltInAgentMemoriesInternal,
      {
        userId: String(workspace.userId),
        workspaceId: String(workspace._id),
        query: "writing style profile voice",
        categories: ["writing_style_profile"],
        limit: 1,
      }
    );
    const existingProfile =
      existingMemories.length > 0
        ? (existingMemories[0].parsed?.narrative ??
          existingMemories[0].promptLine)
        : undefined;

    // 7. Run distillation
    const distillation = await distillWritingStyleProfile({
      tweets: usableSamples.map((s) => ({
        text: s.fullText,
        isReply: s.contentType === "reply",
        postedAt: s.postedAt,
      })),
      editDiffs: editDiffs.map((d) => ({
        original: d.originalDraft,
        edited: d.editedContent,
        source: d.diffSource,
      })),
      existingProfile: existingProfile ?? undefined,
    });

    // 8. Return the plan for the evaluator to apply
    return {
      status: "apply" as const,
      summary: `Style profile distilled from ${usableSamples.length} samples and ${editDiffs.length} edit diffs.`,
      promptVersion: STYLE_ANALYSIS_PROMPT_VERSION,
      model: distillation.telemetry.model,
      workspaceId: String(workspace._id),
      drafts: [
        {
          source: "style_analysis",
          category: "writing_style_profile",
          title: "Writing Style Profile",
          summary: distillation.profile.profileSummary.slice(0, 320),
          confidence: distillation.profile.confidence,
          impactScore: 0.95,
          signals:
            distillation.profile.representativeSamples?.slice(0, 5) ?? [],
          evidence: [
            `Based on ${usableSamples.length} organic posts`,
            editDiffs.length > 0
              ? `and ${editDiffs.length} edit corrections`
              : "",
          ].filter(Boolean),
          relatedQueries: ["writing style", "voice", "tone"],
          narrative: distillation.profile.profileSummary,
        },
      ],
      queryPerformanceUpdates: [],
      retrievalStats: {
        relevantMemories: editDiffs.length,
        semanticMatches: usableSamples.length,
        matchedQueries: 0,
      },
      styleMetadata: {
        sampleCount: usableSamples.length,
        editDiffCount: editDiffs.length,
      },
      telemetry: distillation.telemetry,
    };
  },
});
