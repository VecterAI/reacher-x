import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

export type DemoPlanBatchRun = NonNullable<
  FunctionReturnType<typeof api.planBatches.getPlanBatchRun>
>;

/**
 * Runs shared between the batch scenario and the seeded history threads so a
 * PlanBatchProgressCard resolves in every demo, whatever registered last.
 */
export const historyPlanBatchRuns = new Map<string, DemoPlanBatchRun>();
