"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useActiveUseCaseLabels, useQueryWithStatus } from "@/shared/hooks";
import { Button } from "@/shared/ui/components/Button";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type {
  TwitterPostRef,
  TwitterPostSummary,
} from "@/shared/lib/twitter/contracts";
import { OutreachPlanCard } from "./outreach-plan/OutreachPlanCard";
import { usePanelStack } from "../../contexts/PanelStackContext";

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
  const { pushPanel } = usePanelStack();
  const { entitySingular } = useActiveUseCaseLabels();
  const entitySingularLower = entitySingular.toLowerCase();

  const planDataQuery = useQueryWithStatus(api.outreach.getProspectPlan, {
    prospectId: prospectId as Id<"prospects">,
  });
  const planData = planDataQuery.data;

  const prospectQuery = useQueryWithStatus(api.prospects.getProspect, {
    prospectId: prospectId as Id<"prospects">,
  });
  const prospect = prospectQuery.data;
  const isArchived = prospect?.status === "archived";

  const approvePlan = useMutation(api.outreach.approvePlan);
  const resumePlan = useMutation(api.outreach.resumePlan);
  const pausePlan = useMutation(api.outreach.pausePlan);
  const approveTask = useMutation(api.outreach.approveTask);

  if (planDataQuery.isPending || prospectQuery.isPending) {
    return <PlanSkeleton />;
  }

  if (planDataQuery.isError || prospectQuery.isError) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <p className="text-sm font-medium">Could not load outreach plan</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {planDataQuery.error?.message ||
            prospectQuery.error?.message ||
            "Please try again."}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => router.refresh()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!planData && prospect?.planGenerationStatus === "generating") {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <Loader2 className="text-primary mx-auto size-6 animate-spin" />
        <p className="mt-2 text-sm font-medium">
          Generating outreach plan&hellip;
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          This high-match {entitySingularLower} (90+) is getting a personalized
          plan automatically.
        </p>
      </div>
    );
  }

  if (!planData) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <p className="text-muted-foreground text-sm">
          Use{" "}
          <code className="text-foreground rounded border px-1.5 py-0.5 font-mono text-[13px] font-medium">
            △ Agent
          </code>{" "}
          to plan and chat, or use{" "}
          <code className="text-foreground rounded border px-1.5 py-0.5 font-mono text-[13px] font-medium">
            Generate plan
          </code>{" "}
          to create your first outreach plan draft.
        </p>
        <Button
          variant="outline"
          size="xs"
          className="mt-3"
          disabled={isArchived}
          title={
            isArchived ? "Unarchive this profile to generate a plan" : undefined
          }
          onClick={() => {
            router.push(`/agent?prospectId=${prospectId}&action=generatePlan`);
          }}
        >
          Generate plan
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

  const handleApproveTask = async ({
    taskId,
    type,
  }: {
    taskId: string;
    type: "comment" | "dm";
  }) => {
    await approveTask({
      taskId: taskId as Id<"outreachTasks">,
      expectedType: type,
    });
  };

  const handleTaskClick = () => {
    const url = plan.threadId
      ? `/agent?prospectId=${prospectId}&threadId=${plan.threadId}`
      : `/agent?prospectId=${prospectId}`;
    router.push(url);
  };

  const handleViewTask = ({
    taskId,
    targetTweetId,
    kind,
    panelMode,
    fallbackPost,
  }: {
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
  }) => {
    pushPanel("task-compose", {
      prospectId,
      taskId,
      targetTweetId,
      requestedKind: kind ?? "post",
      panelMode,
      fallbackPost,
    });
  };

  return (
    <OutreachPlanCard
      variant="current"
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
      onViewTask={handleViewTask}
      onTaskClick={handleTaskClick}
      actionsDisabled={isArchived}
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
