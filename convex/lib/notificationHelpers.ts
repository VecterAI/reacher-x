/**
 * Notification Helpers
 *
 * Consolidated helpers for notification-related functionality.
 * Single source of truth for all notification utilities.
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import type { ProspectIdentitySource } from "./prospectIdentityCore";
import { getProspectIdentitySnapshot } from "./prospectIdentityCore";

export { extractAvatarUrl, extractDisplayName } from "./prospectIdentityCore";

// ============================================================================
// Prospect Display Fields (for outreachNotifications)
// ============================================================================

/**
 * Extract screen name from prospect (Twitter @handle or LinkedIn username).
 * Used for internal tracking, not displayed in titles per user feedback.
 */
export function extractScreenName(
  prospect: ProspectIdentitySource | null
): string | undefined {
  return getProspectIdentitySnapshot(prospect).screenName;
}

/**
 * Get all prospect display fields for notification creation.
 * Convenience function combining all extractors.
 */
export function getProspectDisplayFields(prospect: Doc<"prospects"> | null): {
  prospectAvatarUrl: string | undefined;
  prospectDisplayName: string | undefined;
  prospectType: Doc<"prospects">["prospectType"];
  prospectPlatform: Doc<"prospects">["platform"] | undefined;
  prospectScreenName: string | undefined;
} {
  if (!prospect) {
    return {
      prospectAvatarUrl: undefined,
      prospectDisplayName: undefined,
      prospectType: undefined,
      prospectPlatform: undefined,
      prospectScreenName: undefined,
    };
  }

  const identity = getProspectIdentitySnapshot(prospect);

  return {
    prospectAvatarUrl: identity.avatarUrl,
    prospectDisplayName: identity.preferredLabel,
    prospectType: prospect.prospectType,
    prospectPlatform: prospect.platform,
    prospectScreenName: identity.screenName,
  };
}

export type NotificationCreateInput = {
  userId: Id<"users">;
  workspaceId: Id<"workspaces">;
  type: Doc<"outreachNotifications">["type"];
  title: string;
  message: string;
  targetHref?: string;
  actionLabel?: string;
  notificationKey?: string;
  contextPlatform?: Doc<"prospects">["platform"];
  prospectId?: Id<"prospects">;
  planId?: Id<"outreachPlans">;
  taskId?: Id<"outreachTasks">;
  actionRequestId?: Id<"agentActionRequests">;
  toolCallId?: string;
  threadId?: string;
  prospectAvatarUrl?: string;
  prospectDisplayName?: string;
  prospectType?: Doc<"prospects">["prospectType"];
  prospectPlatform?: Doc<"prospects">["platform"];
  prospectScreenName?: string;
  replyCount?: number;
};

function applyNotificationDefaults(input: NotificationCreateInput) {
  return {
    ...input,
    targetHref: input.targetHref ?? buildNotificationTargetHref(input),
    contextPlatform: input.contextPlatform ?? input.prospectPlatform,
  };
}

export function buildNotificationTargetHref(input: {
  targetHref?: string;
  prospectId?: string | Id<"prospects">;
  threadId?: string;
  taskId?: string | Id<"outreachTasks">;
  actionRequestId?: string | Id<"agentActionRequests">;
}): string | undefined {
  if (input.targetHref) {
    return input.targetHref;
  }
  if (!input.prospectId) {
    return undefined;
  }

  const params = new URLSearchParams();
  params.set("prospectId", String(input.prospectId));
  if (input.threadId) {
    params.set("threadId", input.threadId);
  }
  if (input.taskId) {
    params.set("taskId", String(input.taskId));
    params.set("panel", "approval");
  }
  if (input.actionRequestId) {
    params.set("actionRequestId", String(input.actionRequestId));
    params.set("panel", "approval");
  }

  return `/agent?${params.toString()}`;
}

export async function createNotification(
  ctx: MutationCtx,
  input: NotificationCreateInput
): Promise<Id<"outreachNotifications">> {
  const now = getCurrentUTCTimestamp();
  return await ctx.db.insert("outreachNotifications", {
    ...applyNotificationDefaults(input),
    status: "pending",
    eventVersion: 1,
    eventUpdatedAt: now,
  });
}

export async function upsertNotificationByKey(
  ctx: MutationCtx,
  input: NotificationCreateInput & { notificationKey: string }
): Promise<Id<"outreachNotifications">> {
  const existing = await ctx.db
    .query("outreachNotifications")
    .withIndex("by_user_workspace_key", (q) =>
      q
        .eq("userId", input.userId)
        .eq("workspaceId", input.workspaceId)
        .eq("notificationKey", input.notificationKey)
    )
    .first();

  const next = applyNotificationDefaults(input);
  const now = getCurrentUTCTimestamp();
  if (!existing) {
    return await ctx.db.insert("outreachNotifications", {
      ...next,
      status: "pending",
      eventVersion: 1,
      eventUpdatedAt: now,
    });
  }

  await ctx.db.patch(existing._id, {
    ...next,
    status: "pending",
    eventVersion: (existing.eventVersion ?? 0) + 1,
    eventUpdatedAt: now,
    seenAt: undefined,
    dismissedAt: undefined,
  });
  return existing._id;
}

export async function dismissNotificationsByKey(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    workspaceId: Id<"workspaces">;
    notificationKey: string;
  }
): Promise<void> {
  const notifications = await ctx.db
    .query("outreachNotifications")
    .withIndex("by_user_workspace_key", (q) =>
      q
        .eq("userId", args.userId)
        .eq("workspaceId", args.workspaceId)
        .eq("notificationKey", args.notificationKey)
    )
    .collect();
  const activeNotifications = notifications.filter(
    (notification) => notification.status !== "dismissed"
  );

  if (activeNotifications.length === 0) {
    return;
  }

  const dismissedAt = getCurrentUTCTimestamp();
  await Promise.all(
    activeNotifications.map((notification) =>
      ctx.db.patch(notification._id, {
        status: "dismissed",
        dismissedAt,
      })
    )
  );
}

export async function dismissNotificationsForActionRequest(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    actionRequestId: Id<"agentActionRequests">;
  }
): Promise<void> {
  const notifications = await ctx.db
    .query("outreachNotifications")
    .withIndex("by_user_status", (q) =>
      q.eq("userId", args.userId).eq("status", "pending")
    )
    .filter((q) => q.eq(q.field("actionRequestId"), args.actionRequestId))
    .collect();

  if (notifications.length === 0) {
    return;
  }

  const dismissedAt = getCurrentUTCTimestamp();
  await Promise.all(
    notifications.map((notification) =>
      ctx.db.patch(notification._id, {
        status: "dismissed",
        dismissedAt,
      })
    )
  );
}

export async function dismissNotificationsForTask(
  ctx: MutationCtx,
  taskId: Id<"outreachTasks">
): Promise<void> {
  const notifications = await ctx.db
    .query("outreachNotifications")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .collect();
  const activeNotifications = notifications.filter(
    (notification) => notification.status !== "dismissed"
  );
  if (activeNotifications.length === 0) {
    return;
  }

  const dismissedAt = getCurrentUTCTimestamp();
  await Promise.all(
    activeNotifications.map((notification) =>
      ctx.db.patch(notification._id, {
        status: "dismissed",
        dismissedAt,
      })
    )
  );
}
