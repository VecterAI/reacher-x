"use client";

import { ReactNode } from "react";
import { useReplyStatus } from "@/shared/hooks/useReplyStatus";
import { useOutreachNotificationToast } from "@/shared/hooks/useOutreachNotificationToast";
import { useOnboardingStatusToast } from "@/shared/hooks/useOnboardingStatusToast";

/**
 * Client-side notification provider component
 *
 * This component handles global reply status monitoring and notifications.
 * It must be a client component because it uses React hooks.
 *
 * Hooks:
 * - useReplyStatus: Monitors reply status changes and shows processing/completed/failed toasts
 * - useOutreachNotificationToast: Monitors outreach notifications and shows approval/reply toasts
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  // Monitor reply status and show notifications globally
  useReplyStatus();
  // Monitor outreach notifications (approval requests, prospect replies)
  useOutreachNotificationToast();
  // Monitor onboarding setup status notifications with safe user messaging
  useOnboardingStatusToast();

  return <>{children}</>;
}
