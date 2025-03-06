// convex/socialdata.ts
import { query, action } from "./_generated/server";
import { v } from "convex/values";

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
      if (!response.ok)
        throw new Error(`Failed to fetch profile for ${twitter}`);
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

    const threads = await Promise.all(
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
    return threads;
  },
});

export const getThreadIds = query({
  handler: async (ctx) => {
    const threads = await ctx.db.query("threads").collect();
    return threads.map((thread) => thread.threadId);
  },
});
