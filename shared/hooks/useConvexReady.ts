import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useQueryWithStatus } from "./useQueryWithStatus";

/**
 * Protected Convex queries should wait until both the auth token and the
 * mirrored user document are available. This prevents initial page loads from
 * briefly subscribing with no identity and throwing "Not authenticated".
 */
export function useConvexReady() {
  const { isAuthenticated: convexAuthenticated, isLoading: convexAuthLoading } =
    useConvexAuth();

  const currentUserQuery = useQueryWithStatus(
    api.users.getCurrentUser,
    convexAuthenticated ? {} : "skip"
  );

  const currentUser = currentUserQuery.data;
  const isReady =
    convexAuthenticated && currentUserQuery.isSuccess && !!currentUser;
  const isLoading =
    convexAuthLoading || (convexAuthenticated && currentUserQuery.isPending);

  return {
    currentUser,
    error: currentUserQuery.error,
    isReady,
    isLoading,
  };
}
