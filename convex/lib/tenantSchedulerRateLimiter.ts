import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import { TENANT_EXECUTION_POOL_MAX_PARALLELISM } from "./tenantSchedulerCore";

/** Admission-rate protection is separate from concurrency slots. */
export const tenantSchedulerRateLimiter = new RateLimiter(
  components.rateLimiter,
  {
    globalTenantJobStarts: {
      kind: "token bucket",
      rate: 240,
      period: MINUTE,
      capacity: TENANT_EXECUTION_POOL_MAX_PARALLELISM,
      shards: 4,
    },
    tenantJobStarts: {
      kind: "token bucket",
      rate: 60,
      period: MINUTE,
      capacity: 30,
    },
  }
);
