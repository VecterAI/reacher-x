import { mutation, query } from "./_generated/server";
import {
  createOrUpdateUserArgsValidator,
  getUserByWorkosIdArgsValidator,
  getUserByIdArgsValidator,
} from "./validators";

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
