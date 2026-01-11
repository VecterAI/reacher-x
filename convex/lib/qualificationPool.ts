// convex/lib/qualificationPool.ts
// Workpool for throttling prospect qualification workflows
// Prevents OCC errors by limiting concurrent qualifications

import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

/**
 * Qualification Workpool
 *
 * Limits concurrent qualification workflows to prevent:
 * 1. OCC errors from rate limit table contention
 * 2. External API rate limit exhaustion (Twitter: 120/min, LinkedIn: 30/min)
 *
 * Configuration:
 * - maxParallelism: 10 - Process up to 10 qualifications simultaneously
 * - retryActionsByDefault: true - Auto-retry failed qualifications
 */
export const qualificationPool = new Workpool(components.qualificationPool, {
  maxParallelism: 10,
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 3,
    initialBackoffMs: 1000,
    base: 2,
  },
});
