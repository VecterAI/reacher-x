"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  getWorkspaceDeletionToastId,
  WORKSPACE_DELETION_TOAST_COPY,
} from "@/shared/lib/workspaceDeletionToast";
import { useAuth } from "./useAuth";
import { useQueryWithStatus } from "./useQueryWithStatus";

type WorkspaceDeletionStatus = "deleting" | "failed";

export function useWorkspaceDeletionToast() {
  const { isAuthenticated, isLoading } = useAuth();
  const retryWorkspaceDeletion = useMutation(api.workspaces.deleteWorkspace);
  const deletionsQuery = useQueryWithStatus(
    api.workspaces.getWorkspaceDeletions,
    isAuthenticated ? {} : "skip"
  );
  const previousStatusesRef = useRef<Map<string, WorkspaceDeletionStatus>>(
    new Map()
  );

  useEffect(() => {
    if (!isAuthenticated) {
      previousStatusesRef.current.clear();
      return;
    }
    if (isLoading || !deletionsQuery.isSuccess) {
      return;
    }

    const currentStatuses = new Map<string, WorkspaceDeletionStatus>();
    for (const deletion of deletionsQuery.data ?? []) {
      const workspaceId = String(deletion.workspaceId);
      const toastId = getWorkspaceDeletionToastId(workspaceId);
      currentStatuses.set(workspaceId, deletion.status);

      if (previousStatusesRef.current.get(workspaceId) === deletion.status) {
        continue;
      }

      if (deletion.status === "deleting") {
        toast.loading(WORKSPACE_DELETION_TOAST_COPY.loading, { id: toastId });
        continue;
      }

      const retryDeletion = () => {
        toast.loading(WORKSPACE_DELETION_TOAST_COPY.loading, { id: toastId });
        void retryWorkspaceDeletion({
          workspaceId: workspaceId as Id<"workspaces">,
        }).catch(showDeletionError);
      };
      const showDeletionError = () => {
        toast.error(WORKSPACE_DELETION_TOAST_COPY.error, {
          id: toastId,
          description: WORKSPACE_DELETION_TOAST_COPY.errorDescription,
          action: {
            label: WORKSPACE_DELETION_TOAST_COPY.retry,
            onClick: retryDeletion,
          },
        });
      };
      showDeletionError();
    }

    for (const workspaceId of previousStatusesRef.current.keys()) {
      if (!currentStatuses.has(workspaceId)) {
        toast.success(WORKSPACE_DELETION_TOAST_COPY.success, {
          id: getWorkspaceDeletionToastId(workspaceId),
        });
      }
    }

    previousStatusesRef.current = currentStatuses;
  }, [
    deletionsQuery.data,
    deletionsQuery.isSuccess,
    isAuthenticated,
    isLoading,
    retryWorkspaceDeletion,
  ]);
}
