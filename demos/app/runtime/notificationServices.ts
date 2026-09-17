import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { paginateLocalRows } from "./paginationHelpers";
import type { LocalClient } from "./LocalClient";
import type { createAppFixtures } from "./appFixtures";

export function registerNotificationServices(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>
) {
  const now = getCurrentUTCTimestamp();
  const notifications: Doc<"outreachNotifications">[] = state.workspaces.map(
    (workspace) => ({
      _id: `demo_notification_${workspace._id}` as Doc<"outreachNotifications">["_id"],
      _creationTime: now - 3600000,
      userId: workspace.userId,
      workspaceId: workspace._id,
      type: "prospects_found",
      title: "New matches to review",
      message: `${state.prospects.filter((person) => person.workspaceId === workspace._id && person.status === "new").length} new matches in ${workspace.name}.`,
      status: "pending",
      eventUpdatedAt: now - 3600000,
      targetHref: "/",
      actionLabel: "View matches",
    })
  );
  const scoped = (workspaceId = state.selectedWorkspaceId) =>
    notifications.filter(
      (item) => item.workspaceId === workspaceId && item.status !== "dismissed"
    );
  client.register(
    api.outreach.listNotifications,
    ({ workspaceId, paginationOpts }) =>
      paginateLocalRows(scoped(workspaceId), paginationOpts)
  );
  client.register(api.outreach.listPendingNotifications, ({ workspaceId }) =>
    scoped(workspaceId).filter((item) => item.status === "pending")
  );
  const find = (id: string, workspaceId = state.selectedWorkspaceId) => {
    const item = notifications.find(
      (item) => item._id === id && item.workspaceId === workspaceId
    );
    if (!item) throw new Error("Notification not found in this workspace");
    return item;
  };
  client.register(
    api.outreach.markNotificationSeen,
    ({ notificationId, workspaceId }) => {
      const item = find(notificationId, workspaceId);
      item.status = "seen";
      item.seenAt = getCurrentUTCTimestamp();
      return null;
    }
  );
  client.register(
    api.outreach.dismissNotification,
    ({ notificationId, workspaceId }) => {
      const item = find(notificationId, workspaceId);
      item.status = "dismissed";
      item.dismissedAt = getCurrentUTCTimestamp();
      return null;
    }
  );
  client.register(
    api.outreach.resolveNotificationTarget,
    ({ notificationId, workspaceId }) =>
      find(notificationId, workspaceId).targetHref ?? null
  );
  return {
    pendingCount: () =>
      scoped().filter((item) => item.status === "pending").length,
  };
}
