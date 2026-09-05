import type { GenericDatabaseReader } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";
import { isSupportedWorkspaceReportingVersion } from "./workspaceReportingAggregate";

export async function getWorkspaceReportingRollout(
  db: GenericDatabaseReader<DataModel>,
  workspaceId: Id<"workspaces">
) {
  return await db
    .query("workspaceReportingRollouts")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .unique();
}

export async function isWorkspaceReportingAggregateReady(
  db: GenericDatabaseReader<DataModel>,
  workspaceId: Id<"workspaces">
) {
  const rollout = await getWorkspaceReportingRollout(db, workspaceId);
  return (
    rollout?.status === "verified" &&
    isSupportedWorkspaceReportingVersion(rollout.aggregateVersion)
  );
}
