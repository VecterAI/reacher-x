"use client";

import * as React from "react";
import { Checkbox } from "@/shared/ui/components/Checkbox";
import { Badge } from "@/shared/ui/components/Badge";
import { Button } from "@/shared/ui/components/Button";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import { EditIcon } from "@/shared/ui/components/icons";
import { cn, parseText } from "@/shared/lib/utils";
import { useRouter } from "next/navigation";

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

export interface TaskItemProps {
  taskId: string;
  order: number;
  type: "comment" | "wait" | "ask_human";
  description: string;
  status: string;
  content?: string;
  prospectId: string;
  threadId?: string;
  targetTweetId?: string;
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
  onApproveTask,
  onClick,
  className,
}: TaskItemProps) {
  const router = useRouter();
  const [showFullContent, setShowFullContent] = React.useState(false);

  const isCompleted = status === "completed";
  const isSkipped = status === "skipped";
  const isFailed = status === "failed";
  const isActive = status === "executing" || status === "waiting_response";
  const isDimmed = isCompleted || isSkipped;
  const spinnerVariant = SPINNER_VARIANT[status];

  const showReplyContent = type === "comment" && content;
  const showEditButton = isActive && type === "comment";
  const showApproveButton = isActive;

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams();
    params.set("prospectId", prospectId);
    if (threadId) params.set("threadId", threadId);
    params.set("taskId", taskId);
    params.set("panel", "approval");
    if (targetTweetId) params.set("targetTweetId", targetTweetId);
    router.push(`/agent?${params.toString()}`);
  };

  const handleApprove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onApproveTask?.(taskId);
  };

  return (
    <div
      className={cn(
        "border-t px-4 py-3",
        onClick && "hover:bg-accent/50 cursor-pointer transition-colors",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {/* Row 1: Checkbox + Description */}
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isCompleted}
          disabled
          className="mt-0.5 shrink-0"
          aria-label={`Task ${order}: ${description}`}
        />
        <p
          className={cn(
            "min-w-0 flex-1 text-sm",
            isDimmed && "text-muted-foreground line-through",
            isFailed && "text-destructive"
          )}
        >
          {description}
        </p>
      </div>

      {/* Row 2: Reply content (comment tasks only) */}
      {showReplyContent && (
        <div className="mt-1.5 pl-7">
          <p
            className={cn(
              "text-muted-foreground text-sm whitespace-pre-line italic [&_a]:hover:underline",
              !showFullContent && "line-clamp-2"
            )}
          >
            &ldquo;{parseText(content)}&rdquo;
          </p>
          {content.length > 100 && (
            <Button
              variant="link"
              className="px-0"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                setShowFullContent((p) => !p);
              }}
            >
              {showFullContent ? "Show less" : "Show more"}
            </Button>
          )}
        </div>
      )}

      {/* Row 3: Status badge + action buttons */}
      <div className="mt-2 flex items-center justify-between pl-7">
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
            <span className="text-xs">{STATUS_LABELS[status] || status}</span>
          )}
        </Badge>

        {(showEditButton || showApproveButton) && (
          <div className="flex items-center gap-1">
            {showEditButton && (
              <>
                <Button
                  variant="ghost"
                  size="xsIcon"
                  className="sm:hidden"
                  onClick={handleEdit}
                  aria-label="Edit task"
                >
                  <EditIcon className="fill-current" />
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="hidden sm:inline-flex"
                  onClick={handleEdit}
                >
                  Edit
                </Button>
              </>
            )}
            {showApproveButton && (
              <Button size="xs" onClick={handleApprove}>
                Approve
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
