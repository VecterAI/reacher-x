/**
 * Notification Helpers
 *
 * Consolidated helpers for notification-related functionality.
 * Single source of truth for all notification utilities.
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";

// ============================================================================
// Prospect Display Fields (for outreachNotifications)
// ============================================================================

type ProspectData = Record<string, unknown>;
type ProspectUser = Record<string, unknown>;

/**
 * Extract avatar URL from raw prospect data.
 * Handles Twitter (user.profile_image_url_https) and LinkedIn (profileImage).
 */
export function extractAvatarUrl(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const d = data as ProspectData;

  // Twitter: user.profile_image_url_https
  const user = d.user as ProspectUser | undefined;
  if (typeof user?.profile_image_url_https === "string") {
    return user.profile_image_url_https;
  }

  // LinkedIn: profileImage
  if (typeof d.profileImage === "string") {
    return d.profileImage;
  }

  return undefined;
}

/**
 * Extract display name from raw prospect data.
 * Falls back through: enriched displayName → data.user.name → undefined.
 */
export function extractDisplayName(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const d = data as ProspectData;

  // Twitter: user.name
  const user = d.user as ProspectUser | undefined;
  if (typeof user?.name === "string") {
    return user.name;
  }

  // LinkedIn: name field
  if (typeof d.name === "string") {
    return d.name;
  }

  return undefined;
}

/**
 * Extract screen name from prospect (Twitter @handle or LinkedIn username).
 * Used for internal tracking, not displayed in titles per user feedback.
 */
export function extractScreenName(
  prospect: Pick<Doc<"prospects">, "data" | "socialProfiles"> | null
): string | undefined {
  if (!prospect) return undefined;

  // Try socialProfiles first (enriched data)
  if (prospect.socialProfiles?.twitter?.username) {
    return prospect.socialProfiles.twitter.username;
  }
  if (prospect.socialProfiles?.linkedin?.username) {
    return prospect.socialProfiles.linkedin.username;
  }

  // Fallback to raw data
  const data = prospect.data as ProspectData | undefined;
  const user = data?.user as ProspectUser | undefined;
  if (typeof user?.screen_name === "string") {
    return user.screen_name;
  }

  return undefined;
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

  return {
    prospectAvatarUrl: extractAvatarUrl(prospect.data),
    prospectDisplayName:
      prospect.displayName || extractDisplayName(prospect.data),
    prospectType: prospect.prospectType,
    prospectPlatform: prospect.platform,
    prospectScreenName: extractScreenName(prospect),
  };
}

export type NotificationCreateInput = {
  userId: Id<"users">;
  workspaceId: Id<"workspaces">;
  type: Doc<"outreachNotifications">["type"];
  title: string;
  message: string;
  targetHref?: string;
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
  return await ctx.db.insert("outreachNotifications", {
    ...applyNotificationDefaults(input),
    status: "pending",
  });
}

export async function upsertNotificationByKey(
  ctx: MutationCtx,
  input: NotificationCreateInput & { notificationKey: string }
): Promise<Id<"outreachNotifications">> {
  const existing = await ctx.db
    .query("outreachNotifications")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", input.workspaceId))
    .filter((q) =>
      q.and(
        q.eq(q.field("userId"), input.userId),
        q.eq(q.field("notificationKey"), input.notificationKey)
      )
    )
    .first();

  const next = applyNotificationDefaults(input);
  if (!existing) {
    return await ctx.db.insert("outreachNotifications", {
      ...next,
      status: "pending",
    });
  }

  await ctx.db.patch(existing._id, {
    ...next,
    status: "pending",
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
    .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
    .filter((q) =>
      q.and(
        q.eq(q.field("userId"), args.userId),
        q.eq(q.field("notificationKey"), args.notificationKey),
        q.neq(q.field("status"), "dismissed")
      )
    )
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
