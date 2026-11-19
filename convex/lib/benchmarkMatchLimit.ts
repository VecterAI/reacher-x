/**
 * Benchmark-only match limits (issue #122) for a development deployment,
 * applied through the plan-limit gate.
 *
 * `BENCHMARK_MATCH_LIMIT_PER_CYCLE` holds a positive whole number: the most
 * matches a benchmark workspace's (named `Benchmark ...`) current cycle may
 * qualify. Its matches are the prospects qualified in the cycle (qualifiedAt
 * at or after prospectingWorkflowStartedAt), counted the way the plan limit
 * counts them.
 *
 * `BENCHMARK_MATCH_LIMIT_PER_QUERY` holds the most matches the workspace (one
 * benchmark query) may qualify across all its cycles. Within a cycle it
 * leaves room for what earlier cycles have not used, so the cycle's limit N
 * is the lower of the limit per cycle and that remainder (with only one set,
 * that one; never below 0, when everything is parked).
 *
 * A match counts from the moment the qualification step decides it. The
 * workflow commits the verdict to the prospect only after its next steps wait
 * their turn in the shared workflow queue, which took 15 minutes in the pilot
 * while hundreds of checks kept starting, so the step also records each match
 * it decides (`benchmarkDecidedMatches`). Counts and match order take the
 * larger of the committed and the recorded matches; each alone is a lower
 * bound (a verdict recorded but not yet committed, or a match qualified by
 * another path).
 *
 * Once the cycle has N matches, the execution-time gate
 * (`backgroundWorkGuards.ts`), the qualification recovery claim and the
 * qualification step itself, at its start and again before the model call
 * (`qualificationParkedInternal`), park further qualification exactly as at
 * a plan limit. The step re-checks because it runs minutes after the gate
 * passed it. Checks already past that point finish, so a few matches over N
 * are expected. From then on enrichment stays open only for the cycle's first
 * N matches by qualifiedAt; every other prospect's enrichment (the overshoot,
 * earlier cycles' matches, and the eager enrichment of undecided LinkedIn
 * people) is parked the same way.
 *
 * The limit per cycle never touches the cycle-start limit check, the capacity
 * reconcile, the "limit_reached" status or the plan-limit notification, so
 * every cycle starts and is rescheduled as usual and its count starts at zero
 * when `prospectingWorkflowStartedAt` moves to the new cycle. The limit per
 * query mimics a used-up plan at the cycle start too: once the workspace has
 * all its matches, a cycle that starts anyway ends at once as "limit_reached"
 * and schedules no next one (`benchmarkQueryLimitState`, read by the cycle's
 * limit check). Still no reconcile or notification, which are plan-based.
 *
 * Unset means no limit, as in production, and reads or records nothing. An
 * invalid value never changes behaviour: no limit applies and its resolver
 * reports the error so the benchmark refuses to run. Workspaces not named by
 * the benchmark are never limited. Never set in production.
 */
import { v } from "convex/values";
import { env } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { BENCHMARK_WORKSPACE_PREFIX } from "./benchmarkLinkdApiCap";
import { internalMutation, internalQuery } from "./functionBuilders";
import {
  computeQualifiedProspectUsageForWorkspaceWindow,
  isProspectEligibleForQualifiedUsage,
  shouldCountQualifiedProspectUsageInWindow,
  type QualifiedUsageEligibility,
  type QualifiedUsageWindow,
} from "./planQualifiedUsageCore";

export const MATCH_LIMIT_PER_CYCLE_MAX = 100_000;
// Summaries read at most when ordering same-millisecond matches by ID (a few
// MB at most; benchmark workspaces stay far smaller).
const TIE_SCAN_MAX_ROWS = 2_000;
// Recorded matches read at most per range: small rows, and a benchmark cycle
// decides a few hundred at most. Past it the count is a lower bound.
const DECIDED_SCAN_MAX_ROWS = 2_000;

export type ResolvedMatchLimit = Readonly<{
  limit: number | null;
  source: "default" | "benchmark";
  error: string | null;
}>;

function resolveMatchLimit(
  name: string,
  value: string | undefined
): ResolvedMatchLimit {
  const text = value?.trim();
  if (!text) return { limit: null, source: "default", error: null };
  const limit = /^\d+$/.test(text) ? Number(text) : Number.NaN;
  if (
    Number.isSafeInteger(limit) &&
    limit >= 1 &&
    limit <= MATCH_LIMIT_PER_CYCLE_MAX
  )
    return { limit, source: "benchmark", error: null };
  return {
    limit: null,
    source: "default",
    error: `${name} is not valid; no limit applies`,
  };
}

export const resolveMatchLimitPerCycle = (
  value: string | undefined = env.BENCHMARK_MATCH_LIMIT_PER_CYCLE
) => resolveMatchLimit("BENCHMARK_MATCH_LIMIT_PER_CYCLE", value);

export const resolveMatchLimitPerQuery = (
  value: string | undefined = env.BENCHMARK_MATCH_LIMIT_PER_QUERY
) => resolveMatchLimit("BENCHMARK_MATCH_LIMIT_PER_QUERY", value);

/**
 * Whether either match limit is in effect, read from the environment only.
 * The qualification step checks it before calling anything for the limits.
 */
export const isMatchLimitConfigured = () =>
  resolveMatchLimitPerCycle().limit !== null ||
  resolveMatchLimitPerQuery().limit !== null;

/** The cycle's limit N and its start. */
export type MatchLimitCycle = Readonly<{ limit: number; startedAt: number }>;
type Ctx = QueryCtx | MutationCtx;

const isBenchmarkWorkspace = (workspace: Pick<Doc<"workspaces">, "name">) =>
  workspace.name.startsWith(BENCHMARK_WORKSPACE_PREFIX);

const cycleWindow = (
  cycle: MatchLimitCycle,
  until = Number.MAX_SAFE_INTEGER
): QualifiedUsageWindow => ({
  cycleStart: cycle.startedAt,
  cycleEnd: until,
});

type Match = Pick<Doc<"prospects">, "_id"> & { qualifiedAt: number };

/** Match order: by qualifiedAt, then by ID within one millisecond. */
const byMatchOrder = (a: Match, b: Match) =>
  a.qualifiedAt - b.qualifiedAt || (a._id < b._id ? -1 : a._id > b._id ? 1 : 0);

/** How many of `sorted` (in match order) come before `match`. */
function countBefore(sorted: readonly Match[], match: Match) {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (byMatchOrder(sorted[middle], match) < 0) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** Matches qualified in the window (both ends inclusive), as the plan limit counts them. */
async function countMatches(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  window: QualifiedUsageWindow
) {
  if (window.cycleEnd < window.cycleStart) return 0;
  return await computeQualifiedProspectUsageForWorkspaceWindow(
    ctx,
    workspaceId,
    window
  );
}

/** Matches qualified from the cycle's start up to `until` (inclusive). */
const countCycleMatches = (
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  cycle: MatchLimitCycle,
  until?: number
) => countMatches(ctx, workspaceId, cycleWindow(cycle, until));

/** Matches the qualification step recorded from `from` to `until` (inclusive), in match order. */
async function readDecidedMatches(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  from: number,
  until = Number.MAX_SAFE_INTEGER
): Promise<Match[]> {
  if (until < from) return [];
  const rows = await ctx.db
    .query("benchmarkDecidedMatches")
    .withIndex("by_workspace_id_and_qualified_at", (q) =>
      q
        .eq("workspaceId", workspaceId)
        .gte("qualifiedAt", from)
        .lte("qualifiedAt", until)
    )
    .take(DECIDED_SCAN_MAX_ROWS);
  return rows
    .map((row) => ({ _id: row.prospectId, qualifiedAt: row.qualifiedAt }))
    .sort(byMatchOrder);
}

export type MatchLimitState = MatchLimitCycle &
  Readonly<{
    qualifiedThisCycle: number;
    reached: boolean;
    // The limit per query, the workspace's matches over all its cycles, and
    // whether they reached it; null and false when no limit per query applies.
    queryLimit: number | null;
    queryMatches: number | null;
    queryReached: boolean;
    // The cycle's recorded matches, in match order.
    decided: readonly Match[];
  }>;

/**
 * The workspace's matches this cycle against its limit N, or null when no
 * limit applies. Earlier cycles' matches are read only under a limit per
 * query.
 */
export async function benchmarkMatchLimitState(
  ctx: Ctx,
  workspace: Doc<"workspaces">
): Promise<MatchLimitState | null> {
  const perCycle = resolveMatchLimitPerCycle().limit;
  const perQuery = resolveMatchLimitPerQuery().limit;
  const startedAt = workspace.prospectingWorkflowStartedAt;
  if (
    (perCycle === null && perQuery === null) ||
    startedAt === undefined ||
    !isBenchmarkWorkspace(workspace)
  )
    return null;
  const earlier =
    perQuery === null
      ? 0
      : Math.max(
          await countMatches(ctx, workspace._id, {
            cycleStart: 0,
            cycleEnd: startedAt - 1,
          }),
          (await readDecidedMatches(ctx, workspace._id, 0, startedAt - 1))
            .length
        );
  const limit = Math.max(
    0,
    Math.min(
      perCycle ?? Number.POSITIVE_INFINITY,
      perQuery === null ? Number.POSITIVE_INFINITY : perQuery - earlier
    )
  );
  const decided = await readDecidedMatches(ctx, workspace._id, startedAt);
  const qualifiedThisCycle = Math.max(
    await countCycleMatches(ctx, workspace._id, { limit, startedAt }),
    decided.length
  );
  return {
    limit,
    startedAt,
    qualifiedThisCycle,
    reached: qualifiedThisCycle >= limit,
    queryLimit: perQuery,
    queryMatches: perQuery === null ? null : earlier + qualifiedThisCycle,
    queryReached: perQuery !== null && earlier + qualifiedThisCycle >= perQuery,
    decided,
  };
}

/**
 * For the cycle-start limit check: the workspace's matches over all its
 * cycles against the limit per query, or null when none applies (reading
 * nothing). Independent of the recorded cycle start, which a starting cycle
 * may not have set yet.
 */
export async function benchmarkQueryLimitState(
  ctx: Ctx,
  workspace: Doc<"workspaces">
) {
  const { limit } = resolveMatchLimitPerQuery();
  if (limit === null || !isBenchmarkWorkspace(workspace)) return null;
  const matches = Math.max(
    await countMatches(ctx, workspace._id, {
      cycleStart: 0,
      cycleEnd: Number.MAX_SAFE_INTEGER,
    }),
    (await readDecidedMatches(ctx, workspace._id, 0)).length
  );
  return { limit, matches, reached: matches >= limit };
}

/** Whether a prospect counts as one of the cycle's matches. */
export const isCycleMatch = <P extends QualifiedUsageEligibility>(
  cycle: MatchLimitCycle,
  prospect: P
): prospect is P & { qualifiedAt: number } =>
  shouldCountQualifiedProspectUsageInWindow(cycleWindow(cycle), prospect);

/** How many of the cycle's committed matches come before this one, in match order. */
async function committedMatchesBefore(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  cycle: MatchLimitCycle,
  match: Match
) {
  const before = await countCycleMatches(
    ctx,
    workspaceId,
    cycle,
    match.qualifiedAt - 1
  );
  if (before >= cycle.limit) return before;
  // Matches from the same millisecond only matter when they straddle the
  // limit; only then are they read to order them by ID.
  const through = await countCycleMatches(
    ctx,
    workspaceId,
    cycle,
    match.qualifiedAt
  );
  if (through <= cycle.limit) return before;
  // No index covers qualifiedAt, so the scan is bounded explicitly (the
  // filter runs here, so every row read is counted). It reads prospect
  // summaries, which carry the fields compared at a fraction of a full
  // prospect's size. Past the bound the work is treated as parked: the
  // cheaper side, and the gate never fails.
  let tiedBefore = 0;
  let scanned = 0;
  for await (const summary of ctx.db
    .query("prospectSummaries")
    .withIndex("by_workspace_qualification", (q) =>
      q.eq("workspaceId", workspaceId).eq("qualificationStatus", "qualified")
    )) {
    if (++scanned > TIE_SCAN_MAX_ROWS) return cycle.limit;
    const other = { ...summary, _id: summary.prospectId };
    if (
      other.qualifiedAt === match.qualifiedAt &&
      isCycleMatch(cycle, other) &&
      byMatchOrder(other, match) < 0
    )
      tiedBefore += 1;
  }
  return before + tiedBefore;
}

/** How many of the cycle's matches, committed or recorded, come before this one. */
async function matchesBefore(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  state: MatchLimitState,
  match: Match
) {
  const decidedBefore = countBefore(state.decided, match);
  if (decidedBefore >= state.limit) return decidedBefore;
  return Math.max(
    decidedBefore,
    await committedMatchesBefore(ctx, workspaceId, state, match)
  );
}

/**
 * Whether the match limit parks this work: the cycle has its N matches and
 * the work is not enrichment of one of the first N (in match order). Called
 * by the plan-limit gate with the prospect the work is for; reads nothing
 * unless a limit applies.
 */
export async function isParkedByBenchmarkMatchLimit(
  ctx: Ctx,
  workspace: Doc<"workspaces">,
  prospectId?: Id<"prospects">
): Promise<boolean> {
  const state = await benchmarkMatchLimitState(ctx, workspace);
  if (!state?.reached) return false;
  const prospect = prospectId
    ? await ctx.db.get("prospects", prospectId)
    : null;
  if (!prospect || !isCycleMatch(state, prospect)) return true;
  return (
    (await matchesBefore(ctx, workspace._id, state, prospect)) >= state.limit
  );
}

/**
 * The cycle's first N matches among `prospects`, in the order the gate uses:
 * the ones whose enrichment stays open once the limit is reached. With the
 * cycle's recorded matches (`decided`), a match also needs fewer than N of
 * them before it, as at the gate.
 */
export function firstMatchIds<
  P extends QualifiedUsageEligibility & Pick<Doc<"prospects">, "_id">,
>(
  cycle: MatchLimitCycle & { decided?: readonly Match[] },
  prospects: Iterable<P>
) {
  const matches: Match[] = [];
  for (const prospect of prospects)
    if (isCycleMatch(cycle, prospect)) matches.push(prospect);
  const decided = cycle.decided ?? [];
  return new Set(
    matches
      .sort(byMatchOrder)
      .slice(0, cycle.limit)
      .filter((match) => countBefore(decided, match) < cycle.limit)
      .map((match) => match._id)
  );
}

/**
 * For the qualification step itself (`runQualificationCore`), which can run
 * minutes after the workflow's gate let it through: whether the match limit
 * parks this prospect's qualification now. Called only while a limit is set.
 */
export const qualificationParkedInternal = internalQuery({
  args: { workspaceId: v.id("workspaces"), prospectId: v.id("prospects") },
  returns: v.boolean(),
  handler: async (ctx, { workspaceId, prospectId }) => {
    const workspace = await ctx.db.get("workspaces", workspaceId);
    return (
      workspace !== null &&
      (await isParkedByBenchmarkMatchLimit(ctx, workspace, prospectId))
    );
  },
});

/**
 * Records a match the qualification step just decided, so the limit counts
 * it before the workflow commits it. Keeps one row per prospect with its
 * latest verdict; does nothing unless a limit is set and the prospect would
 * count as a benchmark workspace's match.
 */
export const recordDecidedMatchInternal = internalMutation({
  args: { prospectId: v.id("prospects"), qualifiedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { prospectId, qualifiedAt }) => {
    if (!isMatchLimitConfigured()) return null;
    const prospect = await ctx.db.get("prospects", prospectId);
    if (!prospect || !isProspectEligibleForQualifiedUsage(prospect))
      return null;
    const workspace = await ctx.db.get("workspaces", prospect.workspaceId);
    if (!workspace || !isBenchmarkWorkspace(workspace)) return null;
    const existing = await ctx.db
      .query("benchmarkDecidedMatches")
      .withIndex("by_prospect_id", (q) => q.eq("prospectId", prospectId))
      .unique();
    if (existing)
      await ctx.db.patch("benchmarkDecidedMatches", existing._id, {
        qualifiedAt,
      });
    else
      await ctx.db.insert("benchmarkDecidedMatches", {
        workspaceId: prospect.workspaceId,
        prospectId,
        qualifiedAt,
      });
    return null;
  },
});
