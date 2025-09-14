import { useEffect, useState } from "react";
import { useConvexAuth } from "convex/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Hook that ensures a user has a default workspace, creating one if it doesn't exist
 * This is a robust solution for cases where users authenticate but don't have a workspace
 *
 * Usage:
 * ```tsx
 * const { workspace, isLoading, error } = useEnsureWorkspace();
 * ```
 */
export function useEnsureWorkspace() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const [isEnsuring, setIsEnsuring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get workspace data (only if authenticated)
  const workspace = useQuery(
    api.workspaces.getDefaultWorkspace,
    isAuthenticated ? {} : "skip"
  );

  // Mutation to ensure workspace exists
  const ensureDefaultWorkspace = useMutation(
    api.workspaces.ensureDefaultWorkspace
  );

  // Ensure workspace exists when user is authenticated but no workspace found
  useEffect(() => {
    const ensureWorkspace = async () => {
      if (
        isAuthenticated &&
        !authLoading &&
        workspace === null &&
        !isEnsuring
      ) {
        setIsEnsuring(true);
        setError(null);

        try {
          await ensureDefaultWorkspace({});
          console.log("✅ Default workspace ensured for user");
        } catch (err) {
          console.error("❌ Failed to ensure default workspace:", err);
          setError(
            err instanceof Error ? err.message : "Failed to create workspace"
          );
        } finally {
          setIsEnsuring(false);
        }
      }
    };

    ensureWorkspace();
  }, [
    isAuthenticated,
    authLoading,
    workspace,
    isEnsuring,
    ensureDefaultWorkspace,
  ]);

  return {
    workspace,
    isLoading: authLoading || isEnsuring,
    error,
    isEnsuring,
  };
}
