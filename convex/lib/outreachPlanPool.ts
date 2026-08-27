// convex/lib/outreachPlanPool.ts
// Workpool for throttling auto outreach plan generation
// Follows pattern from qualificationPool.ts and enrichmentPool.ts

import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";
import { getSystemRuntimeConfig } from "./runtimeConfigHelpers";

/**
 * Outreach Plan Generation Workpool
 *
 * Limits concurrent auto plan generations to prevent:
 * 1. LLM API rate limit exhaustion
 * 2. OCC errors from concurrent prospect mutations
 *
 * Configuration:
 * - maxParallelism: runtime scheduler control (legacy/shadow 5, enforced 0)
 * - retryActionsByDefault: true - Auto-retry failed generations
 */
export function getOutreachPlanPool() {
  const config = getSystemRuntimeConfig().workpools.outreachPlan;
  return new Workpool(components.outreachPlanPool, {
    // Parallelism is controlled centrally by tenantScheduler.setControlInternal.
    retryActionsByDefault: true,
    defaultRetryBehavior: {
      maxAttempts: config.maxAttempts,
      initialBackoffMs: config.initialBackoffMs,
      base: config.base,
    },
  });
}
