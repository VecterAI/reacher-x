import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getUserSocialAccounts = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    // Get current user to check if they're deleted
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    // Return empty array if user is deleted
    if (!user || user.isDeleted) {
      return [];
    }

    const userIdTyped = user._id;
    return await ctx.db
      .query("socialAccounts")
      .withIndex("by_user_provider", (q) => q.eq("userId", userIdTyped))
      .collect();
  },
});

// Clean up social accounts for a specific user (used by events processor)
export const cleanupUserSocialAccounts = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const socialAccounts = await ctx.db
      .query("socialAccounts")
      .withIndex("by_user_provider", (q) => q.eq("userId", userId))
      .collect();

    // Delete all social accounts for this user
    for (const account of socialAccounts) {
      await ctx.db.delete(account._id);
    }

    return { deletedCount: socialAccounts.length };
  },
});
