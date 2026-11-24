/**
 * Benchmark-only concurrency limits (issue #122) for a development deployment
 * on the Starter plan, which runs at most 8 scheduled jobs at once.
 *
 * `BENCHMARK_POOL_LIMITS` holds JSON with every key of `DEFAULT_POOL_LIMITS`,
 * applied together to the workflow manager and the legacy worker pools so the
 * pools share the plan's capacity predictably. Unset means production
 * defaults. An invalid value never changes behaviour: defaults apply and
 * `resolvePoolLimits` reports the error so the benchmark refuses to run.
 * Enforced tenant scheduling ignores these limits. Never set in production.
 */
import { z } from "zod";
import { env } from "../_generated/server";

export const DEFAULT_POOL_LIMITS = {
  workflow: 64,
  qualification: 10,
  enrichment: 10,
  previewQualification: 4,
  previewEnrichment: 4,
  outreachPlan: 5,
  memoryEvaluation: 2,
} as const;

const limit = z.number().int().min(0).max(64);
const poolLimitsSchema = z.strictObject({
  workflow: limit.min(1),
  qualification: limit.min(1),
  enrichment: limit.min(1),
  previewQualification: limit,
  previewEnrichment: limit,
  outreachPlan: limit,
  memoryEvaluation: limit.min(1),
});
export type PoolLimits = z.infer<typeof poolLimitsSchema>;

export type ResolvedPoolLimits = Readonly<{
  limits: PoolLimits;
  source: "default" | "benchmark";
  error: string | null;
}>;

export function resolvePoolLimits(
  value: string | undefined = env.BENCHMARK_POOL_LIMITS
): ResolvedPoolLimits {
  if (!value?.trim())
    return { limits: DEFAULT_POOL_LIMITS, source: "default", error: null };
  try {
    return {
      limits: poolLimitsSchema.parse(JSON.parse(value)),
      source: "benchmark",
      error: null,
    };
  } catch {
    return {
      limits: DEFAULT_POOL_LIMITS,
      source: "default",
      error: "BENCHMARK_POOL_LIMITS is not valid; production defaults apply",
    };
  }
}
