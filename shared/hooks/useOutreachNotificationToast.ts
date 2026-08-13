"use client";

/**
 * useOutreachNotificationToast
 * Hook to monitor outreach notifications and show Sonner toasts for new pending notifications.
 *
 * Per AGENT_CONTEXT.txt: Mirrors existing useReplyStatus pattern for consistency.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MouseEventHandler,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  getOutreachNotificationEventKey,
  getOutreachNotificationEventTimestamp,
} from "@/shared/lib/notifications/outreachNotificationEvents";
import { buildOutreachNotificationToastPlan } from "@/shared/lib/notifications/outreachNotificationToastPolicy";
import { useAuth } from "./useAuth";
import { useNotificationWorkspace } from "./useNotificationWorkspace";
import { useQueryWithStatus } from "./useQueryWithStatus";
import { getCurrentUTCTimestamp } from "../lib/utils/time/timeUtils";

type OutreachNotificationSummary = Omit<
  Pick<
    Doc<"outreachNotifications">,
    | "_creationTime"
    | "_id"
    | "actionLabel"
    | "actionRequestId"
    | "eventUpdatedAt"
    | "eventVersion"
    | "message"
    | "prospectId"
    | "status"
    | "targetHref"
    | "taskId"
    | "threadId"
    | "title"
    | "type"
  >,
  "_id" | "actionRequestId" | "prospectId" | "taskId"
> & {
  _id: string;
  actionRequestId?: string;
  prospectId?: string;
  taskId?: string;
};

type NotificationToastVariant = "info" | "success" | "warning" | "error";

type QueuedNotificationToast = {
  key: string;
  variant: NotificationToastVariant;
  title: string;
  description?: string;
  action?: {
    label: ReactNode;
    onClick: MouseEventHandler<HTMLButtonElement>;
  };
};

const OUTREACH_TOAST_DURATION_MS = 8000;
const OUTREACH_TOAST_GAP_MS = 180;

function getNotificationToastVariant(
  type: Doc<"outreachNotifications">["type"]
): NotificationToastVariant {
  switch (type) {
    case "ask_human":
    case "twitter_action_request":
    case "social_action_request":
    case "plan_batch_ready":
    case "plan_batch_started":
      return "info";
    case "prospects_found":
    case "outreach_sent":
    case "prospect_replied":
    case "social_action_completed":
    case "setup_preview_ready":
    case "plan_completed":
    case "plan_batch_completed":
      return "success";
    case "plan_batch_partial":
      return "warning";
    case "social_action_failed":
    case "plan_batch_failed":
    case "error":
      return "error";
  }
}

/**
 * Shows Sonner toast notifications for new approval requests and prospect replies.
 * Tracks shown notifications to prevent duplicates across re-renders.
 */
export function useOutreachNotificationToast() {
  const convex = useConvex();
  const { isAuthenticated, isLoading } = useAuth();
  const { workspaceId, shellStateQuery } = useNotificationWorkspace();
  const workspaceSessionStartedAt = useMemo(
    () => getCurrentUTCTimestamp(),
    [workspaceId]
  );

  const notificationsQuery = useQueryWithStatus(
    api.outreach.listPendingNotifications,
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
  const toastQueueRef = useRef<QueuedNotificationToast[]>([]);
  const activeToastKeyRef = useRef<string | null>(null);
  const nextToastTimerRef = useRef<number | null>(null);

  const flushToastQueue = useCallback(() => {
    if (activeToastKeyRef.current || toastQueueRef.current.length === 0) {
      return;
    }

    const nextToast = toastQueueRef.current.shift();
    if (!nextToast) return;

    activeToastKeyRef.current = nextToast.key;
    let hasAdvanced = false;

    const advanceQueue = () => {
      if (hasAdvanced || activeToastKeyRef.current !== nextToast.key) {
        return;
      }

      hasAdvanced = true;
      activeToastKeyRef.current = null;
      nextToastTimerRef.current = window.setTimeout(() => {
        nextToastTimerRef.current = null;
        flushToastQueue();
      }, OUTREACH_TOAST_GAP_MS);
    };

    toast[nextToast.variant](nextToast.title, {
      id: nextToast.key,
      description: nextToast.description,
      duration: OUTREACH_TOAST_DURATION_MS,
      action: nextToast.action,
      onAutoClose: advanceQueue,
      onDismiss: advanceQueue,
    });
  }, []);

  const clearToastQueue = useCallback(() => {
    toastQueueRef.current = [];

    if (nextToastTimerRef.current !== null) {
      window.clearTimeout(nextToastTimerRef.current);
      nextToastTimerRef.current = null;
    }

    const activeToastKey = activeToastKeyRef.current;
    activeToastKeyRef.current = null;
    if (activeToastKey) {
      toast.dismiss(activeToastKey);
    }
  }, []);

  const enqueueToast = useCallback(
    (queuedToast: QueuedNotificationToast) => {
      toastQueueRef.current.push(queuedToast);
      flushToastQueue();
    },
    [flushToastQueue]
  );

  useEffect(() => clearToastQueue, [clearToastQueue]);

  useEffect(() => {
    if (!isAuthenticated || isLoading || shellStateQuery.isPending) {
      return;
    }

    const scopedWorkspaceId = workspaceId ?? null;
    if (baselineWorkspaceRef.current !== scopedWorkspaceId) {
      clearToastQueue();
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
        if (
          getOutreachNotificationEventTimestamp(notification) <
          workspaceSessionStartedAt
        ) {
          shownNotifications.current.add(
            getOutreachNotificationEventKey(notification)
          );
        }
      }
      baselineInitializedRef.current = true;
    }

    const toastPlan = buildOutreachNotificationToastPlan(
      pending,
      shownNotifications.current
    );

    if (toastPlan.coalescedCount > 0) {
      const unseenPending = pending.filter(
        (notification) =>
          !shownNotifications.current.has(
            getOutreachNotificationEventKey(notification)
          )
      );

      for (const notification of unseenPending) {
        shownNotifications.current.add(
          getOutreachNotificationEventKey(notification)
        );
      }

      const firstNotification = unseenPending[0];
      const lastNotification = unseenPending.at(-1);
      const burstKey = [
        "outreach-notification-burst",
        scopedWorkspaceId,
        firstNotification
          ? getOutreachNotificationEventKey(firstNotification)
          : "first",
        lastNotification
          ? getOutreachNotificationEventKey(lastNotification)
          : "last",
      ].join(":");

      enqueueToast({
        key: burstKey,
        variant: "info",
        title: `${toastPlan.coalescedCount} new notifications`,
        description:
          "Open Notifications to review the pending outreach updates.",
        action: {
          label: "View",
          onClick: () => {
            window.location.href = "/notifications";
          },
        },
      });
      return;
    }

    for (const notification of toastPlan.notifications) {
      const notificationEventKey =
        getOutreachNotificationEventKey(notification);
      shownNotifications.current.add(notificationEventKey);

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
            label: notification.actionLabel ?? "View",
            onClick: async () => {
              const resolvedTargetHref = await convex.query(
                api.outreach.resolveNotificationTarget,
                {
                  notificationId:
                    notification._id as Id<"outreachNotifications">,
                  workspaceId: workspaceId as Id<"workspaces">,
                }
              );
              window.location.href = resolvedTargetHref ?? targetHref;
            },
          }
        : undefined;

      const variant = getNotificationToastVariant(notification.type);
      enqueueToast({
        key: notificationEventKey,
        variant,
        title: notification.title,
        description: notification.message,
        action: toastAction,
      });
    }
  }, [
    isAuthenticated,
    isLoading,
    notifications,
    notificationsQuery.isSuccess,
    clearToastQueue,
    enqueueToast,
    shellStateQuery.isPending,
    workspaceId,
    workspaceSessionStartedAt,
    convex,
  ]);
}
