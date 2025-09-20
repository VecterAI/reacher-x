/**
 * Shared utility functions for user operations
 */

/**
 * Helper function to get user ID from identity
 * Used across multiple Convex functions to ensure consistency
 * @param ctx - Convex context
 * @param identity - User identity from auth
 * @returns User ID (throws error if not found)
 */
export async function getUserIdFromIdentity(
  ctx: any,
  identity: any
): Promise<any> {
  const workosUserId = identity.subject;

  const user = await ctx.db
    .query("users")
    .withIndex("by_workos_user_id", (q: any) =>
      q.eq("workosUserId", workosUserId)
    )
    .first();

  if (!user) {
    throw new Error(
      "User not found. Please ensure you are properly authenticated and your user profile has been created."
    );
  }
  return user._id;
}

/**
 * Helper function to get user from identity (returns full user object)
 * @param ctx - Convex context
 * @param identity - User identity from auth
 * @param throwOnNotFound - Whether to throw an error if user not found (default: true)
 * @returns User object or null if not found and throwOnNotFound is false
 */
export async function getUserFromIdentity(
  ctx: any,
  identity: any,
  throwOnNotFound: boolean = true
): Promise<any | null> {
  const workosUserId = identity.subject;

  const user = await ctx.db
    .query("users")
    .withIndex("by_workos_user_id", (q: any) =>
      q.eq("workosUserId", workosUserId)
    )
    .first();

  if (!user) {
    if (throwOnNotFound) {
      throw new Error(
        "User not found. Please ensure you are properly authenticated and your user profile has been created."
      );
    }
    return null;
  }
  return user;
}
