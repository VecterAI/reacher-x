import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { FunctionArgs } from "convex/server";
import { buildProspectSummaryRecord } from "@/convex/lib/readModelHelpers";
import { buildOutreachProgressSummary } from "@/convex/lib/outreachProgressHelpers";
import {
  compareProspectRowsForSort,
  isInFitScoreRange,
  normalizeProspectListSort,
} from "@/convex/lib/prospectListFeedUtils";
import type { LocalClient } from "./LocalClient";
import type { createAppFixtures } from "./appFixtures";
import { paginateLocalRows } from "./paginationHelpers";

type State = ReturnType<typeof createAppFixtures>;
type ListArgs = FunctionArgs<
  typeof api.prospectSummaries.listWorkspaceProspectSummaries
>;

export function registerProspectListServices(
  client: LocalClient,
  state: State
) {
  const selectRows = (args: Omit<ListArgs, "paginationOpts">) => {
    const needle = args.searchQuery?.trim().toLowerCase();
    return state.prospects
      .map((prospect): Doc<"prospectSummaries"> => {
        const plan = state.plans.get(prospect._id);
        return {
          ...buildProspectSummaryRecord(prospect),
          _id: `${prospect._id}_summary` as Doc<"prospectSummaries">["_id"],
          _creationTime: prospect._creationTime,
          outreachProgress:
            plan && buildOutreachProgressSummary(plan.plan, plan.tasks),
        };
      })
      .filter(
        (row) =>
          row.workspaceId === args.workspaceId &&
          (!args.status || row.status === args.status) &&
          (!args.platform || row.platform === args.platform) &&
          (!args.prospectType || row.prospectType === args.prospectType) &&
          isInFitScoreRange(
            row.sortQualificationScore,
            args.fitScoreMin ?? 0,
            args.fitScoreMax ?? 100
          ) &&
          (args.createdAfterMs === undefined ||
            row.prospectCreatedAt >= args.createdAfterMs) &&
          (args.createdBeforeMs === undefined ||
            row.prospectCreatedAt < args.createdBeforeMs) &&
          (!args.qualifiedOnly || row.qualificationStatus === "qualified") &&
          (args.visibilityMode !== "ready_only" ||
            row.readyQualifiedEnriched) &&
          (args.visibilityMode !== "actionable_only" || row.actionableReady) &&
          (!needle || row.searchText.toLowerCase().includes(needle))
      )
      .sort((left, right) =>
        compareProspectRowsForSort(
          left,
          right,
          normalizeProspectListSort(args.sortBy)
        )
      );
  };
  const list = (args: ListArgs) => {
    const rows = selectRows(args);
    return paginateLocalRows(rows, args.paginationOpts);
  };
  client.register(
    api.prospectSummaries.getWorkspaceProspectStageCountsSnapshot,
    (args) => {
      const rows = selectRows(args);
      return {
        new: rows.filter((row) => row.status === "new").length,
        contacted: rows.filter((row) => row.status === "contacted").length,
        in_progress: rows.filter((row) => row.status === "in_progress").length,
      };
    }
  );
  client.register(
    api.prospectListFeed.listStableWorkspaceProspectSummaries,
    list
  );
  client.register(api.prospectSummaries.listWorkspaceProspectSummaries, list);
  client.register(api.prospectSearchUnified.searchProspectsUnified, (args) =>
    list({
      ...args,
      paginationOpts: {
        ...args.paginationOpts,
        cursor: args.unifiedCursor ?? args.paginationOpts.cursor,
      },
    })
  );
}
