import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";

// Event processing cursor management
export const getEventCursor = query({
  args: {},
  handler: async (ctx) => {
    // Get the latest processed event cursor from a simple storage
    // For MVP, we'll store this in a simple table
    const cursorDoc = await ctx.db
      .query("eventCursors")
      .filter((q) => q.eq(q.field("type"), "user_events"))
      .first();

    return cursorDoc?.cursor || null;
  },
});

export const updateEventCursor = mutation({
  args: { cursor: v.string() },
  handler: async (ctx, { cursor }) => {
    // Update or create the cursor
    const existingCursor = await ctx.db
      .query("eventCursors")
      .filter((q) => q.eq(q.field("type"), "user_events"))
      .first();

    if (existingCursor) {
      await ctx.db.patch(existingCursor._id, { cursor });
    } else {
      await ctx.db.insert("eventCursors", {
        type: "user_events",
        cursor,
        updatedAt: Date.now(),
      });
    }
  },
});

// Process WorkOS events (public mutation - for manual triggering)
// Note: This is mainly for manual testing. The cron job uses the action directly.
export const processUserEvents = mutation({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (): Promise<{ message: string }> => {
    // This mutation is kept for compatibility but the actual processing
    // is now handled by the cron job using the action directly.
    return {
      message:
        "WorkOS event processing is now handled by the cron job. Use the action directly for manual processing.",
    };
  },
});

// Manual user deletion (for testing or manual cleanup)
export const deleteUserByWorkosId = mutation({
  args: { workosUserId: v.string() },
  handler: async (ctx, { workosUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
      .first();

    if (!user) {
      throw new Error(`User with WorkOS ID ${workosUserId} not found`);
    }

    // Mark as deleted
    await ctx.db.patch(user._id, {
      isDeleted: true,
      deletedAt: Date.now(),
      lastSyncedAt: Date.now(),
    });

    // Clean up social accounts
    const socialAccounts = await ctx.db
      .query("socialAccounts")
      .withIndex("by_user_provider", (q) => q.eq("userId", user._id))
      .collect();

    for (const account of socialAccounts) {
      await ctx.db.delete(account._id);
    }

    console.log(
      `Cleaned up ${socialAccounts.length} social accounts for user ${user._id}`
    );

    return { success: true, userId: user._id };
  },
});

// Get event processing status
export const getEventProcessingStatus = query({
  args: {},
  handler: async (ctx) => {
    const cursorDoc = await ctx.db
      .query("eventCursors")
      .filter((q) => q.eq(q.field("type"), "user_events"))
      .first();

    return {
      lastProcessedCursor: cursorDoc?.cursor || null,
      lastUpdated: cursorDoc?.updatedAt || null,
    };
  },
});

// Public webhook event processor (for WorkOS webhooks)
export const processWebhookEvent = mutation({
  args: {
    event: v.object({
      id: v.string(),
      type: v.string(),
      data: v.any(),
      created_at: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { event }) => {
    const { type: eventType, data } = event;

    console.log(`Processing WorkOS webhook event: ${eventType}`);

    // Only process directory sync user events
    if (!eventType.startsWith("dsync.user.")) {
      console.log(`Skipping non-user event: ${eventType}`);
      return { success: true, message: `Skipped non-user event: ${eventType}` };
    }

    // Type guard to ensure data is WorkOSUserData
    if (!data || typeof data !== "object") {
      console.log(`Skipping invalid data: ${eventType}`);
      return { success: true, message: `Skipped invalid data: ${eventType}` };
    }

    const userData = data as Record<string, unknown>;

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

    return { success: true, message: `Processed event: ${eventType}` };
  },
});

// Handle user creation/update
async function handleUserUpsert(
  ctx: MutationCtx,
  userData: Record<string, unknown>
) {
  const {
    id: workosUserId,
    emails,
    first_name,
    last_name,
    updated_at,
  } = userData;

  // Extract primary email - handle both array and single email formats
  let primaryEmail: string | undefined;

  if (Array.isArray(emails)) {
    primaryEmail =
      emails.find((email: any) => email.primary)?.value || emails[0]?.value;
  } else if (typeof emails === "string") {
    primaryEmail = emails;
  } else if (emails && typeof emails === "object" && "value" in emails) {
    primaryEmail = (emails as any).value;
  }

  if (!primaryEmail) {
    console.error(`No email found for user ${workosUserId}`);
    return;
  }

  // Check if user exists
  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_workos_user_id", (q) =>
      q.eq("workosUserId", workosUserId as string)
    )
    .first();

  const userDataToStore = {
    workosUserId: workosUserId as string,
    email: primaryEmail,
    firstName: (first_name as string) || undefined,
    lastName: (last_name as string) || undefined,
    lastSyncedAt: Date.now(),
  };

  if (existingUser) {
    // Check if this update is newer than what we have
    const eventUpdatedAt = new Date(updated_at as string).getTime();
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
async function handleUserDeletion(
  ctx: MutationCtx,
  userData: Record<string, unknown>
) {
  const { id: workosUserId } = userData;

  // Find user by WorkOS ID
  const user = await ctx.db
    .query("users")
    .withIndex("by_workos_user_id", (q) =>
      q.eq("workosUserId", workosUserId as string)
    )
    .first();

  if (user) {
    // Clean up social accounts first
    const socialAccounts = await ctx.db
      .query("socialAccounts")
      .withIndex("by_user_provider", (q) => q.eq("userId", user._id))
      .collect();

    for (const account of socialAccounts) {
      await ctx.db.delete(account._id);
    }

    // Clean up threads associated with this user
    const userThreads = await ctx.db
      .query("threads")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect();

    for (const thread of userThreads) {
      await ctx.db.delete(thread._id);
    }

    // Hard delete the user (not soft delete) since WorkOS user is permanently deleted
    await ctx.db.delete(user._id);

    // Store deletion event for audit purposes
    await ctx.db.insert("userDeletionEvents", {
      workosUserId: workosUserId as string,
      deletedAt: Date.now(),
      socialAccountsDeleted: socialAccounts.length,
      threadsDeleted: userThreads.length,
    });

    console.log(
      `Hard deleted user ${workosUserId} and cleaned up ${socialAccounts.length} social accounts and ${userThreads.length} threads`
    );
  } else {
    console.log(`User ${workosUserId} not found in database during deletion`);
  }
}
