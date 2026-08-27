import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

/**
 * The only regular-user execution pool used after tenant scheduling is
 * enforced. Together with the shared Workflow pool (64), this stays at the
 * official Pro recommendation of 100 combined slots.
 */
export const tenantExecutionPool = new Workpool(
  components.tenantExecutionPool,
  {
    // Runtime control owns the 0/36 split so cancel calls cannot overwrite it.
    retryActionsByDefault: true,
    defaultRetryBehavior: {
      maxAttempts: 3,
      initialBackoffMs: 1000,
      base: 2,
    },
  }
);
