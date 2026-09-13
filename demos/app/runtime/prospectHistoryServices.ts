import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { LocalClient } from "./LocalClient";
import type { createAppFixtures } from "./appFixtures";
import { paginateLocalRows } from "./paginationHelpers";
import { getWorkspaceUseCase } from "@/shared/lib/workspaceUseCases";

/** Seeded history belongs to the local dataset, never to the profile component. */
export function registerProspectHistoryServices(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>
) {
  const prospectFor = (id: string) => {
    const prospect = state.prospects.find((item) => item._id === id);
    if (!prospect) throw new Error("Prospect not found");
    return prospect;
  };
  client.register(
    api.outreach.getActivityLog,
    ({ prospectId, type, search, paginationOpts }) => {
      const prospect = prospectFor(prospectId);
      const rows = [
        {
          type: "qualified" as const,
          title: "Qualified",
          description:
            "Recent work and experience match this workspace's audience.",
        },
        {
          type: "found" as const,
          title: `${getWorkspaceUseCase(state.workspaces.find((workspace) => workspace._id === prospect.workspaceId)?.useCaseKey).entitySingular} found`,
          description: "Found through relevant public activity.",
        },
      ]
        .map((entry, index) => ({
          ...entry,
          _id: `demo_activity_${prospectId}_${index}` as Doc<"prospectActivityLog">["_id"],
          _creationTime: prospect._creationTime - index * 60000,
          prospectId,
          workspaceId: prospect.workspaceId,
          plan: null,
        }))
        .filter(
          (entry) =>
            (!type || entry.type === type) &&
            (!search?.trim() ||
              `${entry.title} ${entry.description}`
                .toLowerCase()
                .includes(search.trim().toLowerCase()))
        );
      return paginateLocalRows(rows, paginationOpts);
    }
  );
  client.register(
    api.interactions.getProspectInteractionsPage,
    ({ prospectId }) => {
      prospectFor(prospectId);
      return { page: [], isDone: true, continueCursor: "" };
    }
  );
  client.register(
    api.interactionsActions.refreshProspectInteractions,
    ({ prospectId }) => {
      const prospect = prospectFor(prospectId);
      return {
        createdCount: 0,
        trackingStartedAt: prospect._creationTime,
        lastSuccessAt: prospect._creationTime,
        skipped: false,
      };
    }
  );
}
