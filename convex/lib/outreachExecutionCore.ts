import type { Doc } from "../_generated/dataModel";

export function isOutreachExecutionLeaseCurrent(args: {
  plan: Pick<Doc<"outreachPlans">, "status" | "executionGeneration">;
  task: Pick<Doc<"outreachTasks">, "status" | "supersededAt">;
  expectedExecutionGeneration: number;
}): boolean {
  return (
    args.plan.status === "executing" &&
    (args.plan.executionGeneration ?? 0) === args.expectedExecutionGeneration &&
    args.task.status === "executing" &&
    args.task.supersededAt === undefined
  );
}
