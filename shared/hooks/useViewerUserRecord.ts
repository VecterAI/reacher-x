import { useEffect, useMemo, useRef } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { useAuth as useWorkosAuth } from "@workos-inc/authkit-nextjs/components";
import { api } from "@/convex/_generated/api";
import { logger } from "@/shared/lib/logger";
import { useQueryWithStatus } from "./useQueryWithStatus";

export function useViewerUserRecord() {
  const { isAuthenticated: convexAuthenticated, isLoading: convexLoading } =
    useConvexAuth();
  const { user: workosUser, loading: workosLoading } = useWorkosAuth();
  const storeUser = useMutation(api.users.createOrUpdateUser);
  const hasStoredUserRef = useRef(false);

  const currentUserQuery = useQueryWithStatus(
    api.users.getCurrentUser,
    convexAuthenticated ? {} : "skip"
  );
  const currentUser = currentUserQuery.data ?? null;

  useEffect(() => {
    if (!convexAuthenticated || !workosUser) {
      hasStoredUserRef.current = false;
      return;
    }
    if (hasStoredUserRef.current) return;
    if (currentUserQuery.isPending || currentUserQuery.isError) return;
    if (currentUser) {
      hasStoredUserRef.current = true;
      return;
    }

    void (async () => {
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
        logger.error("Failed to store viewer user record:", error);
        hasStoredUserRef.current = false;
      }
    })();
  }, [
    convexAuthenticated,
    currentUser,
    currentUserQuery.isError,
    currentUserQuery.isPending,
    storeUser,
    workosUser,
  ]);

  const isProvisioning = useMemo(() => {
    if (!convexAuthenticated || !workosUser) {
      return false;
    }
    return (
      currentUserQuery.isPending || (!currentUser && !currentUserQuery.isError)
    );
  }, [
    convexAuthenticated,
    currentUser,
    currentUserQuery.isError,
    currentUserQuery.isPending,
    workosUser,
  ]);

  return {
    currentUser,
    currentUserQuery,
    isLoading: convexLoading || workosLoading || isProvisioning,
    isProvisioning,
  };
}
