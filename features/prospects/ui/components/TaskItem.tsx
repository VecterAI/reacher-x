"use client";

/**
 * TaskItem
 * Displays a single task in an outreach plan.
 * Uses shadcn/ui Checkbox for completion state.
 */

import { Checkbox } from "@/shared/ui/components/Checkbox";
import { cn } from "@/shared/lib/utils";

const STATUS_ICONS: Record<string, string> = {
  pending: "○",
  scheduled: "⏳",
  executing: "⚡",
  waiting_response: "↻",
  completed: "✓",
  skipped: "—",
  failed: "✗",
};

const TASK_TYPE_LABELS: Record<string, string> = {
  comment: "Comment",
  wait: "Wait",
  ask_human: "Ask Human",
};

export interface TaskItemProps {
  order: number;
  type: "comment" | "wait" | "ask_human";
  description: string;
  status: string;
  content?: string;
  className?: string;
}

export function TaskItem({
  order,
  type,
  description,
  status,
  content,
  className,
}: TaskItemProps) {
  const isCompleted = status === "completed";
  const isFailed = status === "failed";
  const isActive = status === "executing" || status === "waiting_response";

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3",
        isActive && "border-primary/50 bg-primary/5",
        isFailed && "border-destructive/50 bg-destructive/5",
        className
      )}
    >
      <Checkbox
        checked={isCompleted}
        disabled
        className="mt-0.5"
        aria-label={`Task ${order}: ${description}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium">
            {TASK_TYPE_LABELS[type] || type}
          </span>
          <span className="text-muted-foreground text-xs">
            {STATUS_ICONS[status] || status}
          </span>
        </div>
        <p
          className={cn(
            "text-sm",
            isCompleted && "text-muted-foreground line-through"
          )}
        >
          {description}
        </p>
        {content && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs italic">
            &ldquo;{content}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}
