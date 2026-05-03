"use client";

import { ReactNode } from "react";
import { useOutreachNotificationToast } from "@/shared/hooks/useOutreachNotificationToast";
import { useOnboardingStatusToast } from "@/shared/hooks/useOnboardingStatusToast";

/**
 * Client-side notification provider component
 *
 * This component handles global reply status monitoring and notifications.
 * It must be a client component because it uses React hooks.
 *
 * Hooks:
 * - useOutreachNotificationToast: Monitors outreach notifications and shows approval/reply toasts
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  // Monitor outreach notifications (approval requests, prospect replies)
  useOutreachNotificationToast();
  // Monitor onboarding setup status notifications with safe user messaging
  useOnboardingStatusToast();

  return <>{children}</>;
}
