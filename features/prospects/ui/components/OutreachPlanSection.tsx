"use client";

import * as React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/shared/ui/components/Button";
import { Badge } from "@/shared/ui/components/Badge";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { parseText } from "@/shared/lib/utils";
import { TaskItem } from "./TaskItem";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { EditIcon } from "@/shared/ui/components/icons";
import { cn } from "@/shared/lib/utils";

const PLAN_STATUS_LABELS: Record<string, string> = {
  draft: "Waiting approval",
  approved: "Ready",
  executing: "Executing",
  paused: "Paused",
  blocked_auth: "Reconnect required",
  completed: "Completed",
  abandoned: "Abandoned",
};

// ============================================================================
// OutreachPlanCard — presentational, reusable in ActivityLogTab and here
// ============================================================================

export interface OutreachPlanCardTask {
  _id: string;
  order: number;
  type: string;
  description: string;
  status: string;
  content?: string;
  targetTweetId?: string;
}

export interface OutreachPlanCardProps {
  status: string;
  rationale?: string;
  tasks: OutreachPlanCardTask[];
  prospectId?: string;
  threadId?: string;
  onEdit?: () => void;
  onApprove?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onApproveTask?: (taskId: string) => void;
  onTaskClick?: () => void;
  className?: string;
}

export function OutreachPlanCard({
  status,
  rationale,
  tasks,
  prospectId,
  threadId,
  onEdit,
  onApprove,
  onPause,
  onResume,
  onApproveTask,
  onTaskClick,
  className,
}: OutreachPlanCardProps) {
  const [showFullStrategy, setShowFullStrategy] = React.useState(false);

  const isDraft = status === "draft";
  const isApproved = status === "approved";
  const isExecuting = status === "executing";
  const isPaused = status === "paused";
  const isBlockedAuth = status === "blocked_auth";
  const hasActions =
    (isDraft || isApproved || isExecuting || isPaused || isBlockedAuth) &&
    (onEdit || onApprove || onPause || onResume);

  return (
    <div className={cn("rounded-xl border", className)}>
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-md truncate font-medium">Outreach plan</h3>
          <Badge variant="outline" className="shrink-0 text-xs font-normal">
            {PLAN_STATUS_LABELS[status] || status}
          </Badge>
        </div>
        {hasActions && (
          <div className="flex shrink-0 items-center gap-1">
            {(isDraft || isApproved || isExecuting) && onEdit && (
              <>
                <Button
                  variant="outline"
                  size="xsIcon"
                  className="sm:hidden"
                  onClick={onEdit}
                  aria-label="Edit plan"
                >
                  <EditIcon className="fill-current" />
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  className="hidden sm:inline-flex"
                  onClick={onEdit}
                >
                  Edit
                </Button>
              </>
            )}
            {isDraft && onApprove && (
              <Button size="xs" variant="secondary" onClick={onApprove}>
                Approve
              </Button>
            )}
            {isExecuting && onPause && (
              <Button variant="secondary" size="xs" onClick={onPause}>
                Pause
              </Button>
            )}
            {(isPaused || isBlockedAuth) && onResume && (
              <Button size="xs" variant="secondary" onClick={onResume}>
                Resume
              </Button>
            )}
          </div>
        )}
      </div>

      {rationale && (
        <div className="px-4 pb-3">
          <p
            className={cn(
              "[&_a]:text-muted-foreground text-sm whitespace-pre-line [&_a]:hover:underline",
              !showFullStrategy && "line-clamp-2"
            )}
          >
            {parseText(rationale)}
          </p>
          {rationale.length > 120 && (
            <Button
              variant="link"
              size="xs"
              className="text-muted-foreground px-0"
              onClick={() => setShowFullStrategy((p) => !p)}
            >
              {showFullStrategy ? "Show less" : "Show more"}
            </Button>
          )}
        </div>
      )}

      {tasks.map((task) => (
        <TaskItem
          key={task._id}
          taskId={task._id}
          order={task.order}
          type={task.type as "comment" | "wait" | "ask_human"}
          description={task.description}
          status={task.status}
          content={task.content}
          prospectId={prospectId ?? ""}
          threadId={threadId}
          targetTweetId={task.targetTweetId}
          onApproveTask={onApproveTask}
          onClick={onTaskClick}
        />
      ))}
    </div>
  );
}

// ============================================================================
// OutreachPlanSection — data-fetching wrapper around OutreachPlanCard
// ============================================================================

export interface OutreachPlanSectionProps {
  prospectId: string;
  onGeneratePlan?: () => void;
}

export function OutreachPlanSection({
  prospectId,
  onGeneratePlan: _onGeneratePlan,
}: OutreachPlanSectionProps) {
  const router = useRouter();

  const planData = useQuery(api.outreach.getProspectPlan, {
    prospectId: prospectId as Id<"prospects">,
  });

  const prospect = useQuery(api.prospects.getProspect, {
    prospectId: prospectId as Id<"prospects">,
  });

  const approvePlan = useMutation(api.outreach.approvePlan);
  const resumePlan = useMutation(api.outreach.resumePlan);
  const pausePlan = useMutation(api.outreach.pausePlan);
  const approveTask = useMutation(api.outreach.approveTask);

  if (planData === undefined) {
    return <PlanSkeleton />;
  }

  if (!planData && prospect?.planGenerationStatus === "generating") {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <Loader2 className="text-primary mx-auto size-6 animate-spin" />
        <p className="mt-2 text-sm font-medium">
          Generating outreach plan&hellip;
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          This high-match prospect (90+) is getting a personalized plan
          automatically.
        </p>
      </div>
    );
  }

  if (!planData) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <p className="text-muted-foreground text-sm">No outreach plan yet.</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            router.push(`/agent?prospectId=${prospectId}&action=generatePlan`);
          }}
        >
          Generate Plan
        </Button>
      </div>
    );
  }

  const { plan, tasks } = planData;
  const isDraft = plan.status === "draft";
  const isExecuting = plan.status === "executing";
  const isResumable =
    plan.status === "paused" || plan.status === "blocked_auth";

  const handleApprovePlan = async () => {
    await approvePlan({ planId: plan._id });
  };

  const handlePause = async () => {
    await pausePlan({ planId: plan._id });
  };

  const handleResume = async () => {
    await resumePlan({ planId: plan._id });
  };

  const handleEdit = () => {
    const url = plan.threadId
      ? `/agent?prospectId=${prospectId}&threadId=${plan.threadId}`
      : `/agent?prospectId=${prospectId}`;
    router.push(url);
  };

  const handleApproveTask = async (taskId: string) => {
    await approveTask({ taskId: taskId as Id<"outreachTasks"> });
  };

  const handleTaskClick = () => {
    const url = plan.threadId
      ? `/agent?prospectId=${prospectId}&threadId=${plan.threadId}`
      : `/agent?prospectId=${prospectId}`;
    router.push(url);
  };

  return (
    <OutreachPlanCard
      status={plan.status}
      rationale={plan.strategy.rationale}
      tasks={tasks}
      prospectId={prospectId}
      threadId={plan.threadId}
      onEdit={handleEdit}
      onApprove={isDraft ? handleApprovePlan : undefined}
      onPause={isExecuting ? handlePause : undefined}
      onResume={isResumable ? handleResume : undefined}
      onApproveTask={handleApproveTask}
      onTaskClick={handleTaskClick}
    />
  );
}

function PlanSkeleton() {
  return (
    <div className="rounded-xl border">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
      <div className="space-y-1 px-4 pb-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="border-t px-4 py-3">
        <div className="flex items-start gap-3">
          <Skeleton className="mt-0.5 size-4 rounded" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <div className="border-t px-4 py-3">
        <div className="flex items-start gap-3">
          <Skeleton className="mt-0.5 size-4 rounded" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
