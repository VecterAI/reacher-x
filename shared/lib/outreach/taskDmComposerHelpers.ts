export type TaskDmComposerBehavior = "task-approval" | "fresh-send";

export interface ResolveTaskDmComposerStateArgs<TDraft> {
  taskId?: string | null;
  taskMode?: "approval" | "posted" | null;
  taskStatus?: string;
  taskDraft?: TDraft;
}

export interface TaskDmComposerState<TDraft> {
  behavior: TaskDmComposerBehavior;
  draft?: TDraft;
  resetKey: string;
}

const SENT_TASK_STATUSES = new Set(["waiting_response", "completed"]);

/**
 * Keeps an outreach task's persisted payload isolated to its approval composer.
 * Once the task is posted or has a sent status, the conversation panel becomes
 * a fresh send surface and must not inherit any part of the sent payload.
 */
export function resolveTaskDmComposerState<TDraft>(
  args: ResolveTaskDmComposerStateArgs<TDraft>
): TaskDmComposerState<TDraft> {
  const behavior: TaskDmComposerBehavior =
    args.taskId &&
    args.taskMode === "approval" &&
    !SENT_TASK_STATUSES.has(args.taskStatus ?? "")
      ? "task-approval"
      : "fresh-send";

  return {
    behavior,
    draft: behavior === "task-approval" ? args.taskDraft : undefined,
    resetKey: `${args.taskId ?? "live"}:${behavior}`,
  };
}
