import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

export const previewQualificationPool = new Workpool(
  components.previewQualificationPool,
  {
    // Parallelism is controlled centrally by tenantScheduler.setControlInternal.
    retryActionsByDefault: true,
    defaultRetryBehavior: {
      maxAttempts: 3,
      initialBackoffMs: 1000,
      base: 2,
    },
  }
);
