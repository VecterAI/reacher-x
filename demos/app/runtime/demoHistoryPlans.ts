import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

export type DemoHistoryPlan = NonNullable<
  FunctionReturnType<typeof api.outreach.getProspectPlan>
>;

/**
 * Outreach plans that exist only inside seeded history threads. Plan services
 * consult these so inline plan cards and their panels show the same plan; live
 * fixture plans always win when both exist for a person.
 */
export const historyPlans = new Map<string, DemoHistoryPlan>();

export function findHistoryPlanByProspect(
  prospectId: string
): DemoHistoryPlan | undefined {
  return [...historyPlans.values()].find(
    (data) => data.plan.prospectId === prospectId
  );
}
