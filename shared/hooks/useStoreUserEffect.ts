import { useConvexAuth } from "convex/react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "@workos-inc/authkit-nextjs/components";

export function useStoreUserEffect() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { user } = useAuth();

  // When this state is set we know the server has stored the user.
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const storeUser = useMutation(api.users.createOrUpdateUser);

  // Query to verify user exists in database
  const currentUser = useQuery(api.users.getCurrentUser);

  // Use ref to track if we're already processing a user to prevent duplicate calls
  const isProcessingRef = useRef(false);

  // Memoize the createUser function to prevent unnecessary re-creations
  const createUser = useCallback(async () => {
    if (!user || isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;

    try {
      const id = await storeUser({
        workosUserId: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        profileImageUrl: user.profilePictureUrl || undefined,
      });

      if (id) {
        setUserId(id);
        console.log("✅ User stored in Convex database with ID:", id);
      } else {
        console.error(
          "❌ User storage returned null ID - this should not happen"
        );
      }
    } catch (error) {
      console.error("❌ Failed to store user in Convex:", error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [user, storeUser]);

  // Sync userId with currentUser from database
  useEffect(() => {
    if (currentUser && currentUser._id !== userId) {
      setUserId(currentUser._id);
      console.log("✅ User ID synced from database:", currentUser._id);
    } else if (!currentUser && userId) {
      // User was deleted or doesn't exist anymore
      setUserId(null);
      console.log(
        "❌ User no longer exists in database - session should be invalidated"
      );

      // Force logout by redirecting to logout endpoint
      if (typeof window !== "undefined") {
        window.location.href = "/logout";
      }
    }
  }, [currentUser, userId]);

  // Call the `createOrUpdateUser` mutation function to store
  // the current user in the `users` table and return the `Id` value.
  useEffect(() => {
    // If the user is not logged in don't do anything
    if (!isAuthenticated || !user) {
      setUserId(null);
      isProcessingRef.current = false;
      return;
    }

    // Only create user if we haven't already stored this user and no current user exists
    if (userId === null && !currentUser && !isProcessingRef.current) {
      createUser();
    }

    // Cleanup function
    return () => {
      // Only reset userId if user is no longer authenticated
      if (!isAuthenticated) {
        setUserId(null);
        isProcessingRef.current = false;
      }
    };
  }, [isAuthenticated, user, createUser, userId, currentUser]);

  // Periodic validation of user session
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const validateSession = () => {
      // Re-query current user to check if they still exist
      // This will trigger a re-render if user was deleted
      if (currentUser === null && userId) {
        console.log("❌ Session validation failed - user no longer exists");
        setUserId(null);
        if (typeof window !== "undefined") {
          window.location.href = "/logout";
        }
      }
    };

    // Validate session every 30 seconds
    const interval = setInterval(validateSession, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, userId, currentUser]);

  // Combine the local state with the state from context
  return {
    isLoading: isLoading || (isAuthenticated && userId === null),
    isAuthenticated: isAuthenticated && userId !== null,
    userId,
  };
}
