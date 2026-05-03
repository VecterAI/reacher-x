"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  useAuth,
  useNotificationWorkspace,
  useQueryWithStatus,
} from "@/shared/hooks";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import { NotificationsInbox } from "@/features/webapp/ui/components/notifications/NotificationsInbox";
import type { NotificationItem } from "@/features/webapp/ui/components/notifications/NotificationsInbox";
import { Button } from "@/shared/ui/components/Button";

export default function NotificationsPage() {
  const router = useRouter();
  const { isAuthenticated, error: authError } = useAuth();
  const { workspaceId, shellStateQuery } = useNotificationWorkspace();

  const notificationsQuery = useQueryWithStatus(
    api.outreach.listNotifications,
    isAuthenticated && workspaceId
      ? { workspaceId: workspaceId as Id<"workspaces"> }
      : "skip"
  );
  const notifications = (notificationsQuery.data ?? []) as NotificationItem[];
  const markSeen = useMutation(api.outreach.markNotificationSeen);
  const dismissNotification = useMutation(api.outreach.dismissNotification);

  const isLoading =
    isAuthenticated &&
    (shellStateQuery.isPending ||
      (workspaceId !== null && notificationsQuery.isPending));

  const handleSelect = async (
    notification: NotificationItem,
    rowNotifications: NotificationItem[]
  ) => {
    if (!workspaceId) {
      return;
    }

    const pendingNotifications = rowNotifications.filter(
      (item) => item.status === "pending"
    );

    for (const item of pendingNotifications) {
      await markSeen({
        notificationId: item._id as Id<"outreachNotifications">,
        workspaceId: workspaceId as Id<"workspaces">,
      });
    }

    if (notification.targetHref) {
      router.push(notification.targetHref);
      return;
    }

    if (!notification.prospectId) {
      return;
    }

    const params = new URLSearchParams();
    params.set("prospectId", notification.prospectId);

    if (notification.threadId) {
      params.set("threadId", notification.threadId);
    }

    if (notification.taskId) {
      params.set("taskId", notification.taskId);
      params.set("panel", "approval");
    }

    if (notification.actionRequestId) {
      params.set("actionRequestId", notification.actionRequestId);
      params.set("panel", "approval");
    }

    router.push(`/agent?${params.toString()}`);
  };

  const handleDismiss = async (notificationId: string) => {
    if (!workspaceId) {
      return;
    }

    await dismissNotification({
      notificationId: notificationId as Id<"outreachNotifications">,
      workspaceId: workspaceId as Id<"workspaces">,
    });
  };

  return (
    <div className="flex h-full min-h-0 w-full">
      <PageLayout className="flex h-full min-h-0 flex-col overflow-hidden">
        <PageHeader title="Notifications" onBack={() => router.back()} />
        <PageContent className="min-h-0 flex-1 overflow-y-auto scroll-fade-effect-y pt-4 pb-6">
          {(authError || shellStateQuery.isError || notificationsQuery.isError) && (
            <div className="mx-4 mb-4 rounded-lg border border-dashed p-4 text-sm">
              <p className="font-medium">Could not load notifications</p>
              <p className="text-muted-foreground mt-1">
                {authError?.message ||
                  shellStateQuery.error?.message ||
                  notificationsQuery.error?.message ||
                  "Please try again."}
              </p>
              <Button
                size="xs"
                variant="outline"
                className="mt-3"
                onClick={() => router.refresh()}
              >
                Retry
              </Button>
            </div>
          )}
          <NotificationsInbox
            notifications={notifications}
            isLoading={isLoading}
            onSelect={handleSelect}
            onDismiss={handleDismiss}
          />
        </PageContent>
      </PageLayout>
    </div>
  );
}
