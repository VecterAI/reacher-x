// convex/agents/outreach/tools/analyzeBestEngagement.ts
// Agent tool for fetching prospect's tweets for LLM analysis
// Thin wrapper - Layer 1 following Three-Layer Architecture

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";
import type {
  TweetDataForEngagement,
  AnalyzeBestEngagementResult,
} from "../../../lib/outreachCore";
import { extractProspectIdWithFallback } from "./helpers";

// ============================================================================
// Tool
// ============================================================================

/**
 * Fetch prospect's recent tweets for LLM analysis.
 *
 * This tool returns raw tweet data. The agent (LLM) should analyze
 * which tweet provides the best engagement opportunity based on:
 * - Relevance to prospect's pain points
 * - Natural conversation starter potential
 * - Recency and visibility opportunity
 * - Your value proposition alignment
 */
export const analyzeBestEngagement = createTool({
  description:
    "Fetch a prospect's recent tweets so you can analyze which one is the best opportunity for engagement. You will receive the raw tweet data including text, metrics, and timestamps. Use your judgment to determine which tweet provides the best opportunity based on relevance to the prospect's pain points, natural conversation potential, and visibility opportunity. The prospectId is automatically extracted from the thread - you don't need to provide it.",
  args: z.object({
    prospectId: z
      .string()
      .optional()
      .describe(
        "Optional: The ID of the prospect. If not provided, extracted from thread context."
      ),
    maxTweets: z
      .number()
      .optional()
      .default(5)
      .describe("Maximum number of tweets to return (default: 5)"),
  }),
  handler: async (ctx, args): Promise<AnalyzeBestEngagementResult> => {
    try {
      // Extract prospectId from thread if not provided or invalid
      const prospectId = await extractProspectIdWithFallback(
        ctx,
        "analyzeBestEngagement",
        args.prospectId
      );

      if (!prospectId) {
        return {
          success: false,
          prospectName: "Unknown",
          tweets: [],
          error:
            "Could not determine prospect. Please call this from a prospect thread.",
        };
      }

      // Get prospect data
      const prospect = await ctx.runQuery(
        internal.prospects.getProspectInternal,
        { prospectId }
      );

      if (!prospect) {
        return {
          success: false,
          prospectName: "Unknown",
          tweets: [],
          error: "Prospect not found",
        };
      }

      // Extract prospect info
      const prospectName =
        prospect.data?.user?.name ||
        prospect.data?.user?.screen_name ||
        prospect.title ||
        "Unknown";
      const prospectBio = prospect.data?.user?.description;

      // Collect tweets from evidence posts and original data
      const tweets: TweetDataForEngagement[] = [];

      // Add original discovery tweet
      if (prospect.data?.id_str) {
        tweets.push({
          tweetId: prospect.data.id_str,
          text: prospect.data.full_text || prospect.data.text || "",
          createdAt:
            prospect.data.tweet_created_at ||
            prospect.data.created_at ||
            new Date().toISOString(),
          metrics: {
            replyCount: prospect.data.reply_count || 0,
            likeCount: prospect.data.favorite_count || 0,
            retweetCount: prospect.data.retweet_count || 0,
          },
          isReply: !!prospect.data.in_reply_to_status_id_str,
          inReplyToScreenName: prospect.data.in_reply_to_screen_name,
        });
      }

      // Add evidence posts if available
      const evidencePosts = prospect.evidencePosts || [];
      for (const post of evidencePosts) {
        const tweetId = post.id_str || post.id;
        if (!tweetId || tweets.some((t) => t.tweetId === tweetId)) continue;

        tweets.push({
          tweetId,
          text: post.full_text || post.text || "",
          createdAt:
            post.tweet_created_at ||
            post.created_at ||
            new Date().toISOString(),
          metrics: {
            replyCount: post.reply_count || 0,
            likeCount: post.favorite_count || 0,
            retweetCount: post.retweet_count || 0,
          },
          isReply: !!post.in_reply_to_status_id_str,
          inReplyToScreenName: post.in_reply_to_screen_name,
        });

        if (tweets.length >= args.maxTweets) break;
      }

      if (tweets.length === 0) {
        return {
          success: false,
          prospectName,
          prospectBio,
          tweets: [],
          error: "No tweets available for analysis",
        };
      }

      return {
        success: true,
        prospectName,
        prospectBio,
        tweets: tweets.slice(0, args.maxTweets),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return {
        success: false,
        prospectName: "Unknown",
        tweets: [],
        error: errorMessage,
      };
    }
  },
});
