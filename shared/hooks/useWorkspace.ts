import { useEffect } from "react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getClientErrorMessage } from "@/shared/lib/errors";
import { getWorkspaceUseCase } from "@/shared/lib/workspaceUseCases";
import { persistWorkspaceUseCaseKey } from "@/shared/lib/workspaceUseCaseCache";
import { useQueryWithStatus } from "./useQueryWithStatus";

/**
 * Hook that loads the current default workspace without creating one implicitly.
 *
 * Usage:
 * ```tsx
 * const { workspace, isLoading, error } = useWorkspace();
 * ```
 */
export function useWorkspace() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();

  // Get workspace data (only if authenticated)
  const workspaceQuery = useQueryWithStatus(
    api.workspaces.getDefaultWorkspace,
    isAuthenticated ? {} : "skip"
  );
  const workspace = workspaceQuery.data;
  const workspaceUseCase = workspace
    ? getWorkspaceUseCase(workspace.useCaseKey)
    : null;

  useEffect(() => {
    if (workspace?.useCaseKey) {
      persistWorkspaceUseCaseKey(workspace.useCaseKey);
    }
  }, [workspace?.useCaseKey]);

  const error = workspaceQuery.isError
    ? getClientErrorMessage(
        workspaceQuery.error,
        "Could not load workspace. Please try again."
      )
    : null;

  return {
    workspace,
    workspaceUseCase,
    isLoading: authLoading || (isAuthenticated && workspaceQuery.isPending),
    error,
    isEnsuring: false,
  };
}
