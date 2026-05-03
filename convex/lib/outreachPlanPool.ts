// convex/lib/outreachPlanPool.ts
// Workpool for throttling auto outreach plan generation
// Follows pattern from qualificationPool.ts and enrichmentPool.ts

import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

/**
 * Outreach Plan Generation Workpool
 *
 * Limits concurrent auto plan generations to prevent:
 * 1. LLM API rate limit exhaustion
 * 2. OCC errors from concurrent prospect mutations
 *
 * Configuration:
 * - maxParallelism: 5 - Lower than qualification/enrichment due to LLM cost
 * - retryActionsByDefault: true - Auto-retry failed generations
 */
export const outreachPlanPool = new Workpool(components.outreachPlanPool, {
  maxParallelism: 5,
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 3,
    initialBackoffMs: 2000,
    base: 2,
  },
});
