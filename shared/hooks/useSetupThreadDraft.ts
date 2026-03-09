"use client";

import { api } from "@/convex/_generated/api";
import { useQueryWithStatus } from "./useQueryWithStatus";

export function useSetupThreadDraft(threadId?: string | null) {
  const setupDraftQuery = useQueryWithStatus(
    api.chat.getSetupThreadState,
    threadId ? { threadId } : "skip"
  );

  return {
    setupDraft: setupDraftQuery.data ?? null,
    isLoading: setupDraftQuery.isPending,
    error: setupDraftQuery.isError ? setupDraftQuery.error : null,
  };
}
