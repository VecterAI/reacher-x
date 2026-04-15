"use client";

import * as React from "react";
import { Badge } from "@/shared/ui/components/Badge";
import { Button } from "@/shared/ui/components/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import { MoreHorizIcon, EditIcon } from "@/shared/ui/components/icons";
import { cn } from "@/shared/lib/utils";
import {
  PlanStrategyContent,
  shouldEnableStrategyExpansion,
} from "./PlanStrategyContent";
import { TaskItem, type TaskItemMode } from "./TaskItem";

const PLAN_STATUS_LABELS: Record<string, string> = {
  draft: "Waiting approval",
  approved: "Ready",
  executing: "Executing",
  paused: "Paused",
  blocked_auth: "Reconnect required",
  completed: "Completed",
  abandoned: "Abandoned",
};

export type OutreachPlanCardVariant =
  | "current"
  | "history"
  | "preview"
  | "panel";

export interface OutreachPlanCardTask {
  _id: string;
  order: number;
  type: string;
  description: string;
  status: string;
  content?: string;
  targetTweetId?: string;
}

export interface OutreachPlanCardFooterAction {
  label: string;
  onClick: () => void;
}

export interface OutreachPlanCardProps {
  status: string;
  rationale?: string;
  tasks: OutreachPlanCardTask[];
  variant?: OutreachPlanCardVariant;
  title?: string;
  showHeader?: boolean;
  strategyLabel?: string;
  tasksLabel?: string;
  prospectId?: string;
  threadId?: string;
  strategyClamp?: number | null;
  defaultStrategyExpanded?: boolean;
  showStrategyToggle?: boolean;
  showTasks?: boolean;
  defaultTasksExpanded?: boolean;
  showTasksToggle?: boolean;
  showTaskActions?: boolean;
  taskMode?: TaskItemMode;
  footerAction?: OutreachPlanCardFooterAction;
  onEdit?: () => void;
  onApprove?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onApproveTask?: (taskId: string) => void;
  onViewTask?: (payload: {
    taskId: string;
    targetTweetId?: string;
    panelMode: "approval" | "posted";
  }) => void;
  onTaskClick?: () => void;
  /** Disables plan actions (edit, approve, pause, resume, task actions). */
  actionsDisabled?: boolean;
  className?: string;
}

type ResolvedVariantDefaults = {
  strategyClamp: number | null;
  defaultStrategyExpanded: boolean;
  showStrategyToggle: boolean;
  showTasks: boolean;
  defaultTasksExpanded: boolean;
  showTasksToggle: boolean;
  showTaskActions: boolean;
  taskMode: TaskItemMode;
};

function getVariantDefaults(
  variant: OutreachPlanCardVariant
): ResolvedVariantDefaults {
  switch (variant) {
    case "preview":
      return {
        strategyClamp: 2,
        defaultStrategyExpanded: false,
        showStrategyToggle: false,
        showTasks: false,
        defaultTasksExpanded: false,
        showTasksToggle: false,
        showTaskActions: false,
        taskMode: "readonly",
      };
    case "history":
      return {
        strategyClamp: 3,
        defaultStrategyExpanded: false,
        showStrategyToggle: true,
        showTasks: true,
        defaultTasksExpanded: true,
        showTasksToggle: false,
        showTaskActions: false,
        taskMode: "readonly",
      };
    case "panel":
      return {
        strategyClamp: 4,
        defaultStrategyExpanded: false,
        showStrategyToggle: true,
        showTasks: true,
        defaultTasksExpanded: true,
        showTasksToggle: false,
        showTaskActions: true,
        taskMode: "interactive",
      };
    case "current":
    default:
      return {
        strategyClamp: 3,
        defaultStrategyExpanded: false,
        showStrategyToggle: true,
        showTasks: true,
        defaultTasksExpanded: true,
        showTasksToggle: true,
        showTaskActions: true,
        taskMode: "interactive",
      };
  }
}

export function getOutreachPlanStatusLabel(status: string): string {
  return PLAN_STATUS_LABELS[status] || status;
}

export function OutreachPlanCard({
  status,
  rationale,
  tasks,
  variant = "current",
  title = "Outreach plan",
  showHeader = true,
  strategyLabel,
  tasksLabel,
  prospectId,
  threadId,
  strategyClamp,
  defaultStrategyExpanded,
  showStrategyToggle,
  showTasks,
  defaultTasksExpanded,
  showTasksToggle,
  showTaskActions,
  taskMode,
  footerAction,
  onEdit,
  onApprove,
  onPause,
  onResume,
  onApproveTask,
  onViewTask,
  onTaskClick,
  actionsDisabled = false,
  className,
}: OutreachPlanCardProps) {
  const defaults = getVariantDefaults(variant);
  const resolvedStrategyClamp = strategyClamp ?? defaults.strategyClamp;
  const resolvedShowStrategyToggle =
    showStrategyToggle ?? defaults.showStrategyToggle;
  const resolvedShowTasks = showTasks ?? defaults.showTasks;
  const resolvedShowTasksToggle = showTasksToggle ?? defaults.showTasksToggle;
  const resolvedShowTaskActions = showTaskActions ?? defaults.showTaskActions;
  const resolvedTaskMode =
    taskMode ?? (resolvedShowTaskActions ? "interactive" : defaults.taskMode);
  const effectiveTaskMode = actionsDisabled ? "readonly" : resolvedTaskMode;

  const [strategyExpanded, setStrategyExpanded] = React.useState(
    defaultStrategyExpanded ?? defaults.defaultStrategyExpanded
  );
  const [tasksExpanded, setTasksExpanded] = React.useState(
    defaultTasksExpanded ?? defaults.defaultTasksExpanded
  );

  const isDraft = status === "draft";
  const isApproved = status === "approved";
  const isExecuting = status === "executing";
  const isPaused = status === "paused";
  const isBlockedAuth = status === "blocked_auth";
  const isResumable = isPaused || isBlockedAuth;
  const hasEditAction = (isDraft || isApproved || isExecuting) && !!onEdit;
  const hasPrimaryAction =
    (isDraft && !!onApprove) ||
    (isExecuting && !!onPause) ||
    (isResumable && !!onResume);
  const hasHeaderActions = hasEditAction || hasPrimaryAction;
  const showMobileOverflow = hasEditAction && hasPrimaryAction;

  const canToggleStrategy =
    !!rationale &&
    resolvedShowStrategyToggle &&
    shouldEnableStrategyExpansion(rationale);
  const shouldRenderTasks =
    resolvedShowTasks &&
    tasks.length > 0 &&
    (!resolvedShowTasksToggle || tasksExpanded);

  return (
    <article className={cn("overflow-hidden rounded-xl border", className)}>
      {showHeader && (
        <header className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-base font-medium">{title}</h3>
            <Badge variant="outline" className="shrink-0 text-xs font-normal">
              {getOutreachPlanStatusLabel(status)}
            </Badge>
          </div>

          {hasHeaderActions && (
            <div className="flex shrink-0 items-center gap-1">
              {hasEditAction && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={onEdit}
                  disabled={actionsDisabled}
                  className={cn(showMobileOverflow && "hidden md:inline-flex")}
                >
                  Edit
                </Button>
              )}
              {isDraft && onApprove && (
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={onApprove}
                  disabled={actionsDisabled}
                >
                  Approve
                </Button>
              )}
              {isExecuting && onPause && (
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={onPause}
                  disabled={actionsDisabled}
                >
                  Pause
                </Button>
              )}
              {isResumable && onResume && (
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={onResume}
                  disabled={actionsDisabled}
                >
                  Resume
                </Button>
              )}
              {showMobileOverflow && (
                <div className="md:hidden">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="xsIcon"
                        aria-label="More actions"
                      >
                        <MoreHorizIcon className="fill-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>↳ Menu</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={actionsDisabled}
                        onClick={onEdit}
                      >
                        <EditIcon className="fill-current" />
                        Edit
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          )}
        </header>
      )}

      {rationale && (
        <div className="px-4 pb-4">
          {strategyLabel && (
            <p className="mb-2 text-sm font-medium">{strategyLabel}</p>
          )}
          <PlanStrategyContent
            rationale={rationale}
            collapsed={!strategyExpanded}
            clampLines={resolvedStrategyClamp}
          />
          {canToggleStrategy && (
            <Button
              variant="outline"
              size="xs"
              className="mt-2"
              onClick={() => setStrategyExpanded((current) => !current)}
            >
              {strategyExpanded ? "Show less" : "Show more"}
            </Button>
          )}
        </div>
      )}

      {shouldRenderTasks && (
        <div>
          {tasksLabel && (
            <div className="border-t px-4 py-2">
              <p className="text-sm font-medium">{tasksLabel}</p>
            </div>
          )}
          <ol>
            {tasks.map((task) => (
              <TaskItem
                key={task._id}
                taskId={task._id}
                order={task.order}
                type={task.type as "comment" | "wait" | "ask_human"}
                description={task.description}
                status={task.status}
                content={task.content}
                prospectId={prospectId}
                threadId={threadId}
                targetTweetId={task.targetTweetId}
                mode={effectiveTaskMode}
                onApproveTask={
                  resolvedShowTaskActions && !actionsDisabled
                    ? onApproveTask
                    : undefined
                }
                onViewTask={
                  resolvedShowTaskActions && !actionsDisabled
                    ? onViewTask
                    : undefined
                }
                onClick={
                  resolvedShowTaskActions && !actionsDisabled
                    ? onTaskClick
                    : undefined
                }
              />
            ))}
          </ol>
        </div>
      )}

      {(resolvedShowTasksToggle || footerAction) && (
        <footer className="px-4 pb-4">
          <div className="flex flex-col gap-2">
            {resolvedShowTasksToggle &&
              resolvedShowTasks &&
              tasks.length > 0 && (
                <Button
                  variant="outline"
                  size="xs"
                  className="w-full"
                  onClick={() => setTasksExpanded((current) => !current)}
                >
                  {tasksExpanded ? "Hide tasks" : "Show tasks"}
                </Button>
              )}
            {footerAction && (
              <Button
                variant="outline"
                size="xs"
                className="w-full"
                onClick={footerAction.onClick}
              >
                {footerAction.label}
              </Button>
            )}
          </div>
        </footer>
      )}
    </article>
  );
}
