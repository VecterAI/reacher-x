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
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        profileImageUrl: args.profileImageUrl,
      });
      // Return the existing user's ID
      return existingUser._id;
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

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Try to find user by WorkOS user ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    // Return null if user is deleted or doesn't exist
    if (!user || user.isDeleted) {
      return null;
    }

    return user;
  },
});

// Helper function to check if user is active (not deleted)
export const isUserActive = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    return user ? !user.isDeleted : false;
  },
});

// Get user by WorkOS ID (including deleted users for admin purposes)
export const getUserByWorkosIdIncludeDeleted = query({
  args: { workosUserId: v.string() },
  handler: async (ctx, { workosUserId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
      .first();
  },
});

// Reactivate a deleted user (for admin purposes)
export const reactivateUser = mutation({
  args: { workosUserId: v.string() },
  handler: async (ctx, { workosUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
      .first();

    if (!user) {
      throw new Error(`User with WorkOS ID ${workosUserId} not found`);
    }

    if (!user.isDeleted) {
      throw new Error("User is not deleted");
    }

    await ctx.db.patch(user._id, {
      isDeleted: false,
      deletedAt: undefined,
      lastSyncedAt: Date.now(),
    });

    return { success: true, userId: user._id };
  },
});
