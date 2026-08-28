import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import {
  TENANT_EXECUTION_POOL_MAX_PARALLELISM,
  TENANT_JOB_START_RATE_PER_MINUTE,
} from "./tenantSchedulerCore";

/** Admission-rate protection is separate from concurrency slots. */
export const tenantSchedulerRateLimiter = new RateLimiter(
  components.rateLimiter,
  {
    globalTenantJobStarts: {
      kind: "token bucket",
      rate: TENANT_JOB_START_RATE_PER_MINUTE,
      period: MINUTE,
      capacity: TENANT_EXECUTION_POOL_MAX_PARALLELISM,
      shards: 4,
    },
    tenantJobStarts: {
      kind: "token bucket",
      // A single active workspace may borrow the global start budget. Slot
      // caps still preserve newcomer headroom and rebalance across active
      // lanes, while this no longer forces a healthy one-tenant queue to
      // drain at only one job per second.
      rate: TENANT_JOB_START_RATE_PER_MINUTE,
      period: MINUTE,
      capacity: TENANT_EXECUTION_POOL_MAX_PARALLELISM,
    },
  }
);
