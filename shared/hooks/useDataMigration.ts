import { useState, useCallback } from "react";
import { logger } from "@/shared/lib/logger";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  collectLocalStorageData,
  hasDataToMigrate,
  clearMigratedData,
  validateMigrationData,
  createMigrationSummary,
  type MigrationResult,
} from "@/shared/lib/utils/dataMigration";
import {
  hasOnboardingCompletedLocally,
  clearOnboardingCompleted,
  getLocalTourStateV1,
} from "@/shared/lib/utils/localStorage";

/**
 * Hook for handling data migration from localStorage to Convex
 *
 * This hook should be used in components that need to migrate user data
 * when they first authenticate. It automatically detects localStorage data
 * and migrates it to Convex, then clears the localStorage.
 *
 * Usage:
 * ```tsx
 * const { migrateData, isMigrating, migrationResult } = useDataMigration();
 *
 * useEffect(() => {
 *   if (isAuthenticated && hasDataToMigrate()) {
 *     migrateData();
 *   }
 * }, [isAuthenticated, migrateData]);
 * ```
 */
export function useDataMigration() {
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] =
    useState<MigrationResult | null>(null);

  const migrateLocalStorageData = useMutation(
    api.workspaces.migrateLocalStorageData
  );
  const setOnboardingCompleted = useMutation(api.users.setOnboardingCompleted);
  const setTourState = useMutation(api.users.setTourState);

  const migrateData = useCallback(async (): Promise<MigrationResult> => {
    if (isMigrating) {
      return (
        migrationResult || {
          success: false,
          migratedData: {},
          errors: ["Migration already in progress"],
        }
      );
    }

    setIsMigrating(true);
    setMigrationResult(null);

    try {
      // Collect localStorage data
      const localStorageData = collectLocalStorageData();

      // Validate the data
      const validation = validateMigrationData(localStorageData);
      if (!validation.isValid) {
        const result: MigrationResult = {
          success: false,
          migratedData: localStorageData,
          errors: validation.errors,
        };
        setMigrationResult(result);
        return result;
      }

      // Log migration summary for debugging
      logger.info(createMigrationSummary(localStorageData));

      // Migrate to Convex
      await migrateLocalStorageData({
        workspaceDescription: localStorageData.workspaceDescription,
        workspaceName: localStorageData.workspaceName,
        workspaceDescriptionSource: localStorageData.workspaceDescriptionSource,
        workspaceSourceUrl: localStorageData.workspaceSourceUrl,
        workspaceLastGeneratedAt: localStorageData.workspaceLastGeneratedAt,
        keywords: localStorageData.keywords,
        suggestions: localStorageData.suggestions,
        suggestionsUserDescription: localStorageData.suggestionsUserDescription,
      });

      // If onboarding was completed locally, mirror to server
      if (hasOnboardingCompletedLocally()) {
        try {
          await setOnboardingCompleted({});
          clearOnboardingCompleted();
        } catch (e) {
          logger.warn("Failed to set onboarding completed on server:", e);
        }
      }

      // Clear localStorage data after successful migration
      const clearSuccess = clearMigratedData();
      if (!clearSuccess) {
        logger.warn("Failed to clear some localStorage data after migration");
      }

      // If tour was completed locally, mirror to server (keep local copy for unauthenticated continuity)
      try {
        const tour = getLocalTourStateV1();
        if (tour) {
          await setTourState({ tour: "v1", state: tour });
        }
      } catch (e) {
        logger.warn("Failed to migrate tour state to server:", e);
      }

      const result: MigrationResult = {
        success: true,
        migratedData: localStorageData,
        errors: [],
      };

      setMigrationResult(result);
      return result;
    } catch (error) {
      logger.error("Data migration failed:", error);
      const result: MigrationResult = {
        success: false,
        migratedData: collectLocalStorageData(),
        errors: [
          error instanceof Error ? error.message : "Unknown migration error",
        ],
      };
      setMigrationResult(result);
      return result;
    } finally {
      setIsMigrating(false);
    }
  }, [
    isMigrating,
    migrationResult,
    migrateLocalStorageData,
    setOnboardingCompleted,
    setTourState,
  ]);

  const resetMigration = useCallback(() => {
    setMigrationResult(null);
    setIsMigrating(false);
  }, []);

  return {
    migrateData,
    isMigrating,
    migrationResult,
    resetMigration,
    hasDataToMigrate: hasDataToMigrate,
  };
}
