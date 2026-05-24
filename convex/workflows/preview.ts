import { v } from "convex/values";
import { vResultValidator } from "@convex-dev/workpool";
import { vWorkflowId } from "@convex-dev/workflow";
import { workflow } from "../lib/workflow";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation } from "../lib/functionBuilders";
import { PREVIEW_BATCH_LIMITS } from "../lib/previewBatchLimits";
import { hasRequiredWorkspaceAgentData } from "../lib/workspaceSetup";
import { formatWorkspaceLogContext } from "../lib/logHelpers";

type WorkflowId = Awaited<ReturnType<typeof workflow.start>>;

type PreviewWorkflowResult = {
  status: "completed" | "stopped" | "error";
  shouldContinue: boolean;
  readyCount: number;
  prospectsFound: number;
  reason?: string;
  nextDiscoveryAttempt?: number;
};

type PreviewOrchestrationState = {
  readyCount: number;
  qualifiedCount: number;
  pendingQualificationCount: number;
  inFlightEnrichmentCount: number;
  rankedQualifiedIds: Id<"prospects">[];
  rankedReadyIds: Id<"prospects">[];
};

type PreviewSchedulingState = {
  readyCount: number;
  qualifiedCount: number;
  pendingQualificationCount: number;
  inFlightEnrichmentCount: number;
  enqueuedCount: number;
};

function getPreviewQualifiedCandidateBuffer(
  state: Pick<
    PreviewSchedulingState,
    "qualifiedCount" | "pendingQualificationCount"
  >
) {
  return state.qualifiedCount + state.pendingQualificationCount;
}

function getPreviewReadyOrInFlightCount(
  state: Pick<
    PreviewSchedulingState,
    "readyCount" | "inFlightEnrichmentCount" | "enqueuedCount"
  >
) {
  return state.readyCount + state.inFlightEnrichmentCount + state.enqueuedCount;
}

export const previewWorkflow = workflow.define({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    workspaceId: v.id("workspaces"),
    previewRevision: v.number(),
    source: v.union(v.literal("setup"), v.literal("refine")),
    discoveryAttempt: v.optional(v.number()),
  },
  returns: v.object({
    status: v.union(
      v.literal("completed"),
      v.literal("stopped"),
      v.literal("error")
    ),
    shouldContinue: v.boolean(),
    readyCount: v.number(),
    prospectsFound: v.number(),
    reason: v.optional(v.string()),
    nextDiscoveryAttempt: v.optional(v.number()),
  }),
  handler: async (step, args): Promise<PreviewWorkflowResult> => {
    const discoveryAttempt = args.discoveryAttempt ?? 0;
    const session = await step.runQuery(
      internal.setupSessions.getByIdInternal,
      {
        sessionId: args.sessionId,
      }
    );

    if (!session) {
      return {
        status: "stopped" as const,
        shouldContinue: false,
        readyCount: 0,
        prospectsFound: 0,
        reason: "setup_session_missing",
      };
    }

    if (
      session.status === "discarded" ||
      session.targetWorkspaceId !== args.workspaceId ||
      session.previewRevision !== args.previewRevision
    ) {
      return {
        status: "stopped" as const,
        shouldContinue: false,
        readyCount: 0,
        prospectsFound: 0,
        reason: "preview_session_stale",
      };
    }

    if (
      session.status !== "discovering_preview_prospects" &&
      session.status !== "awaiting_preview_confirmation"
    ) {
      return {
        status: "stopped" as const,
        shouldContinue: false,
        readyCount: 0,
        prospectsFound: 0,
        reason: "preview_status_inactive",
      };
    }

    const workspace = await step.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });
    if (!workspace) {
      return {
        status: "error" as const,
        shouldContinue: false,
        readyCount: 0,
        prospectsFound: 0,
        reason: "workspace_missing",
      };
    }

    const workspaceLogContext = formatWorkspaceLogContext({
      workspaceId: String(args.workspaceId),
      workspaceName: workspace.name,
    });

    if (!hasRequiredWorkspaceAgentData(workspace)) {
      return {
        status: "error" as const,
        shouldContinue: false,
        readyCount: 0,
        prospectsFound: 0,
        reason: "workspace_setup_incomplete",
      };
    }

    let orchestrationState: PreviewOrchestrationState = await step.runQuery(
      internal.setupSessions.getSetupPreviewOrchestrationStateInternal,
      { sessionId: args.sessionId }
    );

    if (
      orchestrationState.readyCount >= PREVIEW_BATCH_LIMITS.readyTargetCount
    ) {
      await step.runMutation(internal.setupSessions.markPreviewReadyInternal, {
        sessionId: args.sessionId,
        previewProspectIds: orchestrationState.rankedReadyIds.slice(
          0,
          PREVIEW_BATCH_LIMITS.readyTargetCount
        ),
      });
      return {
        status: "completed" as const,
        shouldContinue: false,
        readyCount: PREVIEW_BATCH_LIMITS.readyTargetCount,
        prospectsFound: 0,
      };
    }

    const allSyntheticPosts = workspace.icps.flatMap(
      (icp: { syntheticPosts?: string[] }) => icp.syntheticPosts || []
    );

    if (allSyntheticPosts.length === 0) {
      return {
        status: "error" as const,
        shouldContinue: false,
        readyCount: orchestrationState.readyCount,
        prospectsFound: 0,
        reason: "missing_synthetic_posts",
      };
    }

    let prospectsFound = 0;
    const initialScheduling = await step.runAction(
      internal.workflows.enrichment.scheduleSetupPreviewEnrichmentInternal,
      {
        sessionId: args.sessionId,
        workspaceId: args.workspaceId,
      }
    );

    orchestrationState = await step.runQuery(
      internal.setupSessions.getSetupPreviewOrchestrationStateInternal,
      { sessionId: args.sessionId }
    );

    if (
      orchestrationState.readyCount >= PREVIEW_BATCH_LIMITS.readyTargetCount
    ) {
      await step.runMutation(internal.setupSessions.markPreviewReadyInternal, {
        sessionId: args.sessionId,
        previewProspectIds: orchestrationState.rankedReadyIds.slice(
          0,
          PREVIEW_BATCH_LIMITS.readyTargetCount
        ),
      });
      return {
        status: "completed" as const,
        shouldContinue: false,
        readyCount: PREVIEW_BATCH_LIMITS.readyTargetCount,
        prospectsFound: 0,
      };
    }

    const readyOrInFlightCount =
      getPreviewReadyOrInFlightCount(initialScheduling);
    const qualifiedCandidateBuffer =
      getPreviewQualifiedCandidateBuffer(initialScheduling);

    if (readyOrInFlightCount >= PREVIEW_BATCH_LIMITS.readyTargetCount) {
      console.info(
        `[Preview] ${workspaceLogContext} waiting for preview enrichment`,
        {
          source: args.source,
          revision: args.previewRevision,
          readyCount: initialScheduling.readyCount,
          inFlightEnrichmentCount: initialScheduling.inFlightEnrichmentCount,
          enqueuedCount: initialScheduling.enqueuedCount,
        }
      );
      return {
        status: "completed" as const,
        shouldContinue: false,
        readyCount: orchestrationState.readyCount,
        prospectsFound,
        reason: "waiting_for_preview_enrichment",
      };
    }

    if (qualifiedCandidateBuffer >= PREVIEW_BATCH_LIMITS.readyTargetCount) {
      console.info(
        `[Preview] ${workspaceLogContext} waiting for preview qualification`,
        {
          source: args.source,
          revision: args.previewRevision,
          qualifiedCount: initialScheduling.qualifiedCount,
          pendingQualificationCount:
            initialScheduling.pendingQualificationCount,
        }
      );
      return {
        status: "completed" as const,
        shouldContinue: false,
        readyCount: orchestrationState.readyCount,
        prospectsFound,
        reason: "waiting_for_preview_qualification",
      };
    }

    const discoveryResult = await step.runAction(
      internal.workflows.prospecting.runPreviewDiscoveryBurstInternal,
      {
        workspaceId: args.workspaceId,
        sessionId: args.sessionId,
        previewRevision: args.previewRevision,
      },
      { retry: { maxAttempts: 2, initialBackoffMs: 1500, base: 2 } }
    );

    prospectsFound += discoveryResult.prospectsFound;
    orchestrationState = await step.runQuery(
      internal.setupSessions.getSetupPreviewOrchestrationStateInternal,
      { sessionId: args.sessionId }
    );

    console.info(
      `[Preview] ${workspaceLogContext} legacy-style discovery burst complete`,
      {
        source: args.source,
        revision: args.previewRevision,
        discoveryAttempt,
        readyCount: orchestrationState.readyCount,
        qualifiedCount: orchestrationState.qualifiedCount,
        pendingQualificationCount: orchestrationState.pendingQualificationCount,
        twitterSaved: discoveryResult.twitterSaved,
        linkedinSaved: discoveryResult.linkedinSaved,
        prospectsFound,
      }
    );

    if (
      orchestrationState.readyCount >= PREVIEW_BATCH_LIMITS.readyTargetCount
    ) {
      await step.runMutation(internal.setupSessions.markPreviewReadyInternal, {
        sessionId: args.sessionId,
        previewProspectIds: orchestrationState.rankedReadyIds.slice(
          0,
          PREVIEW_BATCH_LIMITS.readyTargetCount
        ),
      });
      return {
        status: "completed" as const,
        shouldContinue: false,
        readyCount: PREVIEW_BATCH_LIMITS.readyTargetCount,
        prospectsFound,
      };
    }

    const postDiscoveryQualifiedCandidateBuffer =
      getPreviewQualifiedCandidateBuffer({
        qualifiedCount: orchestrationState.qualifiedCount,
        pendingQualificationCount: orchestrationState.pendingQualificationCount,
      });
    const postDiscoveryReadyOrInFlightCount = getPreviewReadyOrInFlightCount({
      readyCount: orchestrationState.readyCount,
      inFlightEnrichmentCount: orchestrationState.inFlightEnrichmentCount,
      enqueuedCount: 0,
    });

    if (
      postDiscoveryReadyOrInFlightCount >= PREVIEW_BATCH_LIMITS.readyTargetCount
    ) {
      return {
        status: "completed" as const,
        shouldContinue: false,
        readyCount: orchestrationState.readyCount,
        prospectsFound,
        reason: "waiting_for_preview_enrichment",
      };
    }

    if (
      postDiscoveryQualifiedCandidateBuffer >=
      PREVIEW_BATCH_LIMITS.readyTargetCount
    ) {
      return {
        status: "completed" as const,
        shouldContinue: false,
        readyCount: orchestrationState.readyCount,
        prospectsFound,
        reason: "waiting_for_preview_qualification",
      };
    }

    if (discoveryAttempt + 1 < PREVIEW_BATCH_LIMITS.maxCyclesPerPreviewRun) {
      console.info(
        `[Preview] ${workspaceLogContext} retrying preview discovery burst`,
        {
          source: args.source,
          revision: args.previewRevision,
          completedAttempt: discoveryAttempt,
          nextDiscoveryAttempt: discoveryAttempt + 1,
          readyCount: orchestrationState.readyCount,
          qualifiedCount: orchestrationState.qualifiedCount,
          pendingQualificationCount:
            orchestrationState.pendingQualificationCount,
          prospectsFound,
        }
      );
      return {
        status: "completed" as const,
        shouldContinue: true,
        readyCount: orchestrationState.readyCount,
        prospectsFound,
        reason: "retry_preview_discovery",
        nextDiscoveryAttempt: discoveryAttempt + 1,
      };
    }

    return {
      status: "completed" as const,
      shouldContinue: false,
      readyCount: orchestrationState.readyCount,
      prospectsFound,
      reason: "preview_discovery_retries_exhausted",
    };
  },
});

export const handlePreviewWorkflowComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({
      sessionId: v.id("workspaceSetupSessions"),
    }),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.context.sessionId);
    if (!session || session.status === "discarded") {
      return;
    }

    if (session.previewWorkflowId !== String(args.workflowId)) {
      return;
    }

    await ctx.runMutation(
      internal.setupSessions.clearPreviewWorkflowIdIfMatchesInternal,
      {
        sessionId: args.context.sessionId,
        workflowId: String(args.workflowId),
      }
    );

    if (args.result.kind === "canceled") {
      return;
    }

    if (args.result.kind !== "success") {
      await ctx.scheduler.runAfter(
        PREVIEW_BATCH_LIMITS.interCycleDelayMs,
        internal.setupSessions.startPreviewWorkflowInternal,
        {
          sessionId: args.context.sessionId,
          discoveryAttempt: 0,
        }
      );
      return;
    }

    const returnValue = args.result.returnValue as {
      status: string;
      shouldContinue: boolean;
      readyCount: number;
      prospectsFound: number;
      reason?: string;
      nextDiscoveryAttempt?: number;
    };

    if (returnValue.shouldContinue) {
      await ctx.scheduler.runAfter(
        PREVIEW_BATCH_LIMITS.interCycleDelayMs,
        internal.setupSessions.startPreviewWorkflowInternal,
        {
          sessionId: args.context.sessionId,
          discoveryAttempt: returnValue.nextDiscoveryAttempt ?? 0,
        }
      );
      return;
    }

    if (
      returnValue.reason === "waiting_for_preview_enrichment" ||
      returnValue.reason === "waiting_for_preview_qualification"
    ) {
      await ctx.scheduler.runAfter(
        PREVIEW_BATCH_LIMITS.interCycleDelayMs,
        internal.setupSessions.resumePreviewWorkflowIfNeededInternal,
        {
          sessionId: args.context.sessionId,
        }
      );
      return;
    }

    if (returnValue.reason === "preview_discovery_retries_exhausted") {
      const orchestrationState = await ctx.runQuery(
        internal.setupSessions.getSetupPreviewOrchestrationStateInternal,
        {
          sessionId: args.context.sessionId,
        }
      );
      const readyOrInFlightCount = getPreviewReadyOrInFlightCount({
        readyCount: orchestrationState.readyCount,
        inFlightEnrichmentCount: orchestrationState.inFlightEnrichmentCount,
        enqueuedCount: 0,
      });
      const qualifiedCandidateBuffer = getPreviewQualifiedCandidateBuffer({
        qualifiedCount: orchestrationState.qualifiedCount,
        pendingQualificationCount: orchestrationState.pendingQualificationCount,
      });

      if (
        orchestrationState.readyCount >= PREVIEW_BATCH_LIMITS.readyTargetCount
      ) {
        await ctx.runMutation(internal.setupSessions.markPreviewReadyInternal, {
          sessionId: args.context.sessionId,
          previewProspectIds: orchestrationState.rankedReadyIds.slice(
            0,
            PREVIEW_BATCH_LIMITS.readyTargetCount
          ),
        });
        return;
      }

      if (
        readyOrInFlightCount >= PREVIEW_BATCH_LIMITS.readyTargetCount ||
        qualifiedCandidateBuffer >= PREVIEW_BATCH_LIMITS.readyTargetCount
      ) {
        console.info("[Preview] Holding preview open after retry exhaustion", {
          sessionId: String(args.context.sessionId),
          readyCount: orchestrationState.readyCount,
          qualifiedCount: orchestrationState.qualifiedCount,
          pendingQualificationCount:
            orchestrationState.pendingQualificationCount,
          inFlightEnrichmentCount: orchestrationState.inFlightEnrichmentCount,
        });
        return;
      }

      await ctx.runMutation(
        internal.setupSessions.markPreviewDiscoveryFailedInternal,
        {
          sessionId: args.context.sessionId,
          errorMessage:
            "I couldn't find enough matching people for the preview quickly enough. Please refine the workspace description and try again.",
        }
      );
    }
  },
});

export const cancelPreviewWorkflowByIdInternal = internalAction({
  args: {
    workflowId: v.string(),
  },
  handler: async (ctx, args) => {
    const workflowId = args.workflowId as WorkflowId;

    try {
      const status = await workflow.status(ctx, workflowId);
      if (status.type === "inProgress") {
        await workflow.cancel(ctx, workflowId);
        return { cancelled: true, status: "inProgress" as const };
      }

      await workflow.cleanup(ctx, workflowId);
      return { cancelled: false, status: status.type };
    } catch (error) {
      console.warn("[Preview] Failed to cancel or clean up workflow", {
        workflowId: args.workflowId,
        error,
      });
      return { cancelled: false, status: "error" as const };
    }
  },
});
