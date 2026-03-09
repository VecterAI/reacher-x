import { useConvexAuth } from "convex/react";
import { useAuth as useWorkosAuth } from "@workos-inc/authkit-nextjs/components";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMemo, useEffect, useRef } from "react";
import { logger } from "../lib/logger";
import { getCurrentUTCTimestamp } from "../lib/utils/time/timeUtils";
import { useQueryWithStatus } from "./useQueryWithStatus";

// Module-level singleflight to dedupe background profile refresh across hook consumers
let profileRefreshInFlight = false;
let profileLastRefreshMs = 0;

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

  // X account and live profile
  const xAccountQuery = useQueryWithStatus(
    api.socialAccountsMutations.getXAccount,
    convexAuthenticated ? {} : "skip"
  );
  const xAccount = xAccountQuery.data;
  const refreshXProfileIfStale = useAction(
    api.socialAccounts.refreshXProfileIfStale
  );

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
  const xAccountError = xAccountQuery.error ?? null;

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
    error,
    user: workosUser,
    userId: currentUser?._id || null,
    workspace,
    xAccount,
    xAccountError,
    xProfile,
  };
}
