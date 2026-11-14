/**
 * People-search benchmark hooks (issue #122, harness in benchmarks/).
 *
 * Internal only, for development deployments, driven through the Convex CLI.
 * A workspace is prepared the way setup prepares one, but discovery starts in
 * a separate call so the runner can apply the learning condition first. The
 * runner keeps one benchmark workspace active at a time. Nothing here deletes
 * data automatically; `deleteBenchmarkWorkspace` is for an approved manual
 * cleanup only.
 */
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { WorkflowId } from "@convex-dev/workflow";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./lib/functionBuilders";
import { generateInitialSetupDraft } from "./lib/setupGenerationCore";
import { markWorkspaceProfilesAsAiGenerated } from "./lib/workspaceProfileChangeCore";
import { workflow } from "./lib/workflow";
import { requestWorkspaceDeletion } from "./workflows/deleteWorkspace";
import { workspaceUseCaseKeyValidator } from "./validators";
import { resolveWorkspaceUseCaseKey } from "../shared/lib/workspaceUseCases";
import { QUALIFICATION_THRESHOLD } from "../shared/lib/qualificationConstants";
import { resolvePoolLimits } from "./lib/benchmarkConcurrency";

const BENCHMARK_NAME_PREFIX = "Benchmark ";
const LABEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const MAX_STATUS_ROWS = 2000;
const MAX_COST_EVENTS_READ = 5000;
const EVIDENCE_POSTS_KEPT = 3;
const EVIDENCE_TEXT_CHARS = 1500;
const DELETE_WINDOW_MS = 10 * 60 * 1000;
const MAX_SCHEDULED_SCAN = 1000;
// workflows/prospecting:startNextCycle; the backend may include the module's extension.
const NEXT_CYCLE_FUNCTION = /^workflows\/prospecting(?:\.js)?:startNextCycle$/;
const MAX_ACTIVITY_ROWS = 500;

function benchmarkWorkspaceName(label: string) {
  if (!LABEL_PATTERN.test(label)) {
    throw new Error("Benchmark labels use letters, digits, '-' and '_' only");
  }
  return `${BENCHMARK_NAME_PREFIX}${label}`;
}

/** Creates the workspace from the prompt with production setup models. Does not start discovery. */
export const prepareWorkspace = internalAction({
  args: {
    userId: v.id("users"),
    label: v.string(),
    prompt: v.string(),
    useCaseKey: workspaceUseCaseKeyValidator,
  },
  handler: async (
    ctx,
    args
  ): Promise<{ workspaceId: Id<"workspaces">; createdAt: number }> => {
    const name = benchmarkWorkspaceName(args.label);
    const useCaseKey = resolveWorkspaceUseCaseKey(args.useCaseKey);
    const draft = await generateInitialSetupDraft({
      operation: "benchmarkPeopleSearchSetupDraft",
      seedDescription: args.prompt,
      useCaseKey,
    });
    const createdAt = Date.now();
    const workspaceId = await ctx.runMutation(
      internal.workspaces.createWorkspaceInternal,
      {
        userId: args.userId,
        name,
        description: draft.improvedDescription,
        rawUserDescription: args.prompt,
        seedDescription: args.prompt,
        improvedDescription: draft.improvedDescription,
        icps: markWorkspaceProfilesAsAiGenerated(draft.icps),
        targetingSpec: draft.targetingSpec,
        descriptionSource: "manual",
        useCaseKey,
        isDefault: false,
        fitScoreMin: QUALIFICATION_THRESHOLD,
        fitScoreMax: 100,
        setupCompletedAt: createdAt,
      }
    );
    return { workspaceId, createdAt };
  },
});

/** Recovers a prepared workspace when the prepare call timed out after creating it. */
export const findRunWorkspace = internalQuery({
  args: { userId: v.id("users"), label: v.string(), since: v.number() },
  handler: async (ctx, { userId, label, since }) => {
    const name = benchmarkWorkspaceName(label);
    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    const match = workspaces.find(
      (workspace) =>
        workspace.name === name &&
        workspace._creationTime >= since &&
        !workspace.deletionWorkflowId
    );
    return match
      ? { workspaceId: match._id, createdAt: match._creationTime }
      : null;
  },
});

/** Starts discovery through the same entry point setup uses. Refuses a started or non-benchmark workspace. */
export const startWorkspace = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace?.name.startsWith(BENCHMARK_NAME_PREFIX)) {
      throw new Error("Only benchmark workspaces can be started here");
    }
    if (
      workspace.prospectingWorkflowId ||
      workspace.prospectingWorkflowStatus
    ) {
      throw new Error("This benchmark workspace has already been started");
    }
    await ctx.scheduler.runAfter(
      0,
      internal.workspaces.startProspectingWorkflowInternal,
      { workspaceId }
    );
    return null;
  },
});

/** Polled by the runner. Cycles are counted runner-side from distinct workflow IDs. */
export const runStatus = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) return null;
    let workflowState: string | null = null;
    if (workspace.prospectingWorkflowId) {
      try {
        const status = await workflow.status(
          ctx,
          workspace.prospectingWorkflowId as WorkflowId
        );
        workflowState = status.type;
      } catch {
        workflowState = "unknown";
      }
    }
    const prospects = await ctx.db
      .query("prospects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .take(MAX_STATUS_ROWS + 1);
    const counts = {
      total: 0,
      pending: 0,
      qualified: 0,
      disqualified: 0,
      unscored: 0,
      organizations: 0,
    };
    for (const prospect of prospects.slice(0, MAX_STATUS_ROWS)) {
      counts.total += 1;
      if (prospect.prospectType === "organization") counts.organizations += 1;
      if (prospect.qualificationStatus === "pending") counts.pending += 1;
      else if (prospect.qualificationStatus === "qualified")
        counts.qualified += 1;
      else if (prospect.qualificationStatus === "disqualified")
        counts.disqualified += 1;
      else counts.unscored += 1;
    }
    // Lesson writing: memory events not yet processed, ignored or failed.
    const [pendingLessons, processingLessons] = await Promise.all(
      (["pending", "processing"] as const).map((status) =>
        ctx.db
          .query("memoryWorkflowEvents")
          .withIndex("by_workspace_status_occurred_at", (q) =>
            q.eq("workspaceId", workspaceId).eq("status", status)
          )
          .take(MAX_STATUS_ROWS + 1)
      )
    );
    return {
      workspaceStatus: workspace.prospectingWorkflowStatus ?? null,
      pauseReason: workspace.prospectingWorkflowPauseReason ?? null,
      workflowId: workspace.prospectingWorkflowId ?? null,
      workflowState,
      workflowStartedAt: workspace.prospectingWorkflowStartedAt ?? null,
      nextRunAt: workspace.prospectingNextRunAt ?? null,
      bootstrapCycleCount: workspace.prospectingBootstrapCycleCount ?? null,
      bootstrapCompletedAt: workspace.prospectingBootstrapCompletedAt ?? null,
      counts,
      pendingLessonWrites: pendingLessons.length + processingLessons.length,
      truncated:
        prospects.length > MAX_STATUS_ROWS ||
        pendingLessons.length > MAX_STATUS_ROWS ||
        processingLessons.length > MAX_STATUS_ROWS,
    };
  },
});

/** Factual prospect fields for private export. Contact details are excluded. */
export const exportCandidates = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { workspaceId, paginationOpts }) => {
    const result = await ctx.db
      .query("prospects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((prospect) => ({
        id: prospect._id,
        createdAt: prospect._creationTime,
        platform: prospect.platform,
        prospectType: prospect.prospectType ?? null,
        displayName: prospect.displayName ?? null,
        title: prospect.title ?? null,
        company: prospect.company ?? null,
        location: prospect.location ?? null,
        briefIntro: prospect.briefIntro ?? null,
        websiteUrl: prospect.websiteUrl ?? null,
        socialProfiles: prospect.socialProfiles ?? null,
        matchReason: prospect.matchReason ?? null,
        matchedKeywords: prospect.matchedKeywords ?? [],
        qualificationStatus: prospect.qualificationStatus ?? null,
        qualificationScore: prospect.qualificationScore ?? null,
        qualificationReasoning: prospect.qualificationReasoning ?? null,
        qualifiedAt: prospect.qualifiedAt ?? null,
        disqualifiedAt: prospect.disqualifiedAt ?? null,
        qualificationSources: prospect.qualificationSources ?? [],
        evidencePosts: (prospect.evidencePosts ?? [])
          .slice(0, EVIDENCE_POSTS_KEPT)
          // Cut by code points so an emoji is never split into a lone surrogate.
          .map((post) =>
            Array.from(JSON.stringify(post))
              .slice(0, EVIDENCE_TEXT_CHARS)
              .join("")
          ),
      })),
    };
  },
});

/** Usage recorded by the app since a time. The OpenRouter key's own spend remains the cost of record. */
export const runCosts = internalQuery({
  args: { workspaceId: v.id("workspaces"), since: v.number() },
  handler: async (ctx, { workspaceId, since }) => {
    const providers: Record<
      string,
      { usd: number; requests: number; billableUnits: number }
    > = {};
    const events = await ctx.db
      .query("providerRequestEvents")
      .withIndex("by_workspace_recorded_at", (q) =>
        q.eq("workspaceId", workspaceId).gte("recordedAt", since)
      )
      .take(MAX_COST_EVENTS_READ);
    for (const event of events) {
      const row = (providers[event.provider] ??= {
        usd: 0,
        requests: 0,
        billableUnits: 0,
      });
      row.usd += event.estimatedCostUsd;
      row.requests += 1;
      row.billableUnits += event.billableUnits;
    }
    let llmUsdRecorded = 0;
    const usage = await ctx.db
      .query("agentUsageEvents")
      .withIndex("by_workspace_recorded_at", (q) =>
        q.eq("workspaceId", workspaceId).gte("recordedAt", since)
      )
      .take(MAX_COST_EVENTS_READ);
    for (const event of usage) llmUsdRecorded += event.usage.cost ?? 0;
    return {
      providers,
      llmUsdRecorded,
      llmCallsRecorded: usage.length,
      capped:
        events.length === MAX_COST_EVENTS_READ ||
        usage.length === MAX_COST_EVENTS_READ,
    };
  },
});

/** LinkedIn data events often have no workspace; only the active benchmark runs while jobs are unpaused. */
export const linkdApiUnitsSince = internalQuery({
  args: { since: v.number() },
  handler: async (ctx, { since }) => {
    const events = await ctx.db
      .query("providerRequestEvents")
      .withIndex("by_provider_recorded_at", (q) =>
        q.eq("provider", "linkdapi").gte("recordedAt", since)
      )
      .take(MAX_COST_EVENTS_READ);
    let billableUnits = 0;
    let successes = 0;
    for (const event of events) {
      billableUnits += event.billableUnits;
      if (event.outcome === "success") successes += 1;
    }
    return {
      billableUnits,
      successes,
      events: events.length,
      capped: events.length === MAX_COST_EVENTS_READ,
    };
  },
});

/**
 * Pauses the workspace, cancels its workflow and removes its SocialAPI
 * monitors so nothing keeps billing. Funded provider keys are restored only
 * after this reports no monitor failures.
 */
export const stopRun = internalAction({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId,
    });
    if (!workspace)
      return {
        stopped: false,
        cancelFailed: false,
        monitorsDeleted: 0,
        monitorFailures: [],
      };
    await ctx.runMutation(internal.tenantScheduler.pauseWorkspaceInternal, {
      workspaceId,
    });
    await ctx.runMutation(
      internal.socialapiMonitors.pauseWorkspaceMonitorsInternal,
      { workspaceId }
    );
    let cancelFailed = false;
    if (workspace.prospectingWorkflowId) {
      const workflowId = workspace.prospectingWorkflowId as WorkflowId;
      try {
        await workflow.cancel(ctx, workflowId);
      } catch {
        // Fine only if the workflow has already reached a terminal state.
        const status = await workflow.status(ctx, workflowId).catch(() => null);
        cancelFailed =
          status?.type !== "completed" &&
          status?.type !== "failed" &&
          status?.type !== "canceled";
      }
    }
    await ctx.runMutation(internal.workflows.prospecting.updateWorkflowStatus, {
      workspaceId,
      status: "paused",
      pauseReason: "manual",
    });
    const monitors = await ctx.runQuery(
      internal.socialapiMonitors.listWorkspaceMonitorsInternal,
      { workspaceId }
    );
    let monitorsDeleted = 0;
    const monitorFailures: string[] = [];
    for (const monitor of monitors) {
      const result = await ctx.runAction(
        internal.socialapiMonitors.deleteMonitorApiCall,
        { monitorId: monitor.monitorId }
      );
      if (result.success) {
        await ctx.runMutation(
          internal.socialapiMonitors.deleteMonitorRowAndDetachInternal,
          { monitorId: monitor.monitorId }
        );
        monitorsDeleted += 1;
      } else {
        monitorFailures.push(monitor.monitorId);
      }
    }
    return {
      stopped: !cancelFailed,
      cancelFailed,
      monitorsDeleted,
      monitorFailures,
    };
  },
});

/**
 * Cancels next-cycle starts already scheduled for a benchmark workspace, so a
 * run ends after its planned cycles. The workspace keeps running, so
 * qualification and lesson writing finish before the runner stops it.
 */
export const cancelScheduledCycles = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace?.name.startsWith(BENCHMARK_NAME_PREFIX)) {
      throw new Error("Only benchmark workspaces can be held here");
    }
    // A next cycle is scheduled as the previous one completes, so it is among the newest entries.
    const recent = await ctx.db.system
      .query("_scheduled_functions")
      .order("desc")
      .take(MAX_SCHEDULED_SCAN);
    let canceled = 0;
    for (const job of recent) {
      const [jobArgs] = job.args as [{ workspaceId?: unknown } | undefined];
      if (
        job.state.kind === "pending" &&
        NEXT_CYCLE_FUNCTION.test(job.name) &&
        jobArgs?.workspaceId === workspaceId
      ) {
        await ctx.scheduler.cancel(job._id);
        canceled += 1;
      }
    }
    if (canceled > 0) {
      await ctx.db.patch(workspaceId, { prospectingNextRunAt: undefined });
    }
    return { canceled, truncated: recent.length === MAX_SCHEDULED_SCAN };
  },
});

/**
 * Workspaces that could spend while jobs are unpaused for a run: any running
 * workspace, and any stopped one with an automatic restart pending. A run
 * starts only when nothing but its own workspace is listed.
 */
export const deploymentActivity = internalQuery({
  args: { exceptWorkspaceId: v.optional(v.id("workspaces")) },
  handler: async (ctx, { exceptWorkspaceId }) => {
    const [running, stopped] = await Promise.all(
      (["running", "stopped"] as const).map((status) =>
        ctx.db
          .query("workspaces")
          .withIndex("by_prospecting_status_last_activity", (q) =>
            q.eq("prospectingWorkflowStatus", status)
          )
          .take(MAX_ACTIVITY_ROWS + 1)
      )
    );
    const active = [
      ...running.slice(0, MAX_ACTIVITY_ROWS),
      ...stopped
        .slice(0, MAX_ACTIVITY_ROWS)
        .filter(
          (workspace) => workspace.prospectingNextRecoveryAt !== undefined
        ),
    ].filter((workspace) => workspace._id !== exceptWorkspaceId);
    return {
      workspaceIds: active.map((workspace) => workspace._id),
      truncated:
        running.length > MAX_ACTIVITY_ROWS ||
        stopped.length > MAX_ACTIVITY_ROWS,
    };
  },
});

/**
 * The limits the workflow manager and legacy pools use right now, from the
 * same resolver they read. Call after `tenantScheduler.reconcilePoolConfigurationInternal`
 * so the pools have been updated. In enforced mode the tenant pool is used instead.
 */
export const poolLimitsStatus = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [control, enforcedOverride] = await Promise.all([
      ctx.db
        .query("tenantSchedulerControls")
        .withIndex("by_key", (q) => q.eq("key", "global"))
        .unique(),
      ctx.db
        .query("tenantSchedulerWorkspaceOverrides")
        .withIndex("by_mode", (q) => q.eq("mode", "enforced"))
        .first(),
    ]);
    return {
      ...resolvePoolLimits(),
      enforcedTenantScheduling:
        control?.mode === "enforced" || Boolean(enforcedOverride),
    };
  },
});

/** Clears a LinkedIn circuit breaker left open by an earlier run, before a new run. */
export const resetLinkdApiCircuit = internalMutation({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.db
      .query("providerCircuitStates")
      .withIndex("by_provider", (q) => q.eq("provider", "linkdapi"))
      .first();
    if (!state || state.status === "closed") return { reset: false };
    await ctx.db.patch(state._id, {
      status: "closed",
      consecutiveFailures: 0,
      openedAt: undefined,
      retryAfterAt: undefined,
      probeLeaseUntil: undefined,
      updatedAt: Date.now(),
    });
    return { reset: true, previousStatus: state.status };
  },
});

/** Manual, approved cleanup only: deletes the named workspace a run created inside its window. */
export const deleteBenchmarkWorkspace = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    label: v.string(),
    createdAt: v.number(),
  },
  handler: async (ctx, { workspaceId, label, createdAt }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) return { deleted: false };
    if (
      workspace.name !== benchmarkWorkspaceName(label) ||
      Math.abs(workspace._creationTime - createdAt) > DELETE_WINDOW_MS
    ) {
      throw new Error(
        "Refusing to delete a workspace this benchmark run did not create"
      );
    }
    await requestWorkspaceDeletion(ctx, workspace);
    return { deleted: true };
  },
});
