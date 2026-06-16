"use node";

// convex/integrations/twitter/getThread.ts
// Fetch Twitter thread/conversation via SocialAPI

import { action, internalAction } from "../../lib/functionBuilders";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { acquireSocialApiBudget } from "../../lib/socialApiBudget";
import { logger } from "../../../shared/lib/logger";
const twitterThreadLogger = logger.withScope("TwitterGetThread");

// Tweet type matches the SocialAPI response structure
// Re-declared here to avoid cross-runtime imports

// ============================================================================
// Types
// ============================================================================

/** Thread response from SocialAPI */
interface ThreadResponse {
  tweets: unknown[];
  next_cursor?: string;
}

/** Result from getThread action */
export interface ThreadResult {
  success: boolean;
  tweets?: unknown[];
  nextCursor?: string;
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getApiKey(): string | null {
  return process.env.SOCIALAPI_API_KEY ?? null;
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Fetch Twitter thread by thread ID.
 * Returns all tweets in the thread, paginated if needed.
 *
 * @see docs/socialapi/thread.md
 */
export const getThread = internalAction({
  args: {
    threadId: v.string(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ThreadResult> => {
    const apiKey = getApiKey();

    if (!apiKey) {
      return {
        success: false,
        error: "SOCIALAPI_API_KEY environment variable not set",
      };
    }

    if (!args.threadId) {
      return {
        success: false,
        error: "threadId is required",
      };
    }

    try {
      const url = new URL(
        `https://api.socialapi.me/twitter/thread/${args.threadId}`
      );
      if (args.cursor) {
        url.searchParams.set("cursor", args.cursor);
      }

      await acquireSocialApiBudget(ctx, "twitter.getThread");
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        twitterThreadLogger.error("Thread fetch failed", {
          threadId: args.threadId,
          status: response.status,
          errorText,
        });

        if (response.status === 404) {
          return {
            success: false,
            error: "Thread not found",
          };
        }

        return {
          success: false,
          error: `Failed to fetch thread: ${response.status}`,
        };
      }

      const data: ThreadResponse = await response.json();

      return {
        success: true,
        tweets: data.tweets || [],
        nextCursor: data.next_cursor,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      twitterThreadLogger.error(
        "Thread fetch error",
        { threadId: args.threadId },
        error instanceof Error ? error : new Error(String(errorMessage))
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

/**
 * Public action to fetch a Twitter thread.
 * Used by UI components like ConversationPanel.
 */
export const fetchTwitterThread = action({
  args: {
    threadId: v.string(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ThreadResult> => {
    // Verify user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Call the internal action using proper Convex API reference
    return await ctx.runAction(
      internal.integrations.twitter.getThread.getThread,
      {
        threadId: args.threadId,
        cursor: args.cursor,
      }
    );
  },
});
