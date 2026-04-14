"use client";

/**
 * useOutreachNotificationToast
 * Hook to monitor outreach notifications and show Sonner toasts for new pending notifications.
 *
 * Per AGENT_CONTEXT.txt: Mirrors existing useReplyStatus pattern for consistency.
 */

import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "./useAuth";
import { api } from "@/convex/_generated/api";
import { useQueryWithStatus } from "./useQueryWithStatus";

type OutreachNotificationSummary = {
  _id: string;
  status: string;
  type: string;
  title: string;
  message?: string;
  prospectId?: string;
  threadId?: string;
  taskId?: string;
  actionRequestId?: string;
};

/**
 * Shows Sonner toast notifications for new approval requests and prospect replies.
 * Tracks shown notifications to prevent duplicates across re-renders.
 */
export function useOutreachNotificationToast() {
  const { isAuthenticated, isLoading, workspace } = useAuth();

  const notificationsQuery = useQueryWithStatus(
    api.outreach.listNotifications,
    isAuthenticated ? {} : "skip"
  );
  const notifications = useMemo<OutreachNotificationSummary[]>(
    () => (notificationsQuery.data ?? []) as OutreachNotificationSummary[],
    [notificationsQuery.data]
  );

  // Track shown notifications to prevent duplicate toasts
  const shownNotifications = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (
      !isAuthenticated ||
      isLoading ||
      !workspace ||
      !notificationsQuery.isSuccess
    ) {
      return;
    }

    // Only show toasts for new pending notifications
    const pending = notifications.filter(
      (n: OutreachNotificationSummary) => n.status === "pending"
    );

    for (const notification of pending) {
      // Skip if already shown
      if (shownNotifications.current.has(notification._id)) continue;

      // Build toast action to navigate to agent page
      // NOTE: No action param - user sees thread and types approval message manually
      const toastAction = notification.prospectId
        ? {
            label: "View",
            onClick: () => {
              const params = new URLSearchParams();
              params.set("prospectId", String(notification.prospectId));
              if (notification.threadId) {
                params.set("threadId", String(notification.threadId));
              }
              if (notification.taskId) {
                params.set("taskId", String(notification.taskId));
                params.set("panel", "approval");
              }
              if (notification.actionRequestId) {
                params.set(
                  "actionRequestId",
                  String(notification.actionRequestId)
                );
                params.set("panel", "approval");
              }
              window.location.href = `/agent?${params.toString()}`;
            },
          }
        : undefined;

      const commonOptions = {
        id: notification._id,
        duration: 8000, // Auto-dismiss after 8s
        action: toastAction,
      };

      // Show appropriate toast based on notification type
      if (notification.type === "ask_human") {
        toast.info(notification.title, {
          description: notification.message,
          ...commonOptions,
        });
      } else if (notification.type === "prospect_replied") {
        toast.success(notification.title, {
          description: notification.message,
          ...commonOptions,
        });
      } else if (notification.type === "social_action_request") {
        toast.info(notification.title, {
          description: notification.message,
          ...commonOptions,
        });
      } else if (notification.type === "social_action_completed") {
        toast.success(notification.title, {
          description: notification.message,
          ...commonOptions,
        });
      } else if (notification.type === "social_action_failed") {
        toast.error(notification.title, {
          description: notification.message,
          ...commonOptions,
        });
      }

      // Mark as shown
      shownNotifications.current.add(notification._id);
    }
  }, [
    isAuthenticated,
    isLoading,
    workspace,
    notifications,
    notificationsQuery.isSuccess,
  ]);
}
