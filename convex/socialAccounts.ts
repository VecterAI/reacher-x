import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import {
  linkXAccountArgsValidator,
  postReplyArgsValidator,
  updateXTokensArgsValidator,
} from "./validators";

export const getUserSocialAccounts = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const workosUserId = identity.subject;

    // Look up the user by workosUserId instead of using normalizeId
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
      .first();

    if (!user) {
      return []; // Return empty array if user not found
    }

    return await ctx.db
      .query("socialAccounts")
      .withIndex("by_user_provider", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const linkXAccount = mutation({
  args: linkXAccountArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const workosUserId = identity.subject;

    if (args.provider !== "x") throw new Error("Unsupported provider");

    // First, ensure the user exists in the users table
    // Look up the user by workosUserId instead of using normalizeId
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
      .first();

    if (!user) {
      throw new Error(
        "User not found. Please ensure you are properly authenticated and your user profile has been created."
      );
    }

    // Upsert by (userId, provider)
    const existing = await ctx.db
      .query("socialAccounts")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", user._id).eq("provider", "x")
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        providerAccountId: args.providerAccountId,
        screenName: args.profile.screenName,
        accessToken: args.tokens.accessToken,
        refreshToken: args.tokens.refreshToken,
        expiresAt: args.tokens.expiresAt,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("socialAccounts", {
        userId: user._id,
        provider: "x",
        providerAccountId: args.providerAccountId,
        screenName: args.profile.screenName,
        accessToken: args.tokens.accessToken,
        refreshToken: args.tokens.refreshToken,
        expiresAt: args.tokens.expiresAt,
      });
    }
  },
});

export const getXAccount = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const workosUserId = identity.subject;

    // Look up the user by workosUserId instead of using normalizeId
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
      .first();

    if (!user) {
      return null; // Return null if user not found
    }

    return await ctx.db
      .query("socialAccounts")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", user._id).eq("provider", "x")
      )
      .unique();
  },
});

export const postReply = action({
  args: postReplyArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const account = await ctx.runQuery(api.socialAccounts.getXAccount, {});
    if (!account) throw new Error("X account not linked");

    const accessToken = account.accessToken as string;
    const mediaIds: string[] = [];

    if (args.mediaUrls && args.mediaUrls.length > 0) {
      for (const url of args.mediaUrls) {
        const fileResp = await fetch(url);
        if (!fileResp.ok) throw new Error(`Failed to fetch media: ${url}`);
        const buffer = Buffer.from(await fileResp.arrayBuffer());
        const mediaType =
          fileResp.headers.get("content-type") || "application/octet-stream";

        // INIT
        const initParams = new URLSearchParams({
          command: "INIT",
          total_bytes: String(buffer.length),
          media_type: mediaType,
        });
        const initResp = await fetch(
          "https://upload.twitter.com/1.1/media/upload.json",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: initParams,
          }
        );
        if (!initResp.ok)
          throw new Error(`Media INIT failed: ${await initResp.text()}`);
        const initJson = await initResp.json();
        const mediaId = initJson.media_id_string as string;

        // APPEND - using base64 media_data to avoid multipart in actions
        const mediaBase64 = buffer.toString("base64");
        const appendParams = new URLSearchParams({
          command: "APPEND",
          media_id: mediaId,
          segment_index: "0",
          media_data: mediaBase64,
        });
        const appendResp = await fetch(
          "https://upload.twitter.com/1.1/media/upload.json",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: appendParams,
          }
        );
        if (!appendResp.ok)
          throw new Error(`Media APPEND failed: ${await appendResp.text()}`);

        // FINALIZE
        const finalizeParams = new URLSearchParams({
          command: "FINALIZE",
          media_id: mediaId,
        });
        const finalizeResp = await fetch(
          "https://upload.twitter.com/1.1/media/upload.json",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: finalizeParams,
          }
        );
        if (!finalizeResp.ok)
          throw new Error(
            `Media FINALIZE failed: ${await finalizeResp.text()}`
          );
        mediaIds.push(mediaId);
      }
    }

    type TweetCreate = {
      text: string;
      reply: { in_reply_to_tweet_id: string };
      media?: { media_ids: string[] };
    };
    const payload: TweetCreate = {
      text: args.text,
      reply: { in_reply_to_tweet_id: args.inReplyToTweetId },
    };
    if (mediaIds.length > 0) payload.media = { media_ids: mediaIds };

    const resp = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`X post failed: ${resp.status} ${body}`);
    }
    return await resp.json();
  },
});

export const refreshTokenIfNeeded = action({
  args: {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const account: any = await ctx.runQuery(api.socialAccounts.getXAccount, {});
    if (!account) return null;

    if (account.expiresAt && account.expiresAt > Date.now() + 60_000) {
      return account;
    }

    if (!account.refreshToken) return account;

    const tokenUrl =
      process.env.X_OAUTH_TOKEN_URL || "https://api.twitter.com/2/oauth2/token";
    const clientId = process.env.X_CLIENT_ID as string;
    const clientSecret = process.env.X_CLIENT_SECRET as string;
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const resp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    if (!resp.ok) return account;
    const json = await resp.json();
    const newAccess = json.access_token as string | undefined;
    const newRefresh = json.refresh_token as string | undefined;
    const expiresIn = json.expires_in as number | undefined;

    if (!newAccess) return account;
    await ctx.runMutation(api.socialAccounts.updateXTokens, {
      accessToken: newAccess,
      refreshToken: newRefresh,
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
    });
    return await ctx.runQuery(api.socialAccounts.getXAccount, {});
  },
});

export const updateXTokens = mutation({
  args: updateXTokensArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const workosUserId = identity.subject;

    // Look up the user by workosUserId instead of using normalizeId
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
      .first();

    if (!user) {
      throw new Error(
        "User not found. Please ensure you are properly authenticated and your user profile has been created."
      );
    }

    const existing = await ctx.db
      .query("socialAccounts")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", user._id).eq("provider", "x")
      )
      .unique();
    if (!existing) return null;
    await ctx.db.patch(existing._id, {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
    });
    return existing._id;
  },
});

export const unlinkXAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const workosUserId = identity.subject;

    // Look up the user by workosUserId instead of using normalizeId
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
      .first();

    if (!user) {
      throw new Error(
        "User not found. Please ensure you are properly authenticated and your user profile has been created."
      );
    }

    const existing = await ctx.db
      .query("socialAccounts")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", user._id).eq("provider", "x")
      )
      .unique();
    if (!existing) return null;
    await ctx.db.delete(existing._id);
    return existing._id;
  },
});
