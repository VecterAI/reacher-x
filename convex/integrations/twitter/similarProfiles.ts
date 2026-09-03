"use node";

import { action, internalAction } from "../../lib/functionBuilders";
import { v } from "convex/values";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import { fetchSocialApi } from "../../lib/socialApiFetch";
import type { TwitterUser } from "./searchPosts";
import type { Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";

interface SimilarProfilesApiResponse {
  users?: TwitterUser[];
  next_cursor?: string;
}

export interface SimilarProfilesResult {
  success: boolean;
  users: TwitterUser[];
  nextCursor?: string;
  error?: string;
  stats: {
    userId: string;
    usersFound: number;
    durationMs: number;
  };
}

const SIMILAR_PROFILES_MAX_ATTEMPTS = 3;
const SIMILAR_PROFILES_RETRY_BASE_MS = 750;

function getApiKey(): string | null {
  return process.env.SOCIALAPI_API_KEY ?? null;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(attempt: number) {
  return SIMILAR_PROFILES_RETRY_BASE_MS * 2 ** attempt;
}

function formatSocialApiError(status: number, body: string): string {
  const normalizedBody = body.trim();
  const bodySnippet =
    normalizedBody.length > 200
      ? `${normalizedBody.slice(0, 197)}...`
      : normalizedBody;
  return `SocialAPI similar profiles failed (${status}): ${
    bodySnippet || `HTTP ${status}`
  }`;
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function normalizeTwitterUsers(users: TwitterUser[]): TwitterUser[] {
  const seen = new Set<string>();
  const normalized: TwitterUser[] = [];

  for (const user of users) {
    const userId =
      typeof user.id_str === "string"
        ? user.id_str
        : typeof user.id === "number"
          ? String(user.id)
          : null;
    if (!userId || seen.has(userId) || !user.screen_name) {
      continue;
    }

    seen.add(userId);
    normalized.push({
      ...user,
      id_str: userId,
    });
  }

  return normalized;
}

async function getSimilarProfilesForContext(
  ctx: ActionCtx,
  args: {
    userId: string;
    cursor?: string;
    workspaceId?: Id<"workspaces">;
  }
): Promise<SimilarProfilesResult> {
  const startTime = getCurrentUTCTimestamp();
  const apiKey = getApiKey();
  const userId = args.userId.trim();

  if (!apiKey) {
    return {
      success: false,
      users: [],
      error: "SOCIALAPI_API_KEY environment variable not set",
      stats: {
        userId,
        usersFound: 0,
        durationMs: getCurrentUTCTimestamp() - startTime,
      },
    };
  }

  if (!userId) {
    return {
      success: false,
      users: [],
      error: "Twitter user ID is required",
      stats: {
        userId,
        usersFound: 0,
        durationMs: getCurrentUTCTimestamp() - startTime,
      },
    };
  }

  for (let attempt = 0; attempt < SIMILAR_PROFILES_MAX_ATTEMPTS; attempt += 1) {
    const params = new URLSearchParams();
    if (args.cursor) {
      params.set("cursor", args.cursor);
    }
    const queryString = params.toString();
    const url = `https://api.socialapi.me/twitter/user/${encodeURIComponent(
      userId
    )}/similar${queryString ? `?${queryString}` : ""}`;

    try {
      const response = await fetchSocialApi(
        ctx,
        "twitter.similarProfiles",
        url,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        },
        args.workspaceId ? { workspaceId: args.workspaceId } : undefined
      );

      if (!response.ok) {
        const error = formatSocialApiError(
          response.status,
          await response.text()
        );
        if (
          !isRetryableStatus(response.status) ||
          attempt === SIMILAR_PROFILES_MAX_ATTEMPTS - 1
        ) {
          return {
            success: false,
            users: [],
            error,
            stats: {
              userId,
              usersFound: 0,
              durationMs: getCurrentUTCTimestamp() - startTime,
            },
          };
        }

        await delay(getRetryDelayMs(attempt));
        continue;
      }

      const data = (await response.json()) as SimilarProfilesApiResponse;
      const users = normalizeTwitterUsers(data.users ?? []);
      return {
        success: true,
        users,
        nextCursor: data.next_cursor,
        stats: {
          userId,
          usersFound: users.length,
          durationMs: getCurrentUTCTimestamp() - startTime,
        },
      };
    } catch (error) {
      if (attempt < SIMILAR_PROFILES_MAX_ATTEMPTS - 1) {
        await delay(getRetryDelayMs(attempt));
        continue;
      }

      const message =
        error instanceof Error ? error.message : "Unknown network error";
      return {
        success: false,
        users: [],
        error: `SocialAPI similar profiles failed: ${message}`,
        stats: {
          userId,
          usersFound: 0,
          durationMs: getCurrentUTCTimestamp() - startTime,
        },
      };
    }
  }

  return {
    success: false,
    users: [],
    error: "SocialAPI similar profiles failed after all retry attempts",
    stats: {
      userId,
      usersFound: 0,
      durationMs: getCurrentUTCTimestamp() - startTime,
    },
  };
}

export const getSimilarProfiles = action({
  args: {
    userId: v.string(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SimilarProfilesResult> =>
    await getSimilarProfilesForContext(ctx, args),
});

export const getSimilarProfilesForWorkspace = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.string(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SimilarProfilesResult> =>
    await getSimilarProfilesForContext(ctx, args),
});
