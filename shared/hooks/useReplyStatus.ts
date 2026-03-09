import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "./useAuth";
import { Id } from "../../convex/_generated/dataModel";
import { useQueryWithStatus } from "./useQueryWithStatus";

/**
 * Hook to monitor reply status and show notifications
 * This hook automatically shows Sonner toasts for reply status changes
 * Uses server-side notification state for persistence across page refreshes
 *
 * Only runs when user is authenticated to prevent "Not authenticated" errors
 */
export function useReplyStatus() {
  const { isAuthenticated, isLoading } = useAuth();

  // Only query notifications if user is authenticated
  const notificationsQuery = useQueryWithStatus(
    api.notifications.getUserNotifications,
    isAuthenticated ? {} : "skip"
  );
  const notifications = useMemo(
    () => notificationsQuery.data ?? [],
    [notificationsQuery.data]
  );
  const markSeen = useMutation(api.notifications.markNotificationSeen);
  const dismissNotification = useMutation(
    api.notifications.dismissNotification
  );

  // Track visible toasts to prevent duplicates and enable updates
  const visibleToasts = useRef<Map<string, string>>(new Map()); // replyId -> toastId
  const shownNotifications = useRef<Set<string>>(new Set()); // replyId-status (for tracking what we've shown to user)

  // Helper function to create or update toast
  const createOrUpdateToast = useCallback(
    (
      replyId: string,
      status: string,
      originalTweetAuthor?: string,
      replyPreview?: string
    ) => {
      const commonOptions = {
        id: replyId, // Use replyId as unique identifier for automatic replacement
        duration: Infinity, // Don't auto-dismiss
        onDismiss: () => {
          // Handle swipe-to-dismiss
          visibleToasts.current.delete(replyId);
          dismissNotification({ replyId: replyId as Id<"replyQueue"> });
        },
        action: {
          label: "Dismiss",
          onClick: () => {
            visibleToasts.current.delete(replyId);
            dismissNotification({ replyId: replyId as Id<"replyQueue"> });
          },
        },
      };

      let toastId: string | number;
      if (status === "processing") {
        toastId = toast.info("Posting reply...", {
          description: `Replying to @${originalTweetAuthor || "user"}`,
          ...commonOptions,
        });
      } else if (status === "completed") {
        toastId = toast.success("Reply posted successfully!", {
          description: `Reply to @${originalTweetAuthor || "user"}: "${
            replyPreview || "Media reply"
          }"`,
          ...commonOptions,
        });
      } else if (status === "failed") {
        toastId = toast.error("Reply failed to post", {
          description: `Failed to reply to @${originalTweetAuthor || "user"}`,
          ...commonOptions,
        });
      } else {
        return; // Don't show toast for other statuses
      }

      // Track the new toast
      if (toastId) {
        visibleToasts.current.set(replyId, String(toastId));
      }
    },
    [dismissNotification]
  );

  useEffect(() => {
    // Don't run if not authenticated, still loading, or no notifications
    if (!isAuthenticated || isLoading || !notificationsQuery.isSuccess) return;

    // Process each notification
    notifications.forEach((notification) => {
      const {
        replyId,
        status,
        originalTweetAuthor,
        replyPreview,
        userDismissedAt,
      } = notification;

      // Skip if already dismissed by user
      if (userDismissedAt) {
        // Clean up any existing toast
        const existingToastId = visibleToasts.current.get(replyId);
        if (existingToastId) {
          toast.dismiss(existingToastId);
          visibleToasts.current.delete(replyId);
        }
        return;
      }

      // Only show notification if we haven't shown this exact status before
      const notificationKey = `${replyId}-${status}`;
      if (!shownNotifications.current.has(notificationKey)) {
        createOrUpdateToast(replyId, status, originalTweetAuthor, replyPreview);
        shownNotifications.current.add(notificationKey);

        // Mark as seen for final statuses (completed/failed) to prevent re-processing
        if (status === "completed" || status === "failed") {
          markSeen({ replyId: replyId as Id<"replyQueue"> });
        }
      }
    });

    // Clean up processed notifications that are no longer in the current list
    const currentReplyIds = new Set(notifications.map((n) => n.replyId));
    for (const [replyId] of visibleToasts.current) {
      if (!currentReplyIds.has(replyId as Id<"replyQueue">)) {
        const toastId = visibleToasts.current.get(replyId);
        if (toastId) {
          toast.dismiss(toastId);
        }
        visibleToasts.current.delete(replyId);
      }
    }

    // Clean up shown notifications for replies that no longer exist
    const currentNotificationKeys = new Set(
      notifications.map((n) => `${n.replyId}-${n.status}`)
    );
    for (const key of shownNotifications.current) {
      if (!currentNotificationKeys.has(key)) {
        shownNotifications.current.delete(key);
      }
    }
  }, [
    isAuthenticated,
    isLoading,
    notifications,
    notificationsQuery.isSuccess,
    createOrUpdateToast,
    markSeen,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    const currentVisibleToasts = visibleToasts.current;
    const currentShownNotifications = shownNotifications.current;

    return () => {
      // Dismiss all visible toasts on unmount
      for (const toastId of currentVisibleToasts.values()) {
        toast.dismiss(toastId);
      }
      currentVisibleToasts.clear();
      currentShownNotifications.clear();
    };
  }, []);

  return {
    notifications,
  };
}
