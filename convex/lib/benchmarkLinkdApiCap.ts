/**
 * Benchmark-only cap on enrichment's keyword post search (issue #122) for a
 * development deployment.
 *
 * Enrichment searches each qualified LinkedIn prospect's own posts for the
 * finance keywords (up to two LinkdAPI calls per keyword), which made most of
 * the smoke test's LinkedIn calls. `BENCHMARK_KEYWORD_POST_SEARCH_LIMIT` holds
 * a positive whole number: the most LinkdAPI calls that search may make for
 * one benchmark workspace in one prospecting cycle. Only calls carrying
 * `KEYWORD_POST_SEARCH_PURPOSE` are counted or refused; discovery, profile and
 * company reads, and every search qualification makes, never carry it.
 *
 * Calls carry no workspace, so they count against the cycle of the benchmark
 * workspace that started most recently; the benchmark runs one at a time.
 * Counting happens at the reservation every LinkdAPI call takes
 * (`convex/linkdapiBudget.ts`), and a call past the cap is refused the way an
 * open provider circuit refuses it; the search stops there and enrichment
 * carries on with the posts it already has.
 *
 * Unset means no cap, as in production. An invalid value never changes
 * behaviour: no cap applies and `resolveKeywordPostSearchLimit` reports the
 * error so the benchmark refuses to run. Workspaces not named by the benchmark
 * are never counted or refused. Never set in production.
 */
import { v } from "convex/values";
import { env } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export const BENCHMARK_WORKSPACE_PREFIX = "Benchmark ";
export const KEYWORD_POST_SEARCH_LIMIT_MAX = 100_000;
// Workspaces read per status when finding the current benchmark cycle.
const MAX_CYCLE_CANDIDATES = 50;

/** Marks the LinkdAPI calls of enrichment's keyword post search. */
export const KEYWORD_POST_SEARCH_PURPOSE = "enrichment.keywordPostSearch";
export const linkdApiPurposeValidator = v.literal(KEYWORD_POST_SEARCH_PURPOSE);
export type LinkdApiPurpose = typeof KEYWORD_POST_SEARCH_PURPOSE;

export type ResolvedKeywordPostSearchLimit = Readonly<{
  limit: number | null;
  source: "default" | "benchmark";
  error: string | null;
}>;

export function resolveKeywordPostSearchLimit(
  value: string | undefined = env.BENCHMARK_KEYWORD_POST_SEARCH_LIMIT
): ResolvedKeywordPostSearchLimit {
  const text = value?.trim();
  if (!text) return { limit: null, source: "default", error: null };
  const limit = /^\d+$/.test(text) ? Number(text) : Number.NaN;
  if (
    Number.isSafeInteger(limit) &&
    limit >= 1 &&
    limit <= KEYWORD_POST_SEARCH_LIMIT_MAX
  )
    return { limit, source: "benchmark", error: null };
  return {
    limit: null,
    source: "default",
    error: "BENCHMARK_KEYWORD_POST_SEARCH_LIMIT is not valid; no cap applies",
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
 * running ones and ones stopped by a failed cycle (whose enrichment can still
 * call LinkedIn). A cycle is one prospecting workflow.
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

// Starts every refusal message, so a refusal the cap caused can be recognized
// after it crosses an action boundary.
export const KEYWORD_POST_SEARCH_CAP_REFUSAL =
  "Benchmark keyword post search cap reached";

/** The refusal message; callers see a provider-circuit refusal with it. */
export const keywordPostSearchCapMessage = (limit: number) =>
  `${KEYWORD_POST_SEARCH_CAP_REFUSAL}: at most ${limit} LinkdAPI keyword post-search calls per workspace cycle (BENCHMARK_KEYWORD_POST_SEARCH_LIMIT, development only)`;

/** Whether an error, possibly rethrown across an action boundary, is a cap refusal. */
export const isKeywordPostSearchCapRefusal = (error: unknown) =>
  error instanceof Error &&
  error.message.includes(KEYWORD_POST_SEARCH_CAP_REFUSAL);
