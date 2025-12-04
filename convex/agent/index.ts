// convex/agent/index.ts
// Agent infrastructure setup for v4 agentic UX

import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "../_generated/api";

/**
 * Workflow Manager for durable agent workflows
 *
 * Used for:
 * - Onboarding workflow (URL analysis → ICP generation → workspace creation)
 * - Prospecting workflow (keyword expansion → social search → prospect storage)
 *
 * Note: components.workflow type is generated after running `npx convex dev`
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const workflowManager = new WorkflowManager((components as any).workflow, {
  // Workpool options for controlling parallelism
  workpoolOptions: {
    maxParallelism: 10,
  },
});

