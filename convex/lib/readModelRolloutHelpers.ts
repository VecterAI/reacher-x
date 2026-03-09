import { Infer } from "convex/values";
import { readModelRebuildResultValidator } from "../validators";

export const READ_MODEL_ROLLOUT_CLEANUP_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

export type ReadModelRebuildResult = Infer<
  typeof readModelRebuildResultValidator
>;

export type ReadModelRolloutTotals = {
  rebuiltProspectSummariesCount: number;
  rebuiltWorkspaceStatsCount: number;
  rebuiltAnalyticsRowsCount: number;
  processedActivityLogsCount: number;
  processedPlansCount: number;
  processedNotificationsCount: number;
};

export function createEmptyReadModelRolloutTotals(): ReadModelRolloutTotals {
  return {
    rebuiltProspectSummariesCount: 0,
    rebuiltWorkspaceStatsCount: 0,
    rebuiltAnalyticsRowsCount: 0,
    processedActivityLogsCount: 0,
    processedPlansCount: 0,
    processedNotificationsCount: 0,
  };
}

export function mergeReadModelRolloutTotals(
  current: ReadModelRolloutTotals,
  result: ReadModelRebuildResult
): ReadModelRolloutTotals {
  return {
    rebuiltProspectSummariesCount:
      current.rebuiltProspectSummariesCount + result.prospectSummariesRebuilt,
    rebuiltWorkspaceStatsCount:
      current.rebuiltWorkspaceStatsCount +
      (result.workspaceStatsRebuilt ? 1 : 0),
    rebuiltAnalyticsRowsCount:
      current.rebuiltAnalyticsRowsCount + result.analyticsRowsRebuilt,
    processedActivityLogsCount:
      current.processedActivityLogsCount + result.activityLogsProcessed,
    processedPlansCount: current.processedPlansCount + result.plansProcessed,
    processedNotificationsCount:
      current.processedNotificationsCount + result.notificationsProcessed,
  };
}
