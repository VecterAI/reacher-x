import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

export const previewQualificationPool = new Workpool(
  components.previewQualificationPool,
  {
    maxParallelism: 15,
    retryActionsByDefault: true,
    defaultRetryBehavior: {
      maxAttempts: 3,
      initialBackoffMs: 1000,
      base: 2,
    },
  }
);
