// convex/lib/qualificationPool.ts
// Workpool for throttling prospect qualification workflows
// Prevents OCC errors by limiting concurrent qualifications

import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";
import { getSystemRuntimeConfig } from "./runtimeConfigHelpers";

/**
 * Qualification Workpool
 *
 * Limits concurrent qualification workflows to prevent:
 * 1. OCC errors from rate limit table contention
 * 2. Downstream API spikes while the shared SocialAPI budget gate smooths egress
 *
 * Configuration:
 * - maxParallelism: runtime scheduler control (legacy/shadow 10, enforced 0)
 * - retryActionsByDefault: true - Auto-retry failed qualifications
 */
export function getQualificationPool() {
  const config = getSystemRuntimeConfig().workpools.qualification;
  return new Workpool(components.qualificationPool, {
    // Parallelism is controlled centrally by tenantScheduler.setControlInternal.
    retryActionsByDefault: true,
    defaultRetryBehavior: {
      maxAttempts: config.maxAttempts,
      initialBackoffMs: config.initialBackoffMs,
      base: config.base,
    },
  });
}
