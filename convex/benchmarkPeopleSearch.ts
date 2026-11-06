/**
 * People-search benchmark hooks (issue #122, harness in benchmarks/people-search).
 *
 * Internal only. Runs ReacherX the way a new user would: the setup draft is
 * generated from the query text with the production models, the workspace is
 * created as setup would create it, and one prospecting cycle runs. Meant for
 * dev deployments, driven by `npx convex run`.
 */
import { v } from "convex/values";
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

const BENCHMARK_NAME_PREFIX = "Benchmark ";
const BENCHMARK_FIT_SCORE_MIN = 70; // same default as setup (DEFAULT_SETUP_FIT_SCORE_MIN)
const MAX_PROSPECTS_READ = 2000;
const MAX_COST_EVENTS_READ = 5000;
const EVIDENCE_POSTS_KEPT = 3;
const EVIDENCE_TEXT_CHARS = 1500;

export const prepareAndStart = internalAction({
  args: {
    userId: v.id("users"),
    queryId: v.string(),
    prompt: v.string(),
    useCaseKey: workspaceUseCaseKeyValidator,
  },
  handler: async (
    ctx,
    args
  ): Promise<{ workspaceId: Id<"workspaces">; startedAt: number }> => {
    const draft = await generateInitialSetupDraft({
      operation: "benchmarkPeopleSearchSetupDraft",
      seedDescription: args.prompt,
      useCaseKey: resolveWorkspaceUseCaseKey(args.useCaseKey),
    });
    const startedAt = Date.now();
    const workspaceId = await ctx.runMutation(
      internal.workspaces.createWorkspaceInternal,
      {
        userId: args.userId,
        name: `${BENCHMARK_NAME_PREFIX}${args.queryId}`,
        description: draft.improvedDescription,
        rawUserDescription: args.prompt,
        seedDescription: args.prompt,
        improvedDescription: draft.improvedDescription,
        icps: markWorkspaceProfilesAsAiGenerated(draft.icps),
        targetingSpec: draft.targetingSpec,
        descriptionSource: "manual",
        useCaseKey: resolveWorkspaceUseCaseKey(args.useCaseKey),
        isDefault: false,
        fitScoreMin: BENCHMARK_FIT_SCORE_MIN,
        fitScoreMax: 100,
        setupCompletedAt: startedAt,
      }
    );
    await ctx.runMutation(internal.benchmarkPeopleSearch.scheduleStart, {
      workspaceId,
    });
    return { workspaceId, startedAt };
  },
});

export const scheduleStart = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    // Same entry point setup uses after a workspace is provisioned.
    await ctx.scheduler.runAfter(
      0,
      internal.workspaces.startProspectingWorkflowInternal,
      { workspaceId }
    );
    return null;
  },
});

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
    const counts = {
      total: 0,
      pending: 0,
      qualified: 0,
      disqualified: 0,
      unscored: 0,
    };
    const prospects = await ctx.db
      .query("prospects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .take(MAX_PROSPECTS_READ);
    for (const p of prospects) {
      counts.total += 1;
      if (p.qualificationStatus === "pending") counts.pending += 1;
      else if (p.qualificationStatus === "qualified") counts.qualified += 1;
      else if (p.qualificationStatus === "disqualified")
        counts.disqualified += 1;
      else counts.unscored += 1;
    }
    return {
      workspaceStatus: workspace.prospectingWorkflowStatus ?? null,
      workflowState,
      fitScoreMin: workspace.fitScoreMin ?? BENCHMARK_FIT_SCORE_MIN,
      counts,
    };
  },
});

export const exportProspects = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) return null;
    const prospects = await ctx.db
      .query("prospects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .take(MAX_PROSPECTS_READ);
    return {
      workspace: {
        improvedDescription: workspace.improvedDescription ?? null,
        icps: workspace.icps,
        targetingSpec: workspace.targetingSpec ?? null,
        useCaseKey: workspace.useCaseKey ?? null,
        fitScoreMin: workspace.fitScoreMin ?? BENCHMARK_FIT_SCORE_MIN,
      },
      prospects: prospects.map((p) => ({
        id: p._id,
        createdAt: p._creationTime,
        platform: p.platform,
        displayName: p.displayName ?? null,
        title: p.title ?? null,
        company: p.company ?? null,
        location: p.location ?? null,
        briefIntro: p.briefIntro ?? null,
        email: p.email ?? null,
        websiteUrl: p.websiteUrl ?? null,
        socialProfiles: p.socialProfiles ?? null,
        matchReason: p.matchReason ?? null,
        qualificationStatus: p.qualificationStatus ?? null,
        qualificationScore: p.qualificationScore ?? null,
        qualificationReasoning: p.qualificationReasoning ?? null,
        qualifiedAt: p.qualifiedAt ?? null,
        qualificationSources: p.qualificationSources ?? [],
        discoverySource: p.discoverySource ?? null,
        discoveryContext: p.discoveryContext ?? null,
        evidencePosts: (p.evidencePosts ?? [])
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

export const runCosts = internalQuery({
  args: { workspaceId: v.id("workspaces"), since: v.number() },
  handler: async (ctx, { workspaceId, since }) => {
    const byProvider: Record<
      string,
      { usd: number; requests: number; billableUnits: number }
    > = {};
    const events = await ctx.db
      .query("providerRequestEvents")
      .withIndex("by_workspace_recorded_at", (q) =>
        q.eq("workspaceId", workspaceId).gte("recordedAt", since)
      )
      .take(MAX_COST_EVENTS_READ);
    for (const e of events) {
      const row = (byProvider[e.provider] ??= {
        usd: 0,
        requests: 0,
        billableUnits: 0,
      });
      row.usd += e.estimatedCostUsd;
      row.requests += 1;
      // LinkdAPI bills one credit per billable unit; used for the credit cap.
      row.billableUnits += e.billableUnits;
    }
    let llmUsd = 0;
    let llmCalls = 0;
    const usage = await ctx.db
      .query("agentUsageEvents")
      .withIndex("by_workspace_recorded_at", (q) =>
        q.eq("workspaceId", workspaceId).gte("recordedAt", since)
      )
      .take(MAX_COST_EVENTS_READ);
    for (const u of usage) {
      llmUsd += u.usage.cost ?? 0;
      llmCalls += 1;
    }
    return {
      providers: byProvider,
      providerEventsCapped: events.length === MAX_COST_EVENTS_READ,
      llmUsdRecorded: llmUsd,
      llmCallsRecorded: llmCalls,
    };
  },
});

export const stopRun = internalAction({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    // Mirrors the user-facing stop, then removes SocialAPI monitors so a
    // benchmark run leaves nothing billing in the background.
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId,
    });
    if (!workspace) return { stopped: false, monitorsDeleted: 0 };
    await ctx.runMutation(internal.tenantScheduler.pauseWorkspaceInternal, {
      workspaceId,
    });
    await ctx.runMutation(
      internal.socialapiMonitors.pauseWorkspaceMonitorsInternal,
      { workspaceId }
    );
    if (workspace.prospectingWorkflowId) {
      try {
        await workflow.cancel(
          ctx,
          workspace.prospectingWorkflowId as WorkflowId
        );
      } catch {
        // Already finished.
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
    const failures: string[] = [];
    for (const m of monitors) {
      const res = await ctx.runAction(
        internal.socialapiMonitors.deleteMonitorApiCall,
        { monitorId: m.monitorId }
      );
      if (res.success) {
        await ctx.runMutation(
          internal.socialapiMonitors.deleteMonitorRowAndDetachInternal,
          { monitorId: m.monitorId }
        );
        monitorsDeleted += 1;
      } else {
        failures.push(m.monitorId);
      }
    }
    return { stopped: true, monitorsDeleted, monitorFailures: failures };
  },
});

export const deleteBenchmarkWorkspace = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    // Frees a plan slot after a run is exported. Only benchmark workspaces.
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) return { deleted: false };
    if (!workspace.name.startsWith(BENCHMARK_NAME_PREFIX)) {
      throw new Error(
        "Refusing to delete a workspace the benchmark did not create"
      );
    }
    await requestWorkspaceDeletion(ctx, workspace);
    return { deleted: true };
  },
});

export const resetLinkdApiCircuit = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Operator reset before a run: a breaker left open by an earlier run would
    // make qualification skip every LinkedIn prospect.
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

export const linkdApiUnitsSince = internalQuery({
  args: { since: v.number() },
  handler: async (ctx, { since }) => {
    // LinkdAPI events often carry no workspaceId, so count by provider and time.
    // Only the benchmark runs on the dev deployment while it is unpaused.
    const events = await ctx.db
      .query("providerRequestEvents")
      .withIndex("by_provider_recorded_at", (q) =>
        q.eq("provider", "linkdapi").gte("recordedAt", since)
      )
      .take(MAX_COST_EVENTS_READ);
    let billableUnits = 0;
    let successes = 0;
    for (const e of events) {
      billableUnits += e.billableUnits;
      if (e.outcome === "success") successes += 1;
    }
    return { billableUnits, successes, events: events.length };
  },
});
