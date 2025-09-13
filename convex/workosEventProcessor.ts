import { internalMutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { WorkOSUserData, User, SocialAccount } from "./lib/types";

// Type guard to check if data is WorkOSUserData
function isWorkOSUserData(data: unknown): data is WorkOSUserData {
  if (!data || typeof data !== "object") {
    return false;
  }

  const obj = data as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.email === "string" &&
    typeof obj.first_name === "string" &&
    typeof obj.last_name === "string" &&
    typeof obj.directory_id === "string" &&
    typeof obj.organization_id === "string" &&
    typeof obj.idp_id === "string" &&
    typeof obj.state === "string" &&
    typeof obj.created_at === "string" &&
    typeof obj.updated_at === "string"
  );
}

// Process individual WorkOS event
export const processWorkOSEvent = internalMutation({
  args: {
    event: v.object({
      id: v.string(),
      event: v.string(),
      data: v.any(), // We'll validate this at runtime
      created_at: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { event }) => {
    const { event: eventType, data } = event;

    // Only process directory sync user events
    if (!eventType.startsWith("dsync.user.")) {
      console.log(`Skipping non-user event: ${eventType}`);
      return;
    }

    // Type guard to ensure data is WorkOSUserData
    if (!isWorkOSUserData(data)) {
      console.log(`Skipping non-user data: ${eventType}`);
      return;
    }

    const userData = data;

    switch (eventType) {
      case "dsync.user.created":
      case "dsync.user.updated":
        await handleUserUpsert(ctx, userData);
        break;
      case "dsync.user.deleted":
        await handleUserDeletion(ctx, userData);
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }
  },
});

// Handle user creation/update
async function handleUserUpsert(ctx: MutationCtx, userData: WorkOSUserData) {
  const {
    id: workosUserId,
    email,
    first_name,
    last_name,
    updated_at,
  } = userData;

  // Check if user exists
  const existingUser = (await ctx.db
    .query("users")
    .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
    .first()) as User | undefined;

  const userDataToStore = {
    workosUserId,
    email,
    firstName: first_name || undefined,
    lastName: last_name || undefined,
    lastSyncedAt: Date.now(),
  };

  if (existingUser) {
    // Check if this update is newer than what we have
    const eventUpdatedAt = new Date(updated_at).getTime();
    const existingUpdatedAt = existingUser.lastSyncedAt || 0;

    if (eventUpdatedAt > existingUpdatedAt) {
      await ctx.db.patch(existingUser._id, userDataToStore);
      console.log(`Updated user ${workosUserId} from WorkOS event`);
    }
  } else {
    // Create new user
    await ctx.db.insert("users", {
      ...userDataToStore,
      createdAt: Date.now(),
    });
    console.log(`Created user ${workosUserId} from WorkOS event`);
  }
}

// Handle user deletion
async function handleUserDeletion(ctx: MutationCtx, userData: WorkOSUserData) {
  const { id: workosUserId } = userData;

  // Find user by WorkOS ID
  const user = (await ctx.db
    .query("users")
    .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
    .first()) as User | undefined;

  if (user) {
    // Mark user as deleted (soft delete)
    await ctx.db.patch(user._id, {
      isDeleted: true,
      deletedAt: Date.now(),
      lastSyncedAt: Date.now(),
    });

    // Clean up social accounts
    await cleanupUserSocialAccounts(ctx, user._id);

    console.log(
      `Soft deleted user ${workosUserId} and cleaned up related data`
    );
  } else {
    console.log(`User ${workosUserId} not found in database during deletion`);
  }
}

// Clean up user's social accounts
async function cleanupUserSocialAccounts(
  ctx: MutationCtx,
  userId: Id<"users">
) {
  const socialAccounts = (await ctx.db
    .query("socialAccounts")
    .withIndex("by_user_provider", (q) => q.eq("userId", userId))
    .collect()) as SocialAccount[];

  // Delete all social accounts for this user
  for (const account of socialAccounts) {
    await ctx.db.delete(account._id);
  }

  console.log(
    `Cleaned up ${socialAccounts.length} social accounts for user ${userId}`
  );
}
