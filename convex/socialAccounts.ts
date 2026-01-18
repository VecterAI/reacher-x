"use node";

import { action } from "./_generated/server";
import { logger } from "../shared/lib/logger";
import { api } from "./_generated/api";
import { postReplyArgsValidator } from "./validators";
import {
  createOAuthClient,
  createTwitterClient,
  handleTwitterError,
  getRateLimitStatus,
} from "./twitterClient";
import { ApiResponseError } from "twitter-api-v2";
import { v } from "convex/values";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

function needsTokenRefresh(expiresAt?: number, bufferMs: number = 60_000) {
  if (!expiresAt) return false;
  const timeUntilExpiry = expiresAt - getCurrentUTCTimestamp();
  return timeUntilExpiry <= bufferMs;
}

export const postReply = action({
  args: postReplyArgsValidator,
  handler: async (ctx, args): Promise<{ id?: string } | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Add to queue for immediate processing using the new robust system
    const queueId = await ctx.runMutation(
      api.replyQueueMutations.addReplyToQueue,
      {
        tweetId: args.inReplyToTweetId,
        text: args.text,
        mediaUrls: args.mediaUrls,
        mediaDescriptions: args.mediaDescriptions,
        originalTweetAuthor: args.originalTweetAuthor,
        replyPreview: args.replyPreview,
      }
    );

    // Immediately try to process this reply
    await ctx.scheduler.runAfter(0, api.replyQueue.processReply, { queueId });

    return { id: queueId };
  },
});

// Proactive refresh for expiring tokens across all users
export const refreshExpiringTokens = action({
  args: {},

  handler: async (ctx): Promise<{ refreshed: number; failed: number }> => {
    const now = getCurrentUTCTimestamp();
    const threshold = now + 5 * 60 * 1000; // 5 minutes before expiry
    // Query is not available in actions; use a helper query to fetch expiring accounts

    const accounts: any[] = await ctx.runQuery(
      api.socialAccountsMutations.getExpiringXAccounts,
      { beforeTime: threshold }
    );

    let refreshed = 0;
    let failed = 0;
    for (const acc of accounts) {
      if (acc.provider !== "X") continue;
      if (!acc.refreshToken) continue;
      if (!acc.expiresAt || acc.expiresAt > threshold) continue;
      try {
        const decryptedRt: string = await ctx.runAction(
          api.cryptoActions.decryptToken,
          { encryptedToken: acc.refreshToken }
        );
        const client = createOAuthClient();
        const { accessToken, refreshToken, expiresIn } =
          await client.refreshOAuth2Token(decryptedRt);

        const encAT = await ctx.runAction(api.cryptoActions.encryptToken, {
          token: accessToken,
        });
        const encRT = refreshToken
          ? await ctx.runAction(api.cryptoActions.encryptToken, {
              token: refreshToken,
            })
          : undefined;

        await ctx.runMutation(
          api.socialAccountsMutations.updateXTokensByAccountId,
          {
            accountId: acc._id,
            accessToken: encAT,
            refreshToken: encRT,
            expiresAt: expiresIn ? now + expiresIn * 1000 : undefined,
          }
        );
        refreshed++;
      } catch {
        failed++;
      }
    }
    return { refreshed, failed };
  },
});

export const getXAccountAction = action({
  args: {},

  handler: async (ctx): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      logger.info("No identity found in getXAccountAction");
      return null;
    }
    const workosUserId = identity.subject;
    logger.info("Looking for user with workosUserId:", workosUserId);

    // Look up the user by workosUserId

    const user: any = await ctx.runQuery(api.users.getUserByWorkosId, {
      workosUserId,
    });

    if (!user) {
      logger.info("User not found for workosUserId:", workosUserId);
      return null;
    }

    logger.info("Found user:", user._id);

    // Get the social account by calling the action that can access the database
    const socialAccount = await ctx.runAction(
      api.socialAccountsMutations.getXAccountByUserIdAction,
      {
        userId: user._id,
      }
    );

    if (!socialAccount) {
      logger.info("No X social account found for user:", user._id);
    } else {
      logger.info("Found X social account:", socialAccount._id);
    }

    return socialAccount;
  },
});

export const refreshTokenIfNeeded = action({
  args: {},

  handler: async (ctx): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get user ID first
    const workosUserId = identity.subject;

    const user: any = await ctx.runQuery(api.users.getUserByWorkosId, {
      workosUserId,
    });
    if (!user) return null;

    const account: any = await ctx.runQuery(
      api.socialAccountsMutations.getXAccountByUserId,
      { userId: user._id }
    );
    if (!account) return null;

    if (!needsTokenRefresh(account.expiresAt as number | undefined)) {
      return account;
    }

    if (!account.refreshToken) return account;

    try {
      // Decrypt the refresh token before using it
      const decryptedRefreshToken = await ctx.runAction(
        api.cryptoActions.decryptToken,
        {
          encryptedToken: account.refreshToken as string,
        }
      );

      // Create OAuth client using twitter-api-v2
      const client = createOAuthClient();

      // Use twitter-api-v2's built-in token refresh
      const { accessToken, refreshToken, expiresIn } =
        await client.refreshOAuth2Token(decryptedRefreshToken);

      // Re-encrypt before persisting
      const encryptedAccessToken = await ctx.runAction(
        api.cryptoActions.encryptToken,
        { token: accessToken }
      );
      const encryptedRefreshToken = refreshToken
        ? await ctx.runAction(api.cryptoActions.encryptToken, {
            token: refreshToken,
          })
        : undefined;

      // Update tokens in database
      await ctx.runMutation(api.socialAccountsMutations.updateXTokens, {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: expiresIn
          ? getCurrentUTCTimestamp() + expiresIn * 1000
          : undefined,
      });

      // Return updated account
      return await ctx.runQuery(
        api.socialAccountsMutations.getXAccountByUserId,
        { userId: user._id }
      );
    } catch (error) {
      logger.error("Token refresh failed:", error);

      // Use enhanced error handling
      try {
        handleTwitterError(error);
      } catch (handledError) {
        logger.error("Twitter API error during token refresh:", handledError);
      }

      // Return original account if refresh fails
      return account;
    }
  },
});

// Refresh the user's X profile if stale. Applies TTL and respects rate-limit backoff.
export const refreshXProfileIfStale = action({
  args: {},
  handler: async (ctx): Promise<{ updated: boolean } | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Resolve user and account
    const workosUserId = identity.subject;

    const user: any = await ctx.runQuery(api.users.getUserByWorkosId, {
      workosUserId,
    });
    if (!user) return null;

    const account: any = await ctx.runQuery(
      api.socialAccountsMutations.getXAccountByUserId,
      { userId: user._id }
    );
    if (!account) return null;

    const now = getCurrentUTCTimestamp();
    const TTL_MS = 10 * 60 * 1000; // 10 minutes

    // Respect any server-side rate limit backoff window
    if (
      typeof account.rateLimitResetAt === "number" &&
      now < account.rateLimitResetAt
    ) {
      return { updated: false };
    }

    // Skip if profile is fresh enough
    if (
      typeof account.lastProfileRefreshedAt === "number" &&
      now - account.lastProfileRefreshedAt < TTL_MS
    ) {
      return { updated: false };
    }

    // Ensure token freshness if needed
    let accessTokenPlain: string | null = null;
    try {
      if (
        needsTokenRefresh(account.expiresAt as number | undefined) &&
        account.refreshToken
      ) {
        const decryptedRefreshToken: string = await ctx.runAction(
          api.cryptoActions.decryptToken,
          { encryptedToken: account.refreshToken as string }
        );
        const oauthClient = createOAuthClient();
        const {
          accessToken: newAT,
          refreshToken: newRT,
          expiresIn,
        } = await oauthClient.refreshOAuth2Token(decryptedRefreshToken);

        const encAT = await ctx.runAction(api.cryptoActions.encryptToken, {
          token: newAT,
        });
        const encRT = newRT
          ? await ctx.runAction(api.cryptoActions.encryptToken, {
              token: newRT,
            })
          : undefined;

        await ctx.runMutation(
          api.socialAccountsMutations.updateXTokensByAccountId,
          {
            accountId: account._id,
            accessToken: encAT,
            refreshToken: encRT,
            expiresAt: expiresIn ? now + expiresIn * 1000 : undefined,
          }
        );

        accessTokenPlain = newAT;
      }

      if (!accessTokenPlain) {
        // Decrypt current access token
        if (!account.accessToken) return { updated: false };
        accessTokenPlain = await ctx.runAction(api.cryptoActions.decryptToken, {
          encryptedToken: account.accessToken as string,
        });
      }

      // Call X API for the authoritative profile
      const client = createTwitterClient(accessTokenPlain);
      const me = await client.v2.me({
        "user.fields": ["profile_image_url", "name", "username"],
      });
      const u = me.data;
      if (!u) return { updated: false };

      await ctx.runMutation(
        api.socialAccountsMutations.updateXTokensByAccountId,
        {
          accountId: account._id,
          name: u.name,
          screenName: u.username,
          profileImageUrl: u.profile_image_url,
          lastProfileRefreshedAt: now,
          rateLimitResetAt: undefined,
        }
      );

      return { updated: true };
    } catch (error) {
      // If rate-limited, persist reset time to avoid further storms
      let resetAt: number | undefined;
      if (error instanceof ApiResponseError && error.rateLimit?.reset) {
        resetAt = error.rateLimit.reset * 1000;
      } else {
        try {
          const rl = await getRateLimitStatus("users/me");
          if (rl?.reset) resetAt = rl.reset * 1000;
        } catch {}
      }

      await ctx.runMutation(
        api.socialAccountsMutations.updateXTokensByAccountId,
        {
          accountId: account._id,
          rateLimitResetAt: resetAt ?? now + 60 * 1000, // fallback 60s backoff
          lastProfileRefreshedAt: account.lastProfileRefreshedAt, // unchanged
        }
      );

      // Log and convert Twitter errors for observability
      try {
        handleTwitterError(error);
      } catch (handled) {
        logger.warn("Profile refresh error:", handled);
      }

      return { updated: false };
    }
  },
});

// Return the logged-in user's live X profile via v2.me and hydrate DB
export const getCurrentXProfile = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    name: string;
    username: string;
    profile_image_url: string;
  } | null> => {
    // Trigger background refresh if needed (TTL/backoff handled inside)
    try {
      await ctx.runAction(api.socialAccounts.refreshXProfileIfStale, {});
    } catch {}

    // Return DB snapshot of profile fields via query
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const workosUserId = identity.subject;

    const user: any = await ctx.runQuery(api.users.getUserByWorkosId, {
      workosUserId,
    });
    if (!user) return null;

    const account: any = await ctx.runQuery(
      api.socialAccountsMutations.getXAccountByUserId,
      { userId: user._id }
    );
    if (!account) return null;
    return {
      name: account.name || "",
      username: account.screenName || "",
      profile_image_url: account.profileImageUrl || "",
    };
  },
});

// Secure decrypt-on-link + profile hydration
// Best practice: do external calls in actions, and write via a mutation
export const hydrateXProfileFromEncryptedToken = action({
  args: {
    encryptedAccessToken: v.string(),
    fallbackScreenName: v.optional(v.string()),
  },
  handler: async (ctx, { encryptedAccessToken, fallbackScreenName }) => {
    try {
      // Decrypt on the server in Node environment
      const accessToken: string = await ctx.runAction(
        api.cryptoActions.decryptToken,
        { encryptedToken: encryptedAccessToken }
      );

      // Create Twitter client using twitter-api-v2
      const client = createTwitterClient(accessToken);

      // Fetch the user's profile using twitter-api-v2
      const userData = await client.v2.me({
        "user.fields": ["profile_image_url", "name", "username"],
      });

      const u = userData.data;
      if (!u) return { success: false };

      await ctx.runMutation(api.socialAccountsMutations.updateXTokens, {
        name: u.name,
        screenName: u.username || fallbackScreenName,
        profileImageUrl: u.profile_image_url,
      });

      return { success: true };
    } catch (error) {
      logger.error("Profile hydration failed:", error);

      // Use enhanced error handling
      try {
        handleTwitterError(error);
      } catch (handledError) {
        logger.error(
          "Twitter API error during profile hydration:",
          handledError
        );
      }

      return { success: false };
    }
  },
});
