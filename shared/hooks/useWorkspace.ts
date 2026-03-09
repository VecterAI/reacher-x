import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
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
  const error = workspaceQuery.isError
    ? workspaceQuery.error.message || "Failed to load workspace"
    : null;

  return {
    workspace,
    isLoading: authLoading || (isAuthenticated && workspaceQuery.isPending),
    error,
    isEnsuring: false,
  };
}
