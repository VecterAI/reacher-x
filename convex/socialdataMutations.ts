import { query, mutation } from "./_generated/server";
import {
  getThreadByIdArgsValidator,
  getRecentThreadsArgsValidator,
} from "./validators";
import { v } from "convex/values";

export const getTwitterHandles = query({
  handler: async (ctx) => {
    const handles = await ctx.db.query("waitlist").collect();
    return handles
      .filter((user) => user.twitter) // Skip entries without twitter
      .map((user) => user.twitter);
  },
});

export const getThreadIds = query({
  handler: async (ctx) => {
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_postedAt")
      .order("desc") // Sort newest to oldest
      .collect();
    return threads.map((thread) => thread.threadId);
  },
});

export const insertThreadMutation = mutation({
  args: {
    threadId: v.string(),
    postedAt: v.number(),
    tweets: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("threads", {
      threadId: args.threadId,
      postedAt: args.postedAt,
      tweets: args.tweets,
    });
  },
});

export const getStaticThreads = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("threads")
      .withIndex("by_postedAt")
      .order("desc")
      .collect();
  },
});

export const getThreadById = query({
  args: getThreadByIdArgsValidator,
  handler: async (ctx, { threadId }) => {
    return await ctx.db
      .query("threads")
      .withIndex("by_threadId", (q) => q.eq("threadId", threadId))
      .unique();
  },
});

export const getRecentThreads = query({
  args: getRecentThreadsArgsValidator,
  handler: async (ctx, args) => {
    const { count, excludeThreadId } = args;
    let query = ctx.db.query("threads").withIndex("by_postedAt").order("desc");
    if (excludeThreadId) {
      query = query.filter((q) => q.neq(q.field("threadId"), excludeThreadId));
    }
    return await query.take(count);
  },
});
