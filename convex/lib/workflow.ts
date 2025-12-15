// convex/lib/workflow.ts
// WorkflowManager instance for durable, long-running background workflows

import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "../_generated/api";

/**
 * Shared WorkflowManager instance for all workflows.
 *
 * Workflows are durable and:
 * - Survive server restarts
 * - Retry failed steps with exponential backoff
 * - Never skip steps - block until success
 * - Support complex multi-step processes
 *
 * Usage:
 * ```typescript
 * import { workflow } from "./lib/workflow";
 *
 * export const myWorkflow = workflow.define({
 *   args: { ... },
 *   handler: async (step, args) => {
 *     await step.runAction(...);
 *   },
 * });
 * ```
 */
export const workflow = new WorkflowManager(components.workflow);
