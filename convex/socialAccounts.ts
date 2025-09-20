"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { postReplyArgsValidator } from "./validators";
import { needsTokenRefresh } from "../shared/lib/utils/tokenValidation";
import {
  createOAuthClient,
  createTwitterClient,
  handleTwitterError,
} from "./twitterClient";
import { v } from "convex/values";

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
      }
    );

    // Immediately try to process this reply
    await ctx.scheduler.runAfter(0, api.replyQueue.processReply, { queueId });

    return { id: queueId };
  },
});

export const getXAccountAction = action({
  args: {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.log("No identity found in getXAccountAction");
      return null;
    }
    const workosUserId = identity.subject;
    console.log("Looking for user with workosUserId:", workosUserId);

    // Look up the user by workosUserId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user: any = await ctx.runQuery(api.users.getUserByWorkosId, {
      workosUserId,
    });

    if (!user) {
      console.log("User not found for workosUserId:", workosUserId);
      return null;
    }

    console.log("Found user:", user._id);

    // Get the social account by calling the action that can access the database
    const socialAccount = await ctx.runAction(
      api.socialAccountsMutations.getXAccountByUserIdAction,
      {
        userId: user._id,
      }
    );

    if (!socialAccount) {
      console.log("No X social account found for user:", user._id);
    } else {
      console.log("Found X social account:", socialAccount._id);
    }

    return socialAccount;
  },
});

export const refreshTokenIfNeeded = action({
  args: {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get user ID first
    const workosUserId = identity.subject;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user: any = await ctx.runQuery(api.users.getUserByWorkosId, {
      workosUserId,
    });
    if (!user) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const account: any = await ctx.runAction(
      api.socialAccounts.getXAccountAction,
      {}
    );
    if (!account) return null;

    // Use token validation utility instead of manual check
    if (!needsTokenRefresh(account.expiresAt)) {
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
      const {
        client: refreshedClient,
        accessToken,
        refreshToken,
        expiresIn,
      } = await client.refreshOAuth2Token(decryptedRefreshToken);

      // Update tokens in database
      await ctx.runMutation(api.socialAccountsMutations.updateXTokens, {
        accessToken,
        refreshToken,
        expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
      });

      // Try to refresh stored profile fields using new access token
      try {
        const userData = await refreshedClient.v2.me({
          "user.fields": ["profile_image_url", "name", "username"],
        });

        const u = userData.data;
        if (u?.username || u?.name || u?.profile_image_url) {
          await ctx.runMutation(api.socialAccountsMutations.updateXTokens, {
            name: u?.name,
            screenName: u?.username || account?.screenName,
            profileImageUrl: u?.profile_image_url,
          });
        }
      } catch (profileError) {
        console.warn("Failed to refresh profile data:", profileError);
        // ignore profile update failure
      }

      return await ctx.runAction(
        api.socialAccountsMutations.getXAccountByUserIdAction,
        {
          userId: user._id,
        }
      );
    } catch (error) {
      console.error("Token refresh failed:", error);

      // Use enhanced error handling
      try {
        handleTwitterError(error);
      } catch (handledError) {
        console.error("Twitter API error during token refresh:", handledError);
      }

      // Return original account if refresh fails
      return account;
    }
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
      console.error("Profile hydration failed:", error);

      // Use enhanced error handling
      try {
        handleTwitterError(error);
      } catch (handledError) {
        console.error(
          "Twitter API error during profile hydration:",
          handledError
        );
      }

      return { success: false };
    }
  },
});
