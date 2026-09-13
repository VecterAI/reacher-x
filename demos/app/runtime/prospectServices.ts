import {
  getWorkspaceStatsContributionFromProspect,
  mergeWorkspaceStatsContributions,
} from "@/convex/lib/readModelHelpers";
import { deriveWorkspaceSystemStatus } from "@/convex/lib/workspaceSystem";
import { api } from "@/convex/_generated/api";
import type { LocalClient } from "./LocalClient";
import type { createAppFixtures } from "./appFixtures";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { getProspectMatchReasoning } from "@/shared/lib/prospectMatchReasoningHelpers";

export function registerProspectServices(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>
) {
  const opened = new Set<string>();
  client.register(api.prospects.getOnboardingProgress, ({ workspaceId }) => {
    const workspace = state.workspaces.find((item) => item._id === workspaceId);
    if (!workspace) return null;
    const people = state.prospects.filter(
      (person) => person.workspaceId === workspaceId
    );
    const stats = mergeWorkspaceStatsContributions(null, {
      workspaceId,
      userId: workspace.userId,
      add: people
        .filter(
          (person) =>
            person.status !== "converted" && person.status !== "archived"
        )
        .map(getWorkspaceStatsContributionFromProspect),
    });
    const system = deriveWorkspaceSystemStatus(workspace);
    const disqualifiedCount = people.filter(
      (person) => person.qualificationStatus === "disqualified"
    ).length;
    return {
      found: stats.totalProspectsCount,
      twitterProspectsCount: stats.twitterProspectsCount,
      linkedInProspectsCount: stats.linkedInProspectsCount,
      qualified: stats.qualifiedProspectsCount,
      enriched: stats.readyQualifiedEnrichedCount,
      plansGenerated: stats.plansGeneratedCount,
      avgQualificationScore: stats.avgQualificationScore,
      actionableReadyCount: stats.actionableReadyCount,
      disqualifiedCount,
      pendingCount: Math.max(
        0,
        stats.totalProspectsCount -
          stats.qualifiedProspectsCount -
          disqualifiedCount
      ),
      notReadyCount: Math.max(
        0,
        stats.qualifiedProspectsCount - stats.actionableReadyCount
      ),
      readyQualifiedEnrichedCount: stats.readyQualifiedEnrichedCount,
      workflowStatus: workspace.prospectingWorkflowStatus,
      pauseReason: system.pauseReason,
      isResumable: system.canResume,
      systemMode: system.mode,
      userVisibleIssueState: { status: "none" as const, message: null },
      pipelineStartedAt: state.startedAt,
      pausedAt: system.mode === "paused" ? workspace.updatedAt : null,
      nextRunAt: null,
      phase:
        stats.actionableReadyCount > 0
          ? ("done" as const)
          : ("searching" as const),
      isDone: stats.actionableReadyCount > 0,
    };
  });
  client.register(api.prospectListFeed.getProspectListFeedState, () => ({
    hasSnapshot: true,
    pendingCount: 0,
    pendingCountCapped: false,
    pendingPreview: [],
  }));
  client.register(
    api.prospectListFeed.syncProspectListFeedSnapshot,
    () => null
  );
  client.register(api.prospectListFeed.mergePendingProspects, () => null);
  client.register(
    api.prospectListFeed.getProspectOpenedMap,
    ({ prospectIds }) =>
      Object.fromEntries(prospectIds.map((id) => [id, opened.has(id)]))
  );
  client.register(api.prospectListFeed.markProspectOpened, ({ prospectId }) => {
    opened.add(prospectId);
    return null;
  });
  client.register(api.prospects.getProspect, ({ prospectId }) => {
    const prospect = state.prospects.find((item) => item._id === prospectId);
    return prospect
      ? {
          ...prospect,
          qualificationReasoning: getProspectMatchReasoning(prospect),
        }
      : null;
  });
  client.register(api.chat.getActiveThreadForProspect, () => null);
  client.register(
    api.outreach.getProspectPlan,
    ({ prospectId }) => state.plans.get(prospectId) ?? null
  );
  client.register(api.linkedinEngagement.getEngagementsForPostKeys, () => ({}));
  client.register(api.twitterEngagement.getEngagementsForPosts, () => ({}));
  client.register(
    api.prospects.updateProspectStatus,
    ({ prospectId, status, notes, tags }) => {
      const prospect = state.prospects.find((item) => item._id === prospectId);
      if (!prospect) throw new Error("Prospect not found");
      if (
        prospect.status === "archived" &&
        status !== "archived" &&
        status !== "new"
      )
        throw new Error(
          "Unarchive this prospect before changing pipeline stage."
        );
      const now = getCurrentUTCTimestamp();
      Object.assign(prospect, {
        status,
        pipelineStage: status,
        updatedAt: now,
        stageTimestamps: { ...prospect.stageTimestamps, [status]: now },
        ...(notes === undefined ? {} : { notes }),
        ...(tags === undefined ? {} : { tags }),
      });
      return { success: true };
    }
  );
}
