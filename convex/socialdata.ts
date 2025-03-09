// convex/socialdata.ts
import { query, action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Query to fetch Twitter handles from Convex
export const getTwitterHandles = query({
  handler: async (ctx) => {
    const handles = await ctx.db.query("waitlist").collect();
    return handles
      .filter((user) => user.twitter) // Skip entries without twitter
      .map((user) => user.twitter);
  },
});

// Action to fetch Twitter profile data from an external API
export const getTwitterProfile = action({
  args: { twitter: v.string() },
  handler: async (ctx, { twitter }) => {
    const apiKey = process.env.SOCIALDATA_API_KEY;
    if (!apiKey) throw new Error("SOCIALDATA_API_KEY is not set");
    try {
      const response = await fetch(
        `https://api.socialdata.tools/twitter/user/${twitter}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch profile for ${twitter}: ${response.status} ${response.statusText} - ${errorText}`
        );
      }
      const data = await response.json();

      if (!data.profile_image_url_https || !data.name || !data.screen_name) {
        const missingFields = [];
        if (!data.profile_image_url_https)
          missingFields.push("profile_image_url_https");
        if (!data.name) missingFields.push("name");
        if (!data.screen_name) missingFields.push("screen_name");
        throw new Error(
          `Incomplete profile data received: missing ${missingFields.join(", ")}`
        );
      }

      return {
        profile_image_url_https: data.profile_image_url_https,
        name: data.name,
        screen_name: data.screen_name,
        verified: data.verified || false,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Network error: ${error.message}`);
      } else {
        throw new Error(`Network error: An unknown error occurred`);
      }
    }
  },
});

export const getThreads = action({
  args: { threadIds: v.array(v.string()) },
  handler: async (ctx, { threadIds }) => {
    const apiKey = process.env.SOCIALDATA_API_KEY;
    if (!apiKey) throw new Error("SOCIALDATA_API_KEY is not set");

    // Use Promise.allSettled instead of Promise.all
    const results = await Promise.allSettled(
      threadIds.map(async (threadId) => {
        const response = await fetch(
          `https://api.socialdata.tools/twitter/thread/${threadId}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );
        if (!response.ok) throw new Error(`Failed to fetch thread ${threadId}`);
        return response.json();
      })
    );

    // Extract successful thread data
    const threads = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    // Optionally, collect and log errors for failed fetches
    const errors = results
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);

    if (errors.length > 0) {
      console.error("Some threads failed to fetch:", errors);
    }

    return threads;
  },
});

export const getThreadIds = query({
  handler: async (ctx) => {
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_createdAt") // Use the index for efficient sorting
      .order("desc") // Sort newest to oldest
      .collect();
    return threads.map((thread) => thread.threadId);
  },
});

export const insertThreadMutation = mutation({
  args: {
    threadId: v.string(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("threads", {
      threadId: args.threadId,
      createdAt: args.createdAt,
    });
  },
});

export const insertThread = action({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const apiKey = process.env.SOCIALDATA_API_KEY;
    if (!apiKey) throw new Error("SOCIALDATA_API_KEY is not set");

    try {
      const response = await fetch(
        `https://api.socialdata.tools/twitter/thread/${threadId}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );
      if (!response.ok) throw new Error(`Failed to fetch thread ${threadId}`);

      const threadData = await response.json();
      const firstTweet = threadData.tweets[0];
      if (!firstTweet || !firstTweet.tweet_created_at) {
        throw new Error("Thread data is incomplete or missing created_at");
      }

      const createdAt = new Date(firstTweet.tweet_created_at).getTime();

      // Replace ctx.db.insert with ctx.runMutation
      await ctx.runMutation(api.socialdata.insertThreadMutation, {
        threadId,
        createdAt,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to insert thread: ${error.message}`);
      } else {
        throw new Error(`Failed to insert thread: An unknown error occurred`);
      }
    }
  },
});
