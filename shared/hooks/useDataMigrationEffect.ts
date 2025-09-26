import { useEffect, useRef } from "react";
import { useConvexAuth } from "convex/react";
import { useDataMigration } from "./useDataMigration";

/**
 * Hook that automatically migrates localStorage data to Convex when a user first authenticates
 *
 * This hook should be used at the app level to ensure data migration happens
 * automatically when users sign up or sign in for the first time.
 *
 * Usage:
 * ```tsx
 * function App() {
 *   useDataMigrationEffect();
 *   // ... rest of app
 * }
 * ```
 */
export function useDataMigrationEffect() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { migrateData, hasDataToMigrate, isMigrating } = useDataMigration();

  // Track if we've already attempted migration for this session
  const hasAttemptedMigration = useRef(false);

  useEffect(() => {
    // Only run migration if:
    // 1. User is authenticated
    // 2. Not currently loading
    // 3. Not already migrating
    // 4. Haven't attempted migration yet
    // 5. There's actually data to migrate
    if (
      isAuthenticated &&
      !isLoading &&
      !isMigrating &&
      !hasAttemptedMigration.current &&
      hasDataToMigrate()
    ) {
      hasAttemptedMigration.current = true;

      migrateData()
        .then((result) => {
          if (result.success) {
            console.log(
              "✅ Data migration completed successfully:",
              result.migratedData
            );
          } else {
            console.warn("⚠️ Data migration failed:", result.errors);
          }
        })
        .catch((error) => {
          console.error("❌ Data migration error:", error);
        });
    }

    // Reset migration attempt flag when user logs out
    if (!isAuthenticated) {
      hasAttemptedMigration.current = false;
    }
  }, [isAuthenticated, isLoading, isMigrating, migrateData, hasDataToMigrate]);

  return {
    isMigrating,
  };
}
