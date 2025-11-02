// convex/lib/keywordValidation.ts
import type { ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";
import { logger } from "../../shared/lib/logger";

/**
 * Validate a keyword by running live search and applying the non-chunked LLM filter.
 * Returns the number of kept (filtered) tweets and the original count.
 */
export async function validateKeywordWithLlmFilter(
  ctx: ActionCtx,
  keyword: string,
  exactMatch: boolean,
  userDescription?: string
): Promise<{ kept: number; originalCount: number }> {
  // Run live search for the keyword
  const search = await ctx.runAction(api.twitterSearch.searchTwitter, {
    query: keyword,
    exactMatch,
  });

  const tweets =
    search?.success && Array.isArray(search.data?.tweets)
      ? (search.data!.tweets as unknown[])
      : [];

  const originalCount = tweets.length;
  if (originalCount === 0) {
    return { kept: 0, originalCount: 0 };
  }

  try {
    const filtered = await ctx.runAction(api.llmFilter.filterTweetsWithLLM, {
      tweets: { tweets, meta: { originalCount } },
      originalQuery: keyword,
      userDescription,
    });
    const kept =
      filtered?.success && Array.isArray(filtered.data?.tweets)
        ? filtered.data!.tweets.length
        : 0;
    return { kept, originalCount };
  } catch (err) {
    logger.error("Keyword LLM validation failed", {
      keyword,
      exactMatch,
      error: err instanceof Error ? err.message : String(err),
    });
    return { kept: 0, originalCount };
  }
}
