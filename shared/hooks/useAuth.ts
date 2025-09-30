import { useConvexAuth } from "convex/react";
import { useAuth as useWorkosAuth } from "@workos-inc/authkit-nextjs/components";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMemo, useEffect, useRef } from "react";
import { logger } from "../lib/logger";

/**
 * Simplified authentication hook that handles user storage and workspace creation
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
  const currentUser = useQuery(
    api.users.getCurrentUser,
    convexAuthenticated ? {} : "skip"
  );

  // Get workspace data (only if authenticated)
  const workspace = useQuery(
    api.workspaces.getDefaultWorkspace,
    convexAuthenticated && currentUser ? {} : "skip"
  );

  // Mutations
  const storeUser = useMutation(api.users.createOrUpdateUser);
  const ensureWorkspace = useMutation(api.workspaces.ensureDefaultWorkspace);

  // Calculate authentication state during rendering
  const isAuthenticated = useMemo(() => {
    return convexAuthenticated && !!workosUser && !!currentUser;
  }, [convexAuthenticated, workosUser, currentUser]);

  const isLoading = useMemo(() => {
    return (
      convexLoading || workosLoading || (convexAuthenticated && !currentUser)
    );
  }, [convexLoading, workosLoading, convexAuthenticated, currentUser]);

  // Track initialization to prevent duplicate calls
  const hasInitialized = useRef(false);

  // Handle user storage and workspace creation
  useEffect(() => {
    console.warn("useEffect", convexAuthenticated, workosUser, currentUser);
    const initializeUser = async () => {
      // if (!convexAuthenticated || !workosUser || hasInitialized.current) return;
      if (!workosUser || hasInitialized.current) return;

      hasInitialized.current = true;

      // logger.info("Initializing user", workosUser, currentUser);
      console.warn("Initializing user", workosUser, currentUser);

      try {
        // Store user if not in database
        if (!currentUser) {
          // logger.info("Storing user", workosUser, currentUser);
          console.warn("Storing user", workosUser, currentUser);
          const res = await storeUser({
            workosUserId: workosUser.id,
            email: workosUser.email,
            firstName: workosUser.firstName || undefined,
            lastName: workosUser.lastName || undefined,
            profileImageUrl: workosUser.profilePictureUrl || undefined,
          });
          console.warn("Stored user", res);
        }

        // logger.info("Storing user", workosUser, currentUser);
        console.warn("Storing user", workosUser, currentUser);

        // Ensure workspace exists
        if (currentUser && workspace === null) {
          await ensureWorkspace({});
        }
      } catch (error) {
        logger.error("❌ User initialization failed:", error);
        hasInitialized.current = false; // Allow retry
      }
    };

    initializeUser();

    // Reset initialization flag when user logs out
    if (!convexAuthenticated) {
      hasInitialized.current = false;
    }
  }, [
    convexAuthenticated,
    workosUser,
    currentUser,
    workspace,
    storeUser,
    ensureWorkspace,
  ]);

  return {
    isAuthenticated,
    isLoading,
    user: workosUser,
    userId: currentUser?._id || null,
    workspace,
  };
}
