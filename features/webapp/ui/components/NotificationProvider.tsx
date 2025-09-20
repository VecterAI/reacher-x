"use client";

import { ReactNode } from "react";
import { useReplyStatus } from "@/shared/hooks/useReplyStatus";

/**
 * Client-side notification provider component
 *
 * This component handles global reply status monitoring and notifications.
 * It must be a client component because it uses React hooks (useReplyStatus).
 *
 * The useReplyStatus hook:
 * - Monitors reply status changes from the Convex backend
 * - Shows toast notifications for processing, completed, and failed replies
 * - Handles notification dismissal and marking as seen
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  // Monitor reply status and show notifications globally
  useReplyStatus();

  return <>{children}</>;
}
