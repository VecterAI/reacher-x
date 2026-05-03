"use client";

import { api } from "@/convex/_generated/api";
import { useQueryWithStatus } from "./useQueryWithStatus";
import { useViewerUserRecord } from "./useViewerUserRecord";

export function useSetupThreadDraft(threadId?: string | null) {
  const { currentUser, isProvisioning } = useViewerUserRecord();
  const setupDraftQuery = useQueryWithStatus(
    api.setupSessions.getSetupSessionState,
    threadId && currentUser ? { threadId } : "skip"
  );

  return {
    setupDraft: setupDraftQuery.data ?? null,
    isLoading:
      (Boolean(threadId) && isProvisioning) || setupDraftQuery.isPending,
    error: setupDraftQuery.isError ? setupDraftQuery.error : null,
  };
}
