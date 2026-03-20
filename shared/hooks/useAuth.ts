import { useConvexAuth } from "convex/react";
import { useAuth as useWorkosAuth } from "@workos-inc/authkit-nextjs/components";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMemo, useEffect, useRef } from "react";
import { logger } from "../lib/logger";
import { getWorkspaceUseCase } from "../lib/workspaceUseCases";
import { useQueryWithStatus } from "./useQueryWithStatus";

/**
 * Simplified authentication hook that handles user storage and workspace loading
 *
 * This hook follows React best practices by:
 * 1. Calculating derived state during rendering
 * 2. Using a single Effect for side effects
 * 3. Providing a clean, minimal API
 *
 * Usage:
 * ```tsx
 * const { isAuthenticated, isLoading, user, workspace } = useAuth();
 * ```
 */
export function useAuth() {
  const { isLoading: convexLoading, isAuthenticated: convexAuthenticated } =
    useConvexAuth();
  const { user: workosUser, loading: workosLoading } = useWorkosAuth();

  // Get current user from database (only if Convex is authenticated)
  const currentUserQuery = useQueryWithStatus(
    api.users.getCurrentUser,
    convexAuthenticated ? {} : "skip"
  );
  const currentUser = currentUserQuery.data;

  // Get workspace data (only if authenticated)
  const workspaceQuery = useQueryWithStatus(
    api.workspaces.getDefaultWorkspace,
    convexAuthenticated && currentUser ? {} : "skip"
  );
  const workspace = workspaceQuery.data;

  // Mutations
  const storeUser = useMutation(api.users.createOrUpdateUser);
  // Calculate authentication state during rendering
  const isAuthenticated = useMemo(() => {
    return (
      convexAuthenticated &&
      !!workosUser &&
      currentUserQuery.isSuccess &&
      !!currentUser
    );
  }, [
    convexAuthenticated,
    currentUser,
    currentUserQuery.isSuccess,
    workosUser,
  ]);

  const isLoading = useMemo(() => {
    return (
      convexLoading ||
      workosLoading ||
      (convexAuthenticated && currentUserQuery.isPending) ||
      (!!currentUser && workspaceQuery.isPending)
    );
  }, [
    convexLoading,
    currentUser,
    currentUserQuery.isPending,
    workosLoading,
    workspaceQuery.isPending,
    convexAuthenticated,
  ]);

  const error = currentUserQuery.error ?? workspaceQuery.error ?? null;
  // Track background user storage independently from workspace loading.
  const hasStoredUserRef = useRef(false);

  // Store user in Convex if missing
  useEffect(() => {
    if (!convexAuthenticated || !workosUser) return;
    if (hasStoredUserRef.current) return;
    // Wait until currentUser finishes loading
    if (currentUserQuery.isPending) return;
    if (currentUserQuery.isError) return;
    if (currentUser) {
      hasStoredUserRef.current = true;
      return;
    }
    (async () => {
      try {
        await storeUser({
          workosUserId: workosUser.id,
          email: workosUser.email,
          firstName: workosUser.firstName || undefined,
          lastName: workosUser.lastName || undefined,
          profileImageUrl: workosUser.profilePictureUrl || undefined,
        });
        hasStoredUserRef.current = true;
      } catch (error) {
        logger.error("❌ Storing user failed:", error);
        hasStoredUserRef.current = false;
      }
    })();
  }, [
    convexAuthenticated,
    workosUser,
    currentUser,
    currentUserQuery.isError,
    currentUserQuery.isPending,
    storeUser,
  ]);

  // Reset background flags on logout
  useEffect(() => {
    if (!convexAuthenticated) {
      hasStoredUserRef.current = false;
    }
  }, [convexAuthenticated]);

  const workspaceUseCase = useMemo(() => {
    return workspace ? getWorkspaceUseCase(workspace.useCaseKey) : null;
  }, [workspace]);

  return {
    isAuthenticated,
    isLoading,
    error,
    user: workosUser,
    userId: currentUser?._id || null,
    workspace,
    workspaceUseCase,
  };
}
