// app/(webapp)/page.tsx
"use client";

import { useEffect } from "react";
import { useAuth as useWorkosAuth } from "@workos-inc/authkit-nextjs/components";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/shared/hooks/useAuth";
import { logger } from "@/shared/lib/logger";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";

export default function WebAppPage() {
  const { user, loading: authLoading } = useWorkosAuth();
  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const {
    isAuthenticated: unifiedAuth,
    isLoading: unifiedLoading,
    user: unifiedUser,
    userId,
  } = useAuth();

  // Twitter/X account status (Convex)
  const xAccount = useQuery(
    api.socialAccountsMutations.getXAccount,
    isAuthenticated ? {} : "skip"
  );

  const xLoading = isAuthenticated && xAccount === undefined;
  const xConnected = !!xAccount;
  const xHandle = xAccount?.screenName
    ? `@${xAccount.screenName}`
    : xAccount?.providerAccountId
      ? `@${xAccount.providerAccountId}`
      : "N/A";
  const xExpiresAt = xAccount?.expiresAt as number | undefined;
  const xExpiresDisplay = xExpiresAt
    ? new Date(xExpiresAt).toLocaleString()
    : "Unknown";
  const xExpired = xExpiresAt !== undefined ? Date.now() >= xExpiresAt : false;
  const xHasRefresh = Boolean(xAccount?.refreshToken);
  const xScopesRaw = xAccount?.scope || "";
  const xScopeSet = new Set(
    xScopesRaw
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const xHasTweetWrite = xScopeSet.has("tweet.write");
  const xHasMediaWrite = xScopeSet.has("media.write");
  const xHasUsersRead = xScopeSet.has("users.read");
  const xHasOffline = xScopeSet.has("offline.access");
  const xProfileHydrated = Boolean(
    xAccount?.name || xAccount?.profileImageUrl || xAccount?.screenName
  );
  const xConnectedAtDisplay = xAccount?._creationTime
    ? new Date(xAccount._creationTime).toLocaleString()
    : undefined;

  // Debug authentication state
  useEffect(() => {
    logger.info("Authentication Debug:", {
      workosUser: user,
      workosLoading: authLoading,
      convexAuthenticated: isAuthenticated,
      convexLoading: convexLoading,
      unifiedAuth: unifiedAuth,
      unifiedLoading: unifiedLoading,
      unifiedUser: unifiedUser,
      userId: userId,
      userDetails: user
        ? {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profilePictureUrl: user.profilePictureUrl,
          }
        : null,
    });

    // Additional debugging for token issues
    if (user && !isAuthenticated) {
      logger.warn(
        "WorkOS user exists but Convex auth failed - check JWT aud claim in WorkOS Dashboard"
      );
    }

    // Debug unified auth state
    if (isAuthenticated && !unifiedAuth && !unifiedLoading) {
      logger.warn("Convex authenticated but unified auth not ready yet");
    }
  }, [
    user,
    authLoading,
    isAuthenticated,
    convexLoading,
    unifiedAuth,
    unifiedLoading,
    unifiedUser,
    userId,
  ]);

  return (
    <div className="mx-auto mt-12 w-full max-w-lg px-4 pb-4">
      <h1 className="mb-4 text-center text-2xl font-medium">🆁 ReacherX</h1>

      {/* Comprehensive Debug Information */}
      {process.env.NODE_ENV === "development" && (
        <Alert className="mb-4 max-h-24 overflow-y-auto">
          <AlertTitle>Debug - System Status</AlertTitle>
          <AlertDescription className="font-mono text-xs">
            <div className="space-y-2">
              {/* Authentication Status */}
              <div className="space-y-1">
                <div className="font-semibold text-blue-600">
                  Authentication Status:
                </div>
                <div>
                  WorkOS User: {user ? "Authenticated" : "Not Authenticated"}
                </div>
                <div>WorkOS Loading: {authLoading ? "Yes" : "No"}</div>
                <div>
                  Convex Authenticated: {isAuthenticated ? "Yes" : "No"}
                </div>
                <div>Convex Loading: {convexLoading ? "Yes" : "No"}</div>
                <div>Unified Auth: {unifiedAuth ? "Yes" : "No"}</div>
                <div>Unified Loading: {unifiedLoading ? "Yes" : "No"}</div>
                <div>User ID: {userId || "None"}</div>
                {user && (
                  <div className="text-xs opacity-75">
                    Email: {user.email} | Name: {user.firstName} {user.lastName}
                  </div>
                )}

                {/* Twitter/X Account Status */}
                <div className="mt-1 space-y-1">
                  <div className="font-semibold text-sky-600">
                    Twitter Account:
                  </div>
                  <div>
                    Status:{" "}
                    {xLoading
                      ? "Loading"
                      : xConnected
                        ? "Connected"
                        : "Not Connected"}
                  </div>
                  {xConnected && (
                    <>
                      <div>Handle: {xHandle}</div>
                      <div>
                        Token Expiry: {xExpiresDisplay}{" "}
                        {xExpiresAt !== undefined && (
                          <span
                            className={
                              xExpired ? "text-red-600" : "text-green-600"
                            }
                          >
                            ({xExpired ? "Expired" : "Valid"})
                          </span>
                        )}
                      </div>
                      <div>
                        Refresh Token Present: {xHasRefresh ? "Yes" : "No"}
                      </div>
                      <div>Scopes: {xScopesRaw || "None"}</div>
                      <div>
                        Required Scopes: tweet.write[
                        {xHasTweetWrite ? "✓" : "✗"}], media.write[
                        {xHasMediaWrite ? "✓" : "✗"}], users.read[
                        {xHasUsersRead ? "✓" : "✗"}], offline.access[
                        {xHasOffline ? "✓" : "✗"}]
                      </div>
                      <div>
                        Profile Hydrated: {xProfileHydrated ? "Yes" : "No"}
                      </div>
                      {xConnectedAtDisplay && (
                        <div>Connected At: {xConnectedAtDisplay}</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
