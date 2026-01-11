// convex/agents/outreach/tools/displayPost.ts
// Generative UI tool - Returns post data for inline rendering in chat
// Layer 1: Agent Tool (thin wrapper per AGENT_CONTEXT.txt)

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";
import { extractProspectIdFromThread } from "./helpers";

// ============================================================================
// Types
// ============================================================================

/**
 * Result type for displayPost tool.
 * The UI layer uses this to render Tweet or LinkedInPostCard components.
 */
export interface DisplayPostResult {
  success: boolean;
  platform: "twitter" | "linkedin";
  /** Full raw post data for rendering */
  postData?: unknown;
  /** Context message explaining why this post is shown */
  context?: string;
  error?: string;
}

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Display a post in the chat for user review.
 *
 * This tool returns full post data that the UI renders as an embedded
 * Tweet or LinkedIn card, making it easy for users to see the content
 * they're about to engage with.
 *
 * Use cases:
 * - Show the tweet the agent recommends replying to
 * - Display a post when asking for comment approval
 * - Preview any prospect content inline in the conversation
 */
export const displayPost = createTool({
  description:
    "Display a post/tweet inline in the chat for user review. Call this to show the user the exact content you're discussing, such as when recommending a tweet to reply to or asking for approval on a comment. This renders the full post with author info, metrics, and media.",
  args: z.object({
    postIndex: z
      .number()
      .optional()
      .describe(
        "Index of the post in the prospect's evidence posts (0-based). If not provided, shows the original discovery post."
      ),
    context: z
      .string()
      .optional()
      .describe(
        "Brief explanation of why you're showing this post, e.g. 'This is the tweet I recommend replying to'"
      ),
  }),
  handler: async (ctx, args): Promise<DisplayPostResult> => {
    console.info("[displayPost] Tool called with args:", args);

    try {
      // Extract prospectId from thread
      const prospectId = await extractProspectIdFromThread(ctx, "displayPost");

      if (!prospectId) {
        return {
          success: false,
          platform: "twitter",
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
          platform: "twitter",
          error: "Prospect not found",
        };
      }

      // Determine platform
      const platform =
        prospect.platform === "linkedin" ? "linkedin" : "twitter";

      // Get the requested post
      let postData: unknown;

      if (args.postIndex !== undefined && args.postIndex >= 0) {
        // Get specific evidence post
        const evidencePosts = prospect.evidencePosts || [];
        if (args.postIndex < evidencePosts.length) {
          postData = evidencePosts[args.postIndex];
        } else {
          return {
            success: false,
            platform,
            error: `Post index ${args.postIndex} out of range. Available posts: 0-${evidencePosts.length - 1}`,
          };
        }
      } else {
        // Default to original discovery post data
        postData = prospect.data;
      }

      if (!postData) {
        return {
          success: false,
          platform,
          error: "No post data available for this prospect",
        };
      }

      console.info("[displayPost] Returning success with postData:", {
        platform,
        hasPostData: !!postData,
        context: args.context,
      });

      return {
        success: true,
        platform,
        postData,
        context: args.context,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return {
        success: false,
        platform: "twitter",
        error: errorMessage,
      };
    }
  },
});
