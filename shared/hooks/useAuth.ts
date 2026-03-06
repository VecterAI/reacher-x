import { useConvexAuth } from "convex/react";
import { useAuth as useWorkosAuth } from "@workos-inc/authkit-nextjs/components";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMemo, useEffect, useRef } from "react";
import { logger } from "../lib/logger";
import { getCurrentUTCTimestamp } from "../lib/utils/time/timeUtils";

// Module-level singleflight to dedupe background profile refresh across hook consumers
let profileRefreshInFlight = false;
let profileLastRefreshMs = 0;

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

  // X account and live profile
  const xAccount = useQuery(
    api.socialAccountsMutations.getXAccount,
    convexAuthenticated ? {} : "skip"
  );
  const refreshXProfileIfStale = useAction(
    api.socialAccounts.refreshXProfileIfStale
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

  // Track steps independently to avoid missing ensureWorkspace after user creation
  const hasStoredUserRef = useRef(false);
  const hasEnsuredWorkspaceRef = useRef(false);

  // Store user in Convex if missing
  useEffect(() => {
    if (!convexAuthenticated || !workosUser) return;
    if (hasStoredUserRef.current) return;
    // Wait until currentUser finishes loading
    if (currentUser === undefined) return;
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
  }, [convexAuthenticated, workosUser, currentUser, storeUser]);

  // Ensure default workspace exists after user is present
  useEffect(() => {
    if (!convexAuthenticated) return;
    if (hasEnsuredWorkspaceRef.current) return;
    // Wait for queries to resolve
    if (currentUser === undefined || workspace === undefined) return;
    if (!currentUser) return;
    if (workspace === null) {
      (async () => {
        try {
          await ensureWorkspace({});
          hasEnsuredWorkspaceRef.current = true;
        } catch (error) {
          logger.error("❌ Ensuring workspace failed:", error);
          hasEnsuredWorkspaceRef.current = false;
        }
      })();
    } else {
      hasEnsuredWorkspaceRef.current = true;
    }
  }, [convexAuthenticated, currentUser, workspace, ensureWorkspace]);

  // Reset flags on logout
  useEffect(() => {
    if (!convexAuthenticated) {
      hasStoredUserRef.current = false;
      hasEnsuredWorkspaceRef.current = false;
    }
  }, [convexAuthenticated]);

  // Background: refresh X profile if stale with server-side TTL/backoff, deduped module-wide
  useEffect(() => {
    if (!convexAuthenticated) return;
    if (xAccount === undefined || xAccount === null) return;

    const TTL = 10 * 60 * 1000; // 10 minutes
    const now = getCurrentUTCTimestamp();

    type XAccountMeta = {
      rateLimitResetAt?: number;
      lastProfileRefreshedAt?: number;
      connectionStatus?: string;
      reauthRequired?: boolean;
      name?: string;
      screenName?: string;
      profileImageUrl?: string;
    };
    const acc = xAccount as XAccountMeta | null;

    // Skip refresh entirely if account needs reconnection — avoids repeated invalid_request calls
    if (
      acc?.connectionStatus === "reauth_required" ||
      acc?.reauthRequired === true
    )
      return;

    const resetAt: number | undefined = acc?.rateLimitResetAt;
    if (typeof resetAt === "number" && now < resetAt) return;

    const last: number | undefined = acc?.lastProfileRefreshedAt;
    if (typeof last === "number" && now - last < TTL) return;

    if (profileRefreshInFlight) return;
    if (now - profileLastRefreshMs < TTL) return;

    profileRefreshInFlight = true;
    (async () => {
      try {
        await refreshXProfileIfStale({});
        profileLastRefreshMs = getCurrentUTCTimestamp();
      } catch (error) {
        logger.warn("refreshXProfileIfStale failed:", error);
      } finally {
        profileRefreshInFlight = false;
      }
    })();
  }, [convexAuthenticated, xAccount, refreshXProfileIfStale]);

  // Derive xProfile from DB copy for render
  const xProfile = useMemo(() => {
    const acc = xAccount as {
      name?: string;
      screenName?: string;
      profileImageUrl?: string;
    } | null;
    const name = acc?.name;
    const username = acc?.screenName;
    const profileImageUrl = acc?.profileImageUrl;
    if (!name && !username && !profileImageUrl) return null;
    return {
      name: name || "",
      username: username || "",
      profile_image_url: profileImageUrl || "",
    };
  }, [xAccount]);

  return {
    isAuthenticated,
    isLoading,
    user: workosUser,
    userId: currentUser?._id || null,
    workspace,
    xAccount,
    xProfile,
  };
}
