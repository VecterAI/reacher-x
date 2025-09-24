import { useState, useCallback } from "react";
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
      console.log(createMigrationSummary(localStorageData));

      // Migrate to Convex
      await migrateLocalStorageData({
        workspaceDescription: localStorageData.workspaceDescription,
        workspaceName: localStorageData.workspaceName,
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
          console.warn("Failed to set onboarding completed on server:", e);
        }
      }

      // Clear localStorage data after successful migration
      const clearSuccess = clearMigratedData();
      if (!clearSuccess) {
        console.warn("Failed to clear some localStorage data after migration");
      }

      const result: MigrationResult = {
        success: true,
        migratedData: localStorageData,
        errors: [],
      };

      setMigrationResult(result);
      return result;
    } catch (error) {
      console.error("Data migration failed:", error);
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
