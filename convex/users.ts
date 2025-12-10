import { mutation, query, internalQuery } from "./_generated/server";
import {
  createOrUpdateUserArgsValidator,
  getUserByWorkosIdArgsValidator,
  getUserByIdArgsValidator,
} from "./validators";
import { v } from "convex/values";

// ============================================================================
// Internal Queries (for use by actions)
// ============================================================================

/**
 * Internal query to get user by WorkOS ID.
 * Used by actions that need to look up users.
 */
export const getUserByWorkosIdInternal = internalQuery({
  args: getUserByWorkosIdArgsValidator,
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", args.workosUserId)
      )
      .first();
  },
});

// ============================================================================
// Public Mutations & Queries
// ============================================================================

export const createOrUpdateUser = mutation({
  args: createOrUpdateUserArgsValidator,
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
      });
    }
  },
});

export const getUserByWorkosId = query({
  args: getUserByWorkosIdArgsValidator,
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
  args: getUserByIdArgsValidator,
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
    return await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();
  },
});

// Marks onboarding as completed for the current user
export const setOnboardingCompleted = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, { onboardingCompletedAt: Date.now() });
    return user._id;
  },
});

// Persist cross-device tour state
export const setTourState = mutation({
  args: {
    tour: v.string(),
    state: v.any(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();
    if (!user) throw new Error("User not found");

    const nextState = {
      ...(user.tourState || {}),
      [args.tour]: args.state,
    } as Record<string, unknown>;
    await ctx.db.patch(user._id, { tourState: nextState });
    return true;
  },
});
