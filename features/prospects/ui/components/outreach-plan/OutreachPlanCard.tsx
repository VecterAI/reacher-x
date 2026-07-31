"use client";

import * as React from "react";
import { Badge } from "@/shared/ui/components/Badge";
import { Button } from "@/shared/ui/components/Button";
import { cn } from "@/shared/lib/utils";
import type {
  TwitterPostRef,
  TwitterPostSummary,
} from "@/shared/lib/twitter/contracts";
import {
  PlanStrategyContent,
  shouldEnableStrategyExpansion,
} from "./PlanStrategyContent";
import { PlanActionMenu } from "./PlanActionMenu";
import { TaskItem, type TaskItemMode } from "./TaskItem";

const PLAN_STATUS_LABELS: Record<string, string> = {
  loading: "Syncing...",
  draft: "Waiting approval",
  approved: "Ready",
  executing: "Executing",
  paused: "Paused",
  blocked_auth: "Reconnect required",
  completed: "Completed",
  abandoned: "Abandoned",
  deleted: "Deleted",
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
  approvalReady?: boolean;
  content?: string;
  targetTweetId?: string;
  originalPost?: {
    platform: "twitter" | "linkedin";
    postData?: unknown;
    postRef?: TwitterPostRef;
    postSummary?: TwitterPostSummary;
  } | null;
}

export interface OutreachPlanCardFooterAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
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
  onDeletePlan?: () => void;
  onApprove?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onApproveTask?: (payload: {
    taskId: string;
    type: "comment" | "dm" | "react";
  }) => void;
  onViewTask?: (payload: {
    taskId: string;
    targetTweetId?: string;
    kind?: "post" | "dm";
    panelMode: "approval" | "posted";
    fallbackPost?: {
      platform: "twitter" | "linkedin";
      postData?: unknown;
      postRef?: TwitterPostRef;
      postSummary?: TwitterPostSummary;
    };
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
  onDeletePlan,
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
  const isExecuting = status === "executing";
  const isPaused = status === "paused";
  const isBlockedAuth = status === "blocked_auth";
  const hasWaitingManual = tasks.some(
    (task) => task.status === "waiting_manual"
  );
  const hasWaitingConnection = tasks.some(
    (task) => task.status === "waiting_connection"
  );
  const isResumable =
    (isPaused && !hasWaitingManual && !hasWaitingConnection) || isBlockedAuth;
  const hasMenuActions = !!onEdit || !!onDeletePlan;
  const hasPrimaryAction =
    (isDraft && !!onApprove) ||
    (isExecuting && !!onPause) ||
    (isResumable && !!onResume);
  const hasHeaderActions = hasPrimaryAction || hasMenuActions;

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
              {hasWaitingManual
                ? "Manual reply needed"
                : getOutreachPlanStatusLabel(status)}
            </Badge>
          </div>

          {hasHeaderActions && (
            <div className="flex shrink-0 items-center gap-1">
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
              <PlanActionMenu
                onEdit={onEdit}
                onDelete={onDeletePlan}
                disabled={actionsDisabled}
                ariaLabel="Outreach plan menu"
              />
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
                type={
                  task.type as "comment" | "dm" | "react" | "wait" | "ask_human"
                }
                description={task.description}
                status={task.status}
                approvalReady={task.approvalReady}
                content={task.content}
                prospectId={prospectId}
                threadId={threadId}
                targetTweetId={task.targetTweetId}
                originalPost={task.originalPost}
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
                disabled={footerAction.disabled}
                title={footerAction.title}
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
