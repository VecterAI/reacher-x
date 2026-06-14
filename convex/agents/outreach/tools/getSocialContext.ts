"use node";

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import {
  resolveSocialContext,
  type NormalizedSocialPost,
  type NormalizedSocialProfile,
  type ProspectSummary,
  type SocialContextActivitySummary,
  type SocialContextSelectionResult,
  type SocialThreadResult,
} from "./socialContextShared";

type AgentVisibleSocialPost = Omit<NormalizedSocialPost, "rawData">;
type AgentVisibleSocialThread = Omit<SocialThreadResult, "posts"> & {
  posts: AgentVisibleSocialPost[];
};

const socialContextModeSchema = z.enum([
  "prospect_profile",
  "platform_profile",
  "posts",
  "thread",
  "activity_summary",
]);

const socialContextPlatformSchema = z.enum(["auto", "twitter", "linkedin"]);

const socialContextSelectionSchema = z.enum([
  "latest",
  "oldest",
  "best_for_reply",
  "discovery",
]);

export interface GetSocialContextResult {
  success: boolean;
  prospect?: ProspectSummary;
  profile?: NormalizedSocialProfile;
  posts: AgentVisibleSocialPost[];
  thread?: AgentVisibleSocialThread;
  activitySummary?: SocialContextActivitySummary;
  selection?: SocialContextSelectionResult;
  resolvedPlatform?: "twitter" | "linkedin";
  error?: string;
}

function toAgentVisiblePost({
  rawData: _rawData,
  ...post
}: NormalizedSocialPost): AgentVisibleSocialPost {
  return post;
}

function toAgentVisibleThread(
  thread: SocialThreadResult | undefined
): AgentVisibleSocialThread | undefined {
  if (!thread) {
    return undefined;
  }

  return {
    ...thread,
    posts: thread.posts.map(toAgentVisiblePost),
  };
}

export const getSocialContext = createTool({
  description:
    "Fetch normalized social context for the current prospect. Use this for exact retrieval intent first: profile, platform profile, posts, latest post, oldest post, best reply candidate, post ranges, threads, and activity summaries. This tool returns structured data for reasoning; it does not decide the strategy unless you explicitly ask for selection='best_for_reply'.",
  args: z.object({
    mode: socialContextModeSchema.describe(
      "What to retrieve: prospect profile, platform-specific profile, posts, thread, or activity summary."
    ),
    platform: socialContextPlatformSchema
      .optional()
      .default("auto")
      .describe(
        "Which platform to read from. Use auto unless the user explicitly asks for Twitter/X or LinkedIn."
      ),
    selection: socialContextSelectionSchema
      .optional()
      .describe(
        "Optional post selector. Use latest or oldest for exact retrieval. Only use best_for_reply when the user asks which post is best to engage with."
      ),
    dateFrom: z
      .string()
      .optional()
      .describe("Optional ISO timestamp lower bound for post retrieval."),
    dateTo: z
      .string()
      .optional()
      .describe("Optional ISO timestamp upper bound for post retrieval."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(5)
      .describe("Maximum number of posts to return."),
    includeReplies: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether reply posts should be included when reading posts."),
    postId: z
      .string()
      .optional()
      .describe("Specific post id to use as the thread root when mode=thread."),
    query: z
      .string()
      .optional()
      .describe(
        "Optional extra reasoning context. Use this sparingly for verification or recommendation context."
      ),
  }),
  handler: async (ctx, args): Promise<GetSocialContextResult> => {
    try {
      const result = await resolveSocialContext(ctx, args);
      return {
        success: true,
        prospect: result.prospect,
        profile: result.profile,
        posts: result.posts.map(toAgentVisiblePost),
        thread: toAgentVisibleThread(result.thread),
        activitySummary: result.activitySummary,
        selection: result.selection,
        resolvedPlatform: result.resolvedPlatform,
      };
    } catch (error) {
      return {
        success: false,
        posts: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
