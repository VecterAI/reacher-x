/**
 * Shared utility functions for user operations.
 *
 * Prefer the richer loaders in `accessHelpers.ts` for new auth/resource access.
 */

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { ViewerIdentity } from "./accessHelpers";
import { getUserByIdentity } from "./accessHelpers";

type AccessCtx = QueryCtx | MutationCtx;

const DEFAULT_USER_NOT_FOUND_MESSAGE =
  "User not found. Please ensure you are properly authenticated and your user profile has been created.";

/**
 * Helper function to get user ID from identity.
 * Used across multiple Convex functions to ensure consistency.
 */
export async function getUserIdFromIdentity(
  ctx: AccessCtx,
  identity: ViewerIdentity
): Promise<Doc<"users">["_id"]> {
  const user = await getUserByIdentity(ctx, identity);
  if (!user) {
    throw new Error(DEFAULT_USER_NOT_FOUND_MESSAGE);
  }
  return user._id;
}

/**
 * Helper function to get user from identity (returns full user object).
 */
export async function getUserFromIdentity(
  ctx: AccessCtx,
  identity: ViewerIdentity,
  throwOnNotFound: boolean = true
): Promise<Doc<"users"> | null> {
  const user = await getUserByIdentity(ctx, identity);

  if (!user) {
    if (throwOnNotFound) {
      throw new Error(DEFAULT_USER_NOT_FOUND_MESSAGE);
    }
    return null;
  }

  return user;
}
