/**
 * Benchmark-only LinkedIn call cap (issue #122) for a development deployment.
 *
 * `BENCHMARK_LINKDAPI_CYCLE_LIMIT` holds a positive whole number: the most
 * LinkdAPI calls one benchmark workspace may make in one prospecting cycle.
 * Calls carry no workspace, so they count against the cycle of the benchmark
 * workspace that started most recently; the benchmark runs one at a time.
 * Counting happens at the reservation every LinkdAPI call takes
 * (`convex/linkdapiBudget.ts`), and a call past the cap is refused the way an
 * open provider circuit refuses it, so callers degrade as they already do.
 *
 * Unset means no cap, as in production. An invalid value never changes
 * behaviour: no cap applies and `resolveLinkdApiCycleLimit` reports the error
 * so the benchmark refuses to run. Workspaces not named by the benchmark are
 * never counted or refused. Never set in production.
 */
import { env } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export const BENCHMARK_WORKSPACE_PREFIX = "Benchmark ";
export const LINKDAPI_CYCLE_LIMIT_MAX = 100_000;
// Workspaces read per status when finding the current benchmark cycle.
const MAX_CYCLE_CANDIDATES = 50;

export type ResolvedLinkdApiCycleLimit = Readonly<{
  limit: number | null;
  source: "default" | "benchmark";
  error: string | null;
}>;

export function resolveLinkdApiCycleLimit(
  value: string | undefined = env.BENCHMARK_LINKDAPI_CYCLE_LIMIT
): ResolvedLinkdApiCycleLimit {
  const text = value?.trim();
  if (!text) return { limit: null, source: "default", error: null };
  const limit = /^\d+$/.test(text) ? Number(text) : Number.NaN;
  if (
    Number.isSafeInteger(limit) &&
    limit >= 1 &&
    limit <= LINKDAPI_CYCLE_LIMIT_MAX
  )
    return { limit, source: "benchmark", error: null };
  return {
    limit: null,
    source: "default",
    error: "BENCHMARK_LINKDAPI_CYCLE_LIMIT is not valid; no cap applies",
  };
}

export type BenchmarkCycle = Readonly<{
  workspaceId: Id<"workspaces">;
  workflowId: string;
  key: string;
}>;

const isBenchmarkCycle = (workspace: Doc<"workspaces">) =>
  workspace.name.startsWith(BENCHMARK_WORKSPACE_PREFIX) &&
  Boolean(workspace.prospectingWorkflowId) &&
  !workspace.deletionWorkflowId;

/**
 * The cycle of the benchmark workspace that started most recently, among
 * running ones and ones stopped by a failed cycle (whose qualification can
 * still call LinkedIn). A cycle is one prospecting workflow.
 */
export async function currentBenchmarkCycle(
  ctx: Pick<QueryCtx, "db">
): Promise<BenchmarkCycle | null> {
  const candidates = (
    await Promise.all(
      (["running", "stopped"] as const).map((status) =>
        ctx.db
          .query("workspaces")
          .withIndex("by_prospecting_status_last_activity", (q) =>
            q.eq("prospectingWorkflowStatus", status)
          )
          .take(MAX_CYCLE_CANDIDATES)
      )
    )
  )
    .flat()
    .filter(isBenchmarkCycle);
  const latest = candidates.reduce<Doc<"workspaces"> | null>(
    (best, workspace) =>
      !best ||
      (workspace.prospectingWorkflowStartedAt ?? 0) >
        (best.prospectingWorkflowStartedAt ?? 0)
        ? workspace
        : best,
    null
  );
  if (!latest?.prospectingWorkflowId) return null;
  return {
    workspaceId: latest._id,
    workflowId: latest.prospectingWorkflowId,
    key: `${latest._id}:${latest.prospectingWorkflowId}`,
  };
}

// Starts every refusal message, so a failure the cap caused can be recognized.
export const LINKDAPI_CYCLE_CAP_REFUSAL = "Benchmark LinkedIn cap reached";

/** The refusal message; callers see a provider-circuit refusal with it. */
export const linkdApiCycleCapMessage = (limit: number) =>
  `${LINKDAPI_CYCLE_CAP_REFUSAL}: at most ${limit} LinkdAPI calls per workspace cycle (BENCHMARK_LINKDAPI_CYCLE_LIMIT, development only)`;
