import type { Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { outreachProgressSummaryValidator } from "../validators";

export type OutreachProgressSummary = Infer<
  typeof outreachProgressSummaryValidator
>;

type OutreachProgressPlanSource = Pick<Doc<"outreachPlans">, "status">;

type OutreachProgressTaskSource = Pick<
  Doc<"outreachTasks">,
  | "order"
  | "type"
  | "description"
  | "status"
  | "approvalRequestedAt"
  | "approvedAt"
>;

const PROGRESS_FINISHED_TASK_STATUSES = new Set<
  OutreachProgressTaskSource["status"]
>(["completed", "skipped", "waiting_response"]);

const TERMINAL_TASK_STATUSES = new Set<OutreachProgressTaskSource["status"]>([
  "completed",
  "skipped",
]);

const ACTIVE_TASK_STATUS_PRIORITY: Record<
  OutreachProgressTaskSource["status"],
  number
> = {
  waiting_manual: 0,
  waiting_connection: 0,
  executing: 1,
  scheduled: 2,
  pending: 3,
  waiting_response: 4,
  failed: 5,
  completed: 6,
  skipped: 7,
};

/**
 * Builds the small outreach snapshot stored on a prospect summary row.
 * Abandoned plans are intentionally hidden because they are no longer active.
 */
export function buildOutreachProgressSummary(
  plan: OutreachProgressPlanSource,
  tasks: readonly OutreachProgressTaskSource[]
): OutreachProgressSummary | undefined {
  if (plan.status === "abandoned") {
    return undefined;
  }

  const orderedTasks = [...tasks].sort((left, right) => {
    const priorityDifference =
      ACTIVE_TASK_STATUS_PRIORITY[left.status] -
      ACTIVE_TASK_STATUS_PRIORITY[right.status];
    return priorityDifference !== 0
      ? priorityDifference
      : left.order - right.order;
  });
  const activeTask = orderedTasks.find(
    (task) => !TERMINAL_TASK_STATUSES.has(task.status)
  );

  return {
    planStatus: plan.status,
    finishedTaskCount: tasks.filter((task) =>
      PROGRESS_FINISHED_TASK_STATUSES.has(task.status)
    ).length,
    totalTaskCount: tasks.length,
    activeTask: activeTask
      ? {
          order: activeTask.order,
          type: activeTask.type,
          description: activeTask.description,
          status: activeTask.status,
          awaitingApproval:
            activeTask.approvalRequestedAt !== undefined &&
            activeTask.approvedAt === undefined,
        }
      : undefined,
  };
}
