"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/shared/ui/components/Badge";
import { Button } from "@/shared/ui/components/Button";
import { Checkbox } from "@/shared/ui/components/Checkbox";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import { cn, parseText } from "@/shared/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  scheduled: "Scheduled",
  executing: "Executing",
  waiting_response: "Waiting",
  completed: "Completed",
  skipped: "Skipped",
  failed: "Failed",
};

const SPINNER_VARIANT: Record<string, "spinner" | "pulse" | "clock"> = {
  executing: "spinner",
  waiting_response: "pulse",
  scheduled: "clock",
};

export type TaskItemMode = "interactive" | "readonly";

export interface TaskItemProps {
  taskId: string;
  order: number;
  type: "comment" | "wait" | "ask_human";
  description: string;
  status: string;
  content?: string;
  prospectId?: string;
  threadId?: string;
  targetTweetId?: string;
  mode?: TaskItemMode;
  onApproveTask?: (taskId: string) => void;
  onClick?: () => void;
  className?: string;
}

export function TaskItem({
  taskId,
  order,
  type,
  description,
  status,
  content,
  prospectId,
  threadId,
  targetTweetId,
  mode = "interactive",
  onApproveTask,
  onClick,
  className,
}: TaskItemProps) {
  const router = useRouter();
  const [showFullContent, setShowFullContent] = React.useState(false);

  const isInteractive = mode === "interactive";
  const isCompleted = status === "completed";
  const isSkipped = status === "skipped";
  const isFailed = status === "failed";
  const isAwaitingApproval = status === "pending" || status === "executing";
  const isDimmed = isCompleted || isSkipped;
  const spinnerVariant = SPINNER_VARIANT[status];

  const showReplyContent = type === "comment" && !!content?.trim();
  const replyContent = content ?? "";
  const showEditButton =
    isInteractive && isAwaitingApproval && type === "comment" && !!prospectId;
  const showApproveButton =
    isInteractive && isAwaitingApproval && !!onApproveTask;
  const rowIsClickable = isInteractive && !!onClick;

  const handleEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!prospectId) return;

    const params = new URLSearchParams();
    params.set("prospectId", prospectId);
    if (threadId) params.set("threadId", threadId);
    params.set("taskId", taskId);
    params.set("panel", "approval");
    if (targetTweetId) params.set("targetTweetId", targetTweetId);
    router.push(`/agent?${params.toString()}`);
  };

  const handleApprove = (event: React.MouseEvent) => {
    event.stopPropagation();
    onApproveTask?.(taskId);
  };

  return (
    <li
      className={cn(
        "border-t px-4 py-3",
        rowIsClickable && "hover:bg-accent/50 cursor-pointer transition-colors",
        className
      )}
      onClick={rowIsClickable ? onClick : undefined}
      role={rowIsClickable ? "button" : undefined}
      tabIndex={rowIsClickable ? 0 : undefined}
      onKeyDown={
        rowIsClickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isCompleted}
          disabled
          className="mt-0.5 shrink-0"
          aria-label={`Task ${order}: ${description}`}
        />

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm",
              isDimmed && "text-muted-foreground line-through",
              isFailed && "text-destructive"
            )}
          >
            <span className="mr-1 font-medium">{order}.</span>
            {description}
          </p>

          {showReplyContent && (
            <div className="mt-1.5">
              <p
                className={cn(
                  "text-muted-foreground text-sm whitespace-pre-line italic [&_a]:hover:underline",
                  !showFullContent && "line-clamp-2"
                )}
              >
                &ldquo;{parseText(replyContent)}&rdquo;
              </p>
              {replyContent.length > 100 && (
                <Button
                  variant="link"
                  className="px-0 text-xs"
                  size="xs"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowFullContent((current) => !current);
                  }}
                >
                  {showFullContent ? "Show less" : "Show more"}
                </Button>
              )}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between gap-2">
            <Badge
              variant="outline"
              className={cn(
                "gap-1 rounded-md font-normal",
                isFailed && "border-destructive/50 text-destructive"
              )}
            >
              {spinnerVariant ? (
                <AsciiSpinnerText
                  text={STATUS_LABELS[status] || status}
                  variant={spinnerVariant}
                  className="text-xs"
                />
              ) : (
                <span className="text-xs">
                  {STATUS_LABELS[status] || status}
                </span>
              )}
            </Badge>

            {(showEditButton || showApproveButton) && (
              <div className="flex items-center gap-1">
                {showEditButton && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="shrink-0 whitespace-nowrap"
                    onClick={handleEdit}
                  >
                    Edit
                  </Button>
                )}
                {showApproveButton && (
                  <Button size="xs" variant="outline" onClick={handleApprove}>
                    Approve
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
