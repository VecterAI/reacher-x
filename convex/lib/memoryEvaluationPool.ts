import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

/**
 * Memory evaluator workpool.
 *
 * Keeps LLM-backed memory distillation bounded so bursts of memory events do
 * not exhaust the workflow/worker capacity of the deployment.
 */
export const memoryEvaluationPool = new Workpool(
  components.memoryEvaluationPool,
  {
    maxParallelism: 4,
    retryActionsByDefault: true,
    defaultRetryBehavior: {
      maxAttempts: 3,
      initialBackoffMs: 1000,
      base: 2,
    },
  }
);
