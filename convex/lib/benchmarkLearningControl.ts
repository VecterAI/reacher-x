/**
 * Benchmark-only learning switch (issue #122, benchmarks/people-search).
 *
 * `BENCHMARK_LEARNING_OFF_WORKSPACE_IDS` names the control-group workspaces of
 * a development benchmark run, comma separated. In those workspaces only,
 * learned lessons, similar past cases and query ranking by past results are
 * withheld. Operator instructions, deduplication, newer-post fetching and
 * scheduled broadening are unaffected. Never set this in production; when it
 * is unset every workspace behaves normally.
 */
import { env } from "../_generated/server";

export function parseLearningOffWorkspaceIds(
  value: string | undefined
): ReadonlySet<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

export function isBenchmarkLearningOff(workspaceId: string): boolean {
  return parseLearningOffWorkspaceIds(
    env.BENCHMARK_LEARNING_OFF_WORKSPACE_IDS
  ).has(workspaceId);
}
