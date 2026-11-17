/**
 * Benchmark-only match limit per cycle (issue #122) for a development
 * deployment, applied through the plan-limit gate.
 *
 * `BENCHMARK_MATCH_LIMIT_PER_CYCLE` holds a positive whole number N. For a
 * benchmark workspace (named `Benchmark ...`), its matches are the prospects
 * qualified in its current cycle (qualifiedAt at or after
 * prospectingWorkflowStartedAt), counted the way the plan limit counts them.
 * Once the cycle has N, the execution-time gate (`backgroundWorkGuards.ts`)
 * and the qualification recovery claim park further qualification exactly as
 * they do at a plan limit; work already past the gate finishes, so a few
 * matches over N are expected. From then on enrichment stays open only for
 * the cycle's first N matches by qualifiedAt; every other prospect's
 * enrichment (the overshoot, earlier cycles' matches, and the eager
 * enrichment of undecided LinkedIn people) is parked the same way.
 *
 * Only that gate reads it. The cycle-start limit check, the capacity
 * reconcile, the "limit_reached" status and the plan-limit notification
 * never do, so every cycle starts and is rescheduled as usual and its count
 * starts at zero when `prospectingWorkflowStartedAt` moves to the new cycle.
 *
 * Unset means no limit, as in production, and reads nothing. An invalid
 * value never changes behaviour: no limit applies and
 * `resolveMatchLimitPerCycle` reports the error so the benchmark refuses to
 * run. Workspaces not named by the benchmark are never limited. Never set in
 * production.
 */
import { env } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { BENCHMARK_WORKSPACE_PREFIX } from "./benchmarkLinkdApiCap";
import {
  computeQualifiedProspectUsageForWorkspaceWindow,
  shouldCountQualifiedProspectUsageInWindow,
  type QualifiedUsageEligibility,
} from "./planQualifiedUsageCore";

export const MATCH_LIMIT_PER_CYCLE_MAX = 100_000;
// Rows read at most when ordering same-millisecond matches by ID (well under
// Convex's per-function scan limit; benchmark workspaces stay far smaller).
const TIE_SCAN_MAX_ROWS = 5_000;

export type ResolvedMatchLimitPerCycle = Readonly<{
  limit: number | null;
  source: "default" | "benchmark";
  error: string | null;
}>;

export function resolveMatchLimitPerCycle(
  value: string | undefined = env.BENCHMARK_MATCH_LIMIT_PER_CYCLE
): ResolvedMatchLimitPerCycle {
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
    error: "BENCHMARK_MATCH_LIMIT_PER_CYCLE is not valid; no limit applies",
  };
}

export type MatchLimitCycle = Readonly<{ limit: number; startedAt: number }>;
type Ctx = QueryCtx | MutationCtx;

/** The limit and current cycle start that apply to a workspace, or null when none does. */
export function benchmarkMatchLimitCycle(
  workspace: Pick<Doc<"workspaces">, "name" | "prospectingWorkflowStartedAt">
): MatchLimitCycle | null {
  const { limit } = resolveMatchLimitPerCycle();
  const startedAt = workspace.prospectingWorkflowStartedAt;
  if (
    limit === null ||
    startedAt === undefined ||
    !workspace.name.startsWith(BENCHMARK_WORKSPACE_PREFIX)
  )
    return null;
  return { limit, startedAt };
}

const cycleWindow = (
  cycle: MatchLimitCycle,
  until = Number.MAX_SAFE_INTEGER
) => ({
  cycleStart: cycle.startedAt,
  cycleEnd: until,
});

/** Matches qualified from the cycle's start up to `until` (inclusive), as the plan limit counts them. */
async function countCycleMatches(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  cycle: MatchLimitCycle,
  until?: number
) {
  const window = cycleWindow(cycle, until);
  if (window.cycleEnd < window.cycleStart) return 0;
  return await computeQualifiedProspectUsageForWorkspaceWindow(
    ctx,
    workspaceId,
    window
  );
}

export type MatchLimitState = MatchLimitCycle &
  Readonly<{ qualifiedThisCycle: number; reached: boolean }>;

/** The workspace's matches this cycle against the limit, or null when no limit applies. */
export async function benchmarkMatchLimitState(
  ctx: Ctx,
  workspace: Doc<"workspaces">
): Promise<MatchLimitState | null> {
  const cycle = benchmarkMatchLimitCycle(workspace);
  if (!cycle) return null;
  const qualifiedThisCycle = await countCycleMatches(ctx, workspace._id, cycle);
  return {
    ...cycle,
    qualifiedThisCycle,
    reached: qualifiedThisCycle >= cycle.limit,
  };
}

/** Whether a prospect counts as one of the cycle's matches. */
export const isCycleMatch = <P extends QualifiedUsageEligibility>(
  cycle: MatchLimitCycle,
  prospect: P
): prospect is P & { qualifiedAt: number } =>
  shouldCountQualifiedProspectUsageInWindow(cycleWindow(cycle), prospect);

type Match = Pick<Doc<"prospects">, "_id"> & { qualifiedAt: number };

/** The cycle's matches in order: by qualifiedAt, then by ID within one millisecond. */
const byMatchOrder = (a: Match, b: Match) =>
  a.qualifiedAt - b.qualifiedAt || (a._id < b._id ? -1 : a._id > b._id ? 1 : 0);

/** How many of the cycle's matches come before this one, in match order. */
async function matchesBefore(
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
  // filter runs here, so every row read is counted). Past the bound the work
  // is treated as parked: the cheaper side, and the gate never fails.
  let tiedBefore = 0;
  let scanned = 0;
  for await (const other of ctx.db
    .query("prospects")
    .withIndex("by_workspace_qualification", (q) =>
      q.eq("workspaceId", workspaceId).eq("qualificationStatus", "qualified")
    )) {
    if (++scanned > TIE_SCAN_MAX_ROWS) return cycle.limit;
    if (
      other.qualifiedAt === match.qualifiedAt &&
      isCycleMatch(cycle, other) &&
      byMatchOrder(other, match) < 0
    )
      tiedBefore += 1;
  }
  return before + tiedBefore;
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
 * the ones whose enrichment stays open once the limit is reached.
 */
export function firstMatchIds<
  P extends QualifiedUsageEligibility & Pick<Doc<"prospects">, "_id">,
>(cycle: MatchLimitCycle, prospects: Iterable<P>) {
  const matches: Match[] = [];
  for (const prospect of prospects)
    if (isCycleMatch(cycle, prospect)) matches.push(prospect);
  return new Set(
    matches
      .sort(byMatchOrder)
      .slice(0, cycle.limit)
      .map((match) => match._id)
  );
}
