import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createOrUpdateUser = mutation({
  args: {
    workosUserId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", args.workosUserId)
      )
      .first();

    if (existingUser) {
      // Update existing user
      return ctx.db.patch(existingUser._id, {
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        profileImageUrl: args.profileImageUrl,
      });
    } else {
      // Create new user
      return ctx.db.insert("users", {
        workosUserId: args.workosUserId,
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        profileImageUrl: args.profileImageUrl,
        createdAt: Date.now(),
      });
    }
  },
});

export const getUserByWorkosId = query({
  args: { workosUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", args.workosUserId)
      )
      .first();
  },
});

export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});
