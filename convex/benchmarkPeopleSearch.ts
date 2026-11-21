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
import { areAutonomousJobsPaused } from "./lib/autonomousJobHelpers";
import { getSystemRuntimeConfig } from "./lib/runtimeConfigHelpers";
import { markWorkspaceProfilesAsAiGenerated } from "./lib/workspaceProfileChangeCore";
import { workflow } from "./lib/workflow";
import { requestWorkspaceDeletion } from "./workflows/deleteWorkspace";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import { workspaceUseCaseKeyValidator } from "./validators";
import { resolveWorkspaceUseCaseKey } from "../shared/lib/workspaceUseCases";
import { QUALIFICATION_THRESHOLD } from "../shared/lib/qualificationConstants";
import { resolvePoolLimits } from "./lib/benchmarkConcurrency";
import {
  BENCHMARK_WORKSPACE_PREFIX as BENCHMARK_NAME_PREFIX,
  currentBenchmarkCycle,
  resolveKeywordPostSearchLimit,
} from "./lib/benchmarkLinkdApiCap";
import {
  benchmarkMatchLimitState,
  firstMatchIds,
  resolveMatchLimitPerCycle,
  resolveMatchLimitPerQuery,
} from "./lib/benchmarkMatchLimit";

const LABEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const MAX_STATUS_ROWS = 2000;
const LESSON_STATUS_BYTES = 2_000_000;
const PROCESSING_LESSON_ROWS = 50;
// One page of `matchLimitParked`: full prospects are large, so each page is
// byte-capped well under Convex's 16 MB read limit.
const PARKED_PAGE_ROWS = 500;
const PARKED_PAGE_BYTES = 8_000_000;
const MAX_COST_EVENTS_READ = 5000;
const EVIDENCE_POSTS_KEPT = 3;
const EVIDENCE_TEXT_CHARS = 1500;
const DELETE_WINDOW_MS = 10 * 60 * 1000;
const MAX_SCHEDULED_SCAN = 1000;
// workflows/prospecting:startNextCycle and the automatic restart after a
// failed cycle; the backend may include the module's extension.
const NEXT_CYCLE_FUNCTION =
  /^(?:workflows\/prospecting(?:\.js)?:startNextCycle|workspaces(?:\.js)?:attemptProspectingWorkflowRecoveryInternal)$/;
const MAX_ACTIVITY_ROWS = 500;
// Prospects read per page when stopping or resuming a workspace's own work.
const PROSPECT_PAGE_SIZE = 100;
const PROSPECT_PAGE_BYTES = 2_000_000;
const MAX_PROSPECT_PAGES = 100;
// Enrichment claims taken before a workflow starts carry this prefix.
const ENRICHMENT_CLAIM_PREFIX = "pending:";
const ENRICHMENT_DONE = new Set(["enriched", "partial", "failed"]);
const isDecided = (status: string | undefined) =>
  status === "qualified" || status === "disqualified";

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
    // Prospect summaries carry every field counted here at a small fraction
    // of a full prospect's size (a full read of a large workspace passes
    // Convex's 16 MB read limit).
    const summaries = await ctx.db
      .query("prospectSummaries")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .take(MAX_STATUS_ROWS + 1);
    const rows = summaries.slice(0, MAX_STATUS_ROWS).map((summary) => ({
      ...summary,
      _id: summary.prospectId,
    }));
    // Development-only match limits (per cycle, per query); null when none
    // applies. The work they park is counted page by page by
    // `matchLimitParked`.
    const matchLimit = await benchmarkMatchLimitState(ctx, workspace);
    const counts = {
      total: 0,
      pending: 0,
      qualified: 0,
      disqualified: 0,
      unscored: 0,
      organizations: 0,
      // Qualified prospects whose enrichment has not finished yet.
      enrichmentWaiting: 0,
    };
    for (const prospect of rows) {
      counts.total += 1;
      if (
        prospect.qualificationStatus === "qualified" &&
        prospect.status !== "archived" &&
        !ENRICHMENT_DONE.has(prospect.enrichmentStatus ?? "")
      ) {
        counts.enrichmentWaiting += 1;
      }
      if (prospect.prospectType === "organization") counts.organizations += 1;
      if (prospect.qualificationStatus === "pending") {
        counts.pending += 1;
      } else if (prospect.qualificationStatus === "qualified")
        counts.qualified += 1;
      else if (prospect.qualificationStatus === "disqualified")
        counts.disqualified += 1;
      else counts.unscored += 1;
    }
    // Lesson writing: memory events not yet processed, ignored or failed.
    // Event payloads can be large, so each read is byte-capped; a partial
    // read reports truncated and the runner keeps waiting.
    // Convex allows one paginated query per function: pending events are
    // paginated; the few in processing (a small pool) are read directly.
    const pendingResult = await ctx.db
      .query("memoryWorkflowEvents")
      .withIndex("by_workspace_status_occurred_at", (q) =>
        q.eq("workspaceId", workspaceId).eq("status", "pending")
      )
      .paginate({
        numItems: MAX_STATUS_ROWS + 1,
        cursor: null,
        maximumBytesRead: LESSON_STATUS_BYTES,
      });
    const pendingLessons = {
      length: pendingResult.isDone
        ? pendingResult.page.length
        : Math.max(pendingResult.page.length, MAX_STATUS_ROWS + 1),
    };
    const processingLessons = await ctx.db
      .query("memoryWorkflowEvents")
      .withIndex("by_workspace_status_occurred_at", (q) =>
        q.eq("workspaceId", workspaceId).eq("status", "processing")
      )
      .take(PROCESSING_LESSON_ROWS);
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
      matchLimit: matchLimit && {
        limit: matchLimit.limit,
        qualifiedThisCycle: matchLimit.qualifiedThisCycle,
        reached: matchLimit.reached,
        queryLimit: matchLimit.queryLimit,
        queryMatches: matchLimit.queryMatches,
        queryReached: matchLimit.queryReached,
      },
      pendingLessonWrites: pendingLessons.length + processingLessons.length,
      truncated:
        summaries.length > MAX_STATUS_ROWS ||
        pendingLessons.length > MAX_STATUS_ROWS ||
        processingLessons.length >= PROCESSING_LESSON_ROWS,
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
 * One page of a workspace's prospects with the fields that say what work is
 * still open on each: qualification, enrichment and their workflow leases.
 */
export const prospectWorkPage = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { workspaceId, cursor }) => {
    // Prospect documents are large; row and byte caps keep each page small.
    const result = await ctx.db
      .query("prospects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .paginate({
        numItems: PROSPECT_PAGE_SIZE,
        cursor,
        maximumRowsRead: PROSPECT_PAGE_SIZE,
        maximumBytesRead: PROSPECT_PAGE_BYTES,
      });
    return {
      isDone: result.isDone,
      continueCursor: result.continueCursor,
      page: result.page.map((prospect) => ({
        prospectId: prospect._id,
        archived: prospect.status === "archived",
        qualificationStatus: prospect.qualificationStatus ?? null,
        qualificationWorkflowId: prospect.qualificationWorkflowId ?? null,
        enrichmentStatus: prospect.enrichmentStatus ?? null,
        enrichmentWorkflowId: prospect.enrichmentWorkflowId ?? null,
      })),
    };
  },
});

type ProspectWork = Readonly<{
  prospectId: Id<"prospects">;
  archived: boolean;
  qualificationStatus: string | null;
  qualificationWorkflowId: string | null;
  enrichmentStatus: string | null;
  enrichmentWorkflowId: string | null;
}>;

/** Every page of the workspace's open prospect work, bounded. */
async function forEachProspectPage(
  ctx: Pick<ActionCtx, "runQuery">,
  workspaceId: Id<"workspaces">,
  visit: (page: readonly ProspectWork[]) => Promise<void>
) {
  let cursor: string | null = null;
  for (let pages = 0; pages < MAX_PROSPECT_PAGES; pages++) {
    const result: {
      isDone: boolean;
      continueCursor: string;
      page: ProspectWork[];
    } = await ctx.runQuery(internal.benchmarkPeopleSearch.prospectWorkPage, {
      workspaceId,
      cursor,
    });
    await visit(result.page);
    if (result.isDone) return true;
    cursor = result.continueCursor;
  }
  return false;
}

/**
 * Pauses the workspace, cancels its workflow and removes its SocialAPI
 * monitors so nothing keeps billing. Funded provider keys are restored only
 * after this reports no monitor failures. With `halt` (a budget stop or an
 * interrupted step), the qualification and enrichment workflows already
 * running for its prospects are canceled too, so they take no further step;
 * a step already executing finishes. Never deletes data.
 */
export const stopRun = internalAction({
  args: { workspaceId: v.id("workspaces"), halt: v.optional(v.boolean()) },
  handler: async (ctx, { workspaceId, halt }) => {
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId,
    });
    if (!workspace)
      return {
        stopped: false,
        cancelFailed: false,
        monitorsDeleted: 0,
        monitorFailures: [],
        prospectWorkflowsCanceled: 0,
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
    // Paused first, so nothing new is claimed while running work is canceled.
    let prospectWorkflowsCanceled = 0;
    // Cancellations that failed while the workflow is still running.
    let prospectCancelFailures = 0;
    // Pages never read leave their workflows unconfirmed.
    let prospectScanComplete = true;
    if (halt && workspace.name.startsWith(BENCHMARK_NAME_PREFIX)) {
      prospectScanComplete = await forEachProspectPage(
        ctx,
        workspaceId,
        async (page) => {
          const running = page.flatMap((prospect) => [
            ...(prospect.qualificationWorkflowId &&
            !isDecided(prospect.qualificationStatus ?? undefined)
              ? [prospect.qualificationWorkflowId]
              : []),
            ...(prospect.enrichmentWorkflowId &&
            !prospect.enrichmentWorkflowId.startsWith(
              ENRICHMENT_CLAIM_PREFIX
            ) &&
            !ENRICHMENT_DONE.has(prospect.enrichmentStatus ?? "")
              ? [prospect.enrichmentWorkflowId]
              : []),
          ]);
          const results = await Promise.all(
            running.map(async (id) => {
              try {
                await workflow.cancel(ctx, id as WorkflowId);
                return "canceled" as const;
              } catch {
                // Fine only if the workflow has already ended.
                const status = await workflow
                  .status(ctx, id as WorkflowId)
                  .catch(() => null);
                return status && status.type !== "inProgress"
                  ? ("ended" as const)
                  : ("failed" as const);
              }
            })
          );
          prospectWorkflowsCanceled += results.filter(
            (result) => result === "canceled"
          ).length;
          prospectCancelFailures += results.filter(
            (result) => result === "failed"
          ).length;
        }
      );
    }
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
    // Prospect work that could not be confirmed stopped keeps the stop unconfirmed.
    const unresolved =
      cancelFailed || prospectCancelFailures > 0 || !prospectScanComplete;
    return {
      stopped: !unresolved,
      cancelFailed: unresolved,
      monitorsDeleted,
      monitorFailures,
      prospectWorkflowsCanceled,
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
    return await cancelPendingCycleStarts(ctx, workspaceId);
  },
});

/** Schedules the held next cycle via `startNextCycle`, replacing any pending start. */
export const releaseNextCycle = internalMutation({
  args: { workspaceId: v.id("workspaces"), notBefore: v.number() },
  returns: v.object({
    scheduledAt: v.number(),
    canceled: v.number(),
    truncated: v.boolean(),
  }),
  handler: async (ctx, { workspaceId, notBefore }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace?.name.startsWith(BENCHMARK_NAME_PREFIX)) {
      throw new Error("Only benchmark workspaces can be released here");
    }
    if (workspace.prospectingWorkflowStatus !== "running") {
      throw new Error("The benchmark workspace is not running");
    }
    if (workspace.prospectingWorkflowId) {
      const status = await workflow.status(
        ctx,
        workspace.prospectingWorkflowId as WorkflowId
      );
      if (status.type === "inProgress") {
        throw new Error("The current cycle's discovery is still running");
      }
    }
    // The runner canceled the deployment's own start when it held the cycle;
    // this scan only covers recent jobs, so a truncated one is reported, not refused.
    const { canceled, truncated } = await cancelPendingCycleStarts(
      ctx,
      workspaceId
    );
    const scheduledAt = Math.max(Date.now(), notBefore);
    await ctx.scheduler.runAt(
      scheduledAt,
      internal.workflows.prospecting.startNextCycle,
      { workspaceId }
    );
    await ctx.db.patch(workspaceId, { prospectingNextRunAt: scheduledAt });
    return { scheduledAt, canceled, truncated };
  },
});

/** Cancels the workspace's pending next-cycle starts and automatic restarts. */
async function cancelPendingCycleStarts(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">
) {
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
}

/**
 * Marks a held benchmark workspace running again at the cycle it stopped in,
 * without starting a workflow: its discovery workflow stays as it ended, and
 * any next-cycle start or automatic restart still scheduled is canceled first,
 * so no discovery can start. The cycle's start time is kept.
 */
export const markResumedInternal = internalMutation({
  args: { workspaceId: v.id("workspaces"), workflowId: v.string() },
  handler: async (ctx, { workspaceId, workflowId }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace?.name.startsWith(BENCHMARK_NAME_PREFIX))
      throw new Error("Only benchmark workspaces can be resumed here");
    if (
      workspace.deletionStartedAt !== undefined ||
      workspace.deletionWorkflowId
    )
      throw new Error("This benchmark workspace is being deleted");
    if (workspace.prospectingWorkflowStatus !== "paused")
      throw new Error("Only a paused benchmark workspace can be resumed");
    if (workspace.prospectingWorkflowId !== workflowId)
      throw new Error(
        "The workspace is no longer at the cycle the benchmark stopped"
      );
    const { canceled } = await cancelPendingCycleStarts(ctx, workspaceId);
    await ctx.db.patch(workspaceId, {
      prospectingWorkflowStatus: "running",
      prospectingWorkflowPauseReason: undefined,
      prospectingWorkflowPausedAt: undefined,
      prospectingNextRunAt: undefined,
      prospectingNextRecoveryAt: undefined,
    });
    return { cycleStartsCanceled: canceled };
  },
});

/**
 * Requeues one page of a resumed workspace's unfinished prospect work through
 * the product's own entry points: qualification for undecided prospects (with
 * any retry backoff the stop left cleared, as a manual restart clears it), and
 * enrichment for qualified prospects not yet enriched (releasing a lease whose
 * workflow is no longer running). Each prospect is checked again here.
 */
export const requeueForResumeInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    qualify: v.array(v.id("prospects")),
    enrich: v.array(
      v.object({
        prospectId: v.id("prospects"),
        // The lease to release, exactly as read; absent when there is none.
        lease: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { workspaceId, qualify, enrich }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (
      !workspace?.name.startsWith(BENCHMARK_NAME_PREFIX) ||
      workspace.prospectingWorkflowStatus !== "running"
    )
      throw new Error("Only a resumed benchmark workspace is requeued here");
    const now = Date.now();
    let qualificationQueued = 0;
    let failuresCleared = 0;
    for (const prospectId of qualify) {
      const prospect = await ctx.db.get(prospectId);
      if (
        !prospect ||
        prospect.workspaceId !== workspaceId ||
        prospect.status === "archived" ||
        isDecided(prospect.qualificationStatus)
      )
        continue;
      if (prospect.qualificationLastFailure) {
        await ctx.db.patch(prospectId, {
          qualificationLastFailure: undefined,
          updatedAt: now,
        });
        failuresCleared += 1;
      }
      await ctx.scheduler.runAfter(
        0,
        internal.workflows.qualification.startQualification,
        { prospectId, workspaceId }
      );
      qualificationQueued += 1;
    }
    let enrichmentQueued = 0;
    let leasesReleased = 0;
    for (const { prospectId, lease } of enrich) {
      const prospect = await ctx.db.get(prospectId);
      if (
        !prospect ||
        prospect.workspaceId !== workspaceId ||
        prospect.status === "archived" ||
        prospect.qualificationStatus !== "qualified" ||
        ENRICHMENT_DONE.has(prospect.enrichmentStatus ?? "") ||
        prospect.enrichmentWorkflowId !== lease
      )
        continue;
      if (lease !== undefined) {
        await ctx.db.patch(prospectId, {
          enrichmentWorkflowId: undefined,
          updatedAt: now,
        });
        leasesReleased += 1;
      }
      await ctx.scheduler.runAfter(
        0,
        internal.workflows.enrichment.startEnrichment,
        { prospectId, workspaceId }
      );
      enrichmentQueued += 1;
    }
    return {
      qualificationQueued,
      failuresCleared,
      enrichmentQueued,
      leasesReleased,
    };
  },
});

/**
 * Continues a benchmark workspace the runner stopped (a budget stop or an
 * interrupted step) at the same cycle, so that cycle can finish: its pending
 * prospects are qualified, qualified ones enriched and its lessons written.
 * No discovery workflow is started and none can be: automatic cycles must be
 * off, the cycle's discovery workflow must have ended, and scheduled cycle
 * starts are canceled before the workspace runs again. SocialAPI monitors are
 * not recreated. Development benchmark only; the runner stops the workspace
 * again afterwards.
 */
export const resumeHeldWorkspace = internalAction({
  args: { workspaceId: v.id("workspaces"), workflowId: v.string() },
  handler: async (
    ctx,
    { workspaceId, workflowId }
  ): Promise<{
    qualificationQueued: number;
    failuresCleared: number;
    enrichmentQueued: number;
    leasesReleased: number;
    leasesKept: number;
    cycleStartsCanceled: number;
    truncated: boolean;
  }> => {
    if (getSystemRuntimeConfig().prospecting.autoReschedule)
      throw new Error(
        "Turn automatic cycles off (PROSPECTING_AUTO_RESCHEDULE) before resuming"
      );
    if (areAutonomousJobsPaused())
      throw new Error("Unpause autonomous jobs before resuming");
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId,
    });
    if (!workspace?.name.startsWith(BENCHMARK_NAME_PREFIX))
      throw new Error("Only benchmark workspaces can be resumed here");
    // Discovery is never repeated or continued: its workflow must have ended.
    const discovery = await workflow
      .status(ctx, workflowId as WorkflowId)
      .catch(() => null);
    if (!discovery || discovery.type === "inProgress")
      throw new Error("The cycle's discovery workflow has not ended");

    const { cycleStartsCanceled }: { cycleStartsCanceled: number } =
      await ctx.runMutation(
        internal.benchmarkPeopleSearch.markResumedInternal,
        { workspaceId, workflowId }
      );
    await ctx.runMutation(internal.tenantScheduler.resumeWorkspaceInternal, {
      workspaceId,
    });

    const totals = {
      qualificationQueued: 0,
      failuresCleared: 0,
      enrichmentQueued: 0,
      leasesReleased: 0,
      // Enrichment workflows still running (or unreadable), left alone.
      leasesKept: 0,
    };
    const complete = await forEachProspectPage(
      ctx,
      workspaceId,
      async (page) => {
        const qualify = page
          .filter(
            (prospect) =>
              !prospect.archived &&
              !isDecided(prospect.qualificationStatus ?? undefined)
          )
          .map((prospect) => prospect.prospectId);
        const enrich: { prospectId: Id<"prospects">; lease?: string }[] = [];
        for (const prospect of page) {
          if (
            prospect.archived ||
            prospect.qualificationStatus !== "qualified" ||
            ENRICHMENT_DONE.has(prospect.enrichmentStatus ?? "")
          )
            continue;
          const lease = prospect.enrichmentWorkflowId;
          if (lease === null) {
            enrich.push({ prospectId: prospect.prospectId });
            continue;
          }
          // A claim taken before its workflow started is safe to release:
          // the queued job checks the claim before it starts anything.
          if (!lease.startsWith(ENRICHMENT_CLAIM_PREFIX)) {
            const state = await workflow
              .status(ctx, lease as WorkflowId)
              .catch(() => null);
            if (!state || state.type === "inProgress") {
              totals.leasesKept += 1;
              continue;
            }
          }
          enrich.push({ prospectId: prospect.prospectId, lease });
        }
        if (!qualify.length && !enrich.length) return;
        const result: {
          qualificationQueued: number;
          failuresCleared: number;
          enrichmentQueued: number;
          leasesReleased: number;
        } = await ctx.runMutation(
          internal.benchmarkPeopleSearch.requeueForResumeInternal,
          { workspaceId, qualify, enrich }
        );
        totals.qualificationQueued += result.qualificationQueued;
        totals.failuresCleared += result.failuresCleared;
        totals.enrichmentQueued += result.enrichmentQueued;
        totals.leasesReleased += result.leasesReleased;
      }
    );
    // Lesson writing drains the workspace's pending events one at a time.
    await ctx.scheduler.runAfter(
      0,
      internal.workflows.memory.enqueueWorkspaceMemoryEvaluationInternal,
      { workspaceId }
    );
    return { ...totals, cycleStartsCanceled, truncated: !complete };
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

/**
 * The keyword post-search cap in effect, from the same resolver the LinkdAPI
 * reservation reads, and the benchmark cycle it is counting now.
 */
export const keywordPostSearchLimitStatus = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [state, cycle] = await Promise.all([
      ctx.db
        .query("linkdapiBudgetState")
        .withIndex("by_provider", (q) => q.eq("provider", "linkdapi"))
        .first(),
      currentBenchmarkCycle(ctx),
    ]);
    const counting = cycle && state?.benchmarkCycleKey === cycle.key;
    return {
      ...resolveKeywordPostSearchLimit(),
      cycle: cycle && {
        workspaceId: cycle.workspaceId,
        workflowId: cycle.workflowId,
        calls: counting ? (state.benchmarkCycleCalls ?? 0) : 0,
        refused: counting ? (state.benchmarkCycleRefused ?? 0) : 0,
      },
    };
  },
});

/**
 * One page of the work a reached match limit parks: pending qualification,
 * and enrichment of every prospect but the cycle's first N matches, the same
 * split the gate makes, unless a workflow still holds it. Full prospects are
 * needed for the workflow IDs, so the runner pages through them; a limit not
 * reached parks nothing.
 */
export const matchLimitParked = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { workspaceId, cursor }) => {
    const parked = {
      pending: 0,
      enrichmentWaiting: 0,
      cursor: null as string | null,
    };
    const workspace = await ctx.db.get(workspaceId);
    const state = workspace && (await benchmarkMatchLimitState(ctx, workspace));
    if (!state?.reached) return parked;
    // The cycle's first N matches, from the small summaries.
    const qualified = await ctx.db
      .query("prospectSummaries")
      .withIndex("by_workspace_qualification", (q) =>
        q.eq("workspaceId", workspaceId).eq("qualificationStatus", "qualified")
      )
      .take(MAX_STATUS_ROWS);
    const firstMatches = firstMatchIds(
      state,
      qualified.map((summary) => ({ ...summary, _id: summary.prospectId }))
    );
    const page = await ctx.db
      .query("prospects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .paginate({
        numItems: PARKED_PAGE_ROWS,
        cursor,
        maximumBytesRead: PARKED_PAGE_BYTES,
      });
    for (const prospect of page.page) {
      if (prospect.qualificationStatus === "pending") {
        if (!prospect.qualificationWorkflowId) parked.pending += 1;
      } else if (
        prospect.qualificationStatus === "qualified" &&
        prospect.status !== "archived" &&
        !ENRICHMENT_DONE.has(prospect.enrichmentStatus ?? "") &&
        !prospect.enrichmentWorkflowId &&
        !firstMatches.has(prospect._id)
      )
        parked.enrichmentWaiting += 1;
    }
    parked.cursor = page.isDone ? null : page.continueCursor;
    return parked;
  },
});

/** The match limit per cycle in effect, from the same resolver the plan-limit gate reads. */
export const matchLimitStatus = internalQuery({
  args: {},
  handler: async () => resolveMatchLimitPerCycle(),
});

/** The match limit per query in effect, from the same resolver the plan-limit gate and the cycle start read. */
export const matchLimitPerQueryStatus = internalQuery({
  args: {},
  handler: async () => resolveMatchLimitPerQuery(),
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

/**
 * Manual, approved cleanup only: a benchmark workspace whose deletion started
 * but failed (issue #158) keeps its plan slot. This releases the slot by
 * clearing its setup completion; the rest of the workspace stays as it is.
 */
export const releaseStuckBenchmarkWorkspace = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    label: v.string(),
    createdAt: v.number(),
  },
  handler: async (ctx, { workspaceId, label, createdAt }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) return { released: false };
    if (
      workspace.name !== benchmarkWorkspaceName(label) ||
      Math.abs(workspace._creationTime - createdAt) > DELETE_WINDOW_MS
    ) {
      throw new Error(
        "Refusing to release a workspace this benchmark run did not create"
      );
    }
    if (workspace.deletionStartedAt === undefined) {
      throw new Error("Only a workspace whose deletion already started");
    }
    await ctx.db.patch(workspaceId, { setupCompletedAt: undefined });
    return { released: true };
  },
});
