import type { registerPlanServices } from "./planServices";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { getDefaultWorkspaceAgentSettings } from "@/convex/lib/workspaceAgentSettingsCore";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import type { LocalClient } from "./LocalClient";
import type { createAppFixtures } from "./appFixtures";

export function registerWorkspaceControlServices(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>,
  lifecycle: ReturnType<typeof registerPlanServices>
) {
  const settings = new Map<string, Doc<"workspaceAgentSettings">>();
  const workspaceFor = (id: string) => {
    const workspace = state.workspaces.find((item) => item._id === id);
    if (!workspace) throw new Error("Workspace not found");
    return workspace;
  };
  client.register(
    api.workspaces.updateWorkspaceSettings,
    ({ workspaceId, ...updates }) => {
      const workspace = workspaceFor(workspaceId);
      if (updates.name !== undefined && !updates.name.trim())
        throw new Error("Workspace name is required");
      Object.assign(
        workspace,
        Object.fromEntries(
          Object.entries(updates).filter(([, value]) => value !== undefined)
        ),
        { updatedAt: getCurrentUTCTimestamp() }
      );
      return {
        workspaceId: workspace._id,
        regenerationScheduledCount: 0,
        appliedIcps: workspace.icps ?? [],
      };
    }
  );
  client.register(
    api.workspaces.getWorkspaceAgentSettings,
    ({ workspaceId }) =>
      settings.get(workspaceId) ??
      getDefaultWorkspaceAgentSettings(workspaceFor(workspaceId))
  );
  client.register(
    api.workspaces.updateWorkspaceAgentSettings,
    async ({ workspaceId, autonomyMode, startExistingDraftPlans }) => {
      const current =
        settings.get(workspaceId) ??
        getDefaultWorkspaceAgentSettings(workspaceFor(workspaceId));
      const mode = autonomyMode ?? current.autonomyMode;
      const enabling =
        mode === "autonomous" && current.autonomyMode !== "autonomous";
      if (enabling && !startExistingDraftPlans)
        throw new Error(
          "Confirm that existing draft plans may start before enabling autonomous sending."
        );
      const drafts = enabling
        ? [...state.plans.values()].filter(
            ({ plan }) =>
              plan.workspaceId === workspaceId && plan.status === "draft"
          )
        : [];
      settings.set(workspaceId, {
        ...current,
        _id: `demo_settings_${workspaceId}` as Id<"workspaceAgentSettings">,
        _creationTime: getCurrentUTCTimestamp(),
        updatedAt: getCurrentUTCTimestamp(),
        autonomyMode: mode,
      });
      if (enabling) await lifecycle.startAutonomous(workspaceId);
      return {
        autonomyMode: mode,
        draftPlanCount: drafts.length,
        draftPlanCountIsCapped: false,
        planStartRunId: enabling
          ? ("demo_plan_start" as Id<"workspacePlanStartRuns">)
          : null,
      };
    }
  );
  const setStatus = (workspaceId: string, status: "running" | "paused") => {
    const changes: Pick<
      Doc<"workspaces">,
      | "prospectingWorkflowStatus"
      | "prospectingWorkflowPauseReason"
      | "updatedAt"
    > = {
      prospectingWorkflowStatus: status,
      prospectingWorkflowPauseReason:
        status === "paused" ? "manual" : undefined,
      updatedAt: getCurrentUTCTimestamp(),
    };
    Object.assign(workspaceFor(workspaceId), changes);
    client.notify();
  };
  client.register(api.workspaces.stopProspectingWorkflow, ({ workspaceId }) => {
    setStatus(workspaceId, "paused");
    return { success: true };
  });
  client.register(
    api.workspaces.startProspectingWorkflow,
    ({ workspaceId }) => {
      setStatus(workspaceId, "running");
      return {
        success: true,
        outcome: "started" as const,
        workflowId: "demo_discovery",
      };
    }
  );
  client.register(
    api.tenantScheduler.getWorkspaceSchedulerStatus,
    ({ workspaceId }) => ({
      mode: "enforced" as const,
      state:
        workspaceFor(workspaceId).prospectingWorkflowStatus === "paused"
          ? ("paused" as const)
          : ("ready" as const),
      queuedCount: 0,
      runningCount: 0,
      globalSlots: 4,
      baseSlotsPerTenant: 1,
      burstSlotsPerTenant: 2,
    })
  );
  client.register(api.tenantScheduler.getHighLoadNotice, () => null);
}
