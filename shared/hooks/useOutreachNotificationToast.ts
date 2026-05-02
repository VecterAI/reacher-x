"use client";

/**
 * useOutreachNotificationToast
 * Hook to monitor outreach notifications and show Sonner toasts for new pending notifications.
 *
 * Per AGENT_CONTEXT.txt: Mirrors existing useReplyStatus pattern for consistency.
 */

import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "./useAuth";
import { useNotificationWorkspace } from "./useNotificationWorkspace";
import { useQueryWithStatus } from "./useQueryWithStatus";

type OutreachNotificationSummary = {
  _id: string;
  status: string;
  type: string;
  title: string;
  message?: string;
  targetHref?: string;
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
  const { isAuthenticated, isLoading } = useAuth();
  const { workspaceId, shellStateQuery } = useNotificationWorkspace();

  const notificationsQuery = useQueryWithStatus(
    api.outreach.listNotifications,
    isAuthenticated && workspaceId
      ? { workspaceId: workspaceId as Id<"workspaces"> }
      : "skip"
  );
  const notifications = useMemo<OutreachNotificationSummary[]>(
    () => (notificationsQuery.data ?? []) as OutreachNotificationSummary[],
    [notificationsQuery.data]
  );

  // Track shown notifications to prevent duplicate toasts
  const shownNotifications = useRef<Set<string>>(new Set());
  const baselineWorkspaceRef = useRef<string | null>(null);
  const baselineInitializedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || isLoading || shellStateQuery.isPending) {
      return;
    }

    const scopedWorkspaceId = workspaceId ?? null;
    if (baselineWorkspaceRef.current !== scopedWorkspaceId) {
      baselineWorkspaceRef.current = scopedWorkspaceId;
      baselineInitializedRef.current = false;
      shownNotifications.current.clear();
    }

    if (!scopedWorkspaceId || !notificationsQuery.isSuccess) {
      return;
    }

    // Only show toasts for new pending notifications
    const pending = notifications.filter(
      (n: OutreachNotificationSummary) => n.status === "pending"
    );

    if (!baselineInitializedRef.current) {
      for (const notification of pending) {
        shownNotifications.current.add(notification._id);
      }
      baselineInitializedRef.current = true;
      return;
    }

    for (const notification of pending) {
      // Skip if already shown
      if (shownNotifications.current.has(notification._id)) continue;

      const targetHref =
        notification.targetHref ??
        (notification.prospectId
          ? (() => {
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
              return `/agent?${params.toString()}`;
            })()
          : undefined);

      const toastAction = targetHref
        ? {
            label: "View",
            onClick: () => {
              window.location.href = targetHref;
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
      } else if (notification.type === "error") {
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
    notifications,
    notificationsQuery.isSuccess,
    shellStateQuery.isPending,
    workspaceId,
  ]);
}
