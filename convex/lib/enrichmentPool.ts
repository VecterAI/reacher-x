// convex/lib/enrichmentPool.ts
// Workpool for throttling prospect enrichment workflows
// Prevents OCC errors by limiting concurrent enrichments

import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

/**
 * Enrichment Workpool
 *
 * Limits concurrent enrichment workflows to prevent:
 * 1. OCC errors from rate limit table contention
 * 2. External API rate limit exhaustion (Twitter: 120/min, LinkedIn: 30/min)
 *
 * Configuration:
 * - maxParallelism: 10 - Process up to 10 enrichments simultaneously
 * - retryActionsByDefault: true - Auto-retry failed enrichments
 */
export const enrichmentPool = new Workpool(components.enrichmentPool, {
  maxParallelism: 10,
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 3,
    initialBackoffMs: 1000,
    base: 2,
  },
});
