"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  useActiveUseCaseLabels,
  useConvexReady,
  useQueryWithStatus,
} from "@/shared/hooks";
import { Badge } from "@/shared/ui/components/Badge";
import { Button } from "@/shared/ui/components/Button";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import {
  OutreachPlanCard,
  PlanActionMenu,
  getOutreachPlanStatusLabel,
} from "@/features/prospects/ui/components/outreach-plan";
import { cn } from "@/shared/lib/utils";
import type {
  TwitterPostRef,
  TwitterPostSummary,
} from "@/shared/lib/twitter/contracts";
import { toast } from "sonner";

export interface AgentPlanPanelProps {
  prospectId: string;
  currentThreadId?: string | null;
  onClose: () => void;
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
  className?: string;
}

export function AgentPlanPanel({
  prospectId,
  currentThreadId,
  onClose,
  onViewTask,
  className,
}: AgentPlanPanelProps) {
  const router = useRouter();
  const { entitySingular } = useActiveUseCaseLabels();
  const entitySingularLower = entitySingular.toLowerCase();
  const {
    isReady: isConvexReady,
    isLoading: isConvexReadyLoading,
    error: convexReadyError,
  } = useConvexReady();

  const planDataQuery = useQueryWithStatus(
    api.outreach.getProspectPlan,
    isConvexReady ? { prospectId: prospectId as Id<"prospects"> } : "skip"
  );
  const planData = planDataQuery.data;

  const prospectQuery = useQueryWithStatus(
    api.prospects.getProspect,
    isConvexReady ? { prospectId: prospectId as Id<"prospects"> } : "skip"
  );
  const prospectArchived = prospectQuery.data?.status === "archived";
  const headerPlanActionsDisabled = prospectQuery.isPending || prospectArchived;

  const approvePlan = useMutation(api.outreach.approvePlan);
  const pausePlan = useMutation(api.outreach.pausePlan);
  const resumePlan = useMutation(api.outreach.resumePlan);
  const deletePlan = useMutation(api.outreach.deletePlan);
  const approveTask = useMutation(api.outreach.approveTask);

  const isPanelLoading =
    isConvexReadyLoading ||
    (isConvexReady && (planDataQuery.isPending || prospectQuery.isPending));

  const plan = planData?.plan;
  const tasks = planData?.tasks ?? [];
  const isDraft = plan?.status === "draft";
  const isExecuting = plan?.status === "executing";
  const isResumable =
    plan?.status === "paused" || plan?.status === "blocked_auth";
  const resolvedThreadId = currentThreadId ?? plan?.threadId ?? null;

  const handleApprovePlan = useCallback(async () => {
    if (!plan) return;
    await approvePlan({ planId: plan._id });
  }, [approvePlan, plan]);

  const handlePausePlan = useCallback(async () => {
    if (!plan) return;
    await pausePlan({ planId: plan._id });
  }, [pausePlan, plan]);

  const handleResumePlan = useCallback(async () => {
    if (!plan) return;
    await resumePlan({ planId: plan._id });
  }, [plan, resumePlan]);

  const handleEditPlan = useCallback(() => {
    const url = resolvedThreadId
      ? `/agent?prospectId=${prospectId}&threadId=${resolvedThreadId}`
      : `/agent?prospectId=${prospectId}`;
    router.push(url);
  }, [prospectId, resolvedThreadId, router]);

  const handleDeletePlan = useCallback(async () => {
    if (!plan) return;
    await toast.promise(deletePlan({ planId: plan._id }), {
      loading: "Deleting plan...",
      success: "Plan deleted",
      error: "Failed to delete plan",
    });
    onClose();
  }, [deletePlan, onClose, plan]);

  const handleApproveTask = useCallback(
    async ({
      taskId,
      type,
    }: {
      taskId: string;
      type: "comment" | "dm" | "react";
    }) => {
      await approveTask({
        taskId: taskId as Id<"outreachTasks">,
        expectedType: type,
      });
    },
    [approveTask]
  );

  return (
    <aside
      className={cn(
        "flex h-full w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout className="flex flex-col md:w-full">
        <PageHeader
          title="Outreach plan"
          onBack={onClose}
          titleSuffix={
            plan ? (
              <Badge variant="outline" className="text-xs font-normal">
                {getOutreachPlanStatusLabel(plan.status)}
              </Badge>
            ) : null
          }
          actions={
            plan ? (
              <div className="flex items-center gap-1">
                {isDraft && (
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={handleApprovePlan}
                    disabled={headerPlanActionsDisabled}
                  >
                    Approve
                  </Button>
                )}
                {isExecuting && (
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={handlePausePlan}
                    disabled={headerPlanActionsDisabled}
                  >
                    Pause
                  </Button>
                )}
                {isResumable && (
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={handleResumePlan}
                    disabled={headerPlanActionsDisabled}
                  >
                    Resume
                  </Button>
                )}
                <PlanActionMenu
                  onEdit={handleEditPlan}
                  onDelete={handleDeletePlan}
                  disabled={headerPlanActionsDisabled}
                  ariaLabel="Outreach plan actions"
                />
              </div>
            ) : null
          }
        />

        <ScrollArea className="min-h-0 flex-1" viewportClassName="pb-8">
          <PageContent className="py-0">
            {isPanelLoading ? (
              <div className="space-y-3 px-4 py-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : convexReadyError || planDataQuery.isError ? (
              <div className="px-4 py-4">
                <p className="text-sm font-medium">
                  Could not load outreach plan
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {convexReadyError?.message ||
                    planDataQuery.error?.message ||
                    "Please try again."}
                </p>
              </div>
            ) : !plan ? (
              <div className="px-4 py-4">
                <p className="text-muted-foreground text-sm">
                  No outreach plan is available for this {entitySingularLower}{" "}
                  yet.
                </p>
              </div>
            ) : (
              <OutreachPlanCard
                variant="panel"
                showHeader={false}
                status={plan.status}
                rationale={plan.strategy.rationale}
                strategyLabel="Strategy"
                tasksLabel="Tasks"
                tasks={tasks}
                prospectId={prospectId}
                threadId={plan.threadId}
                onApproveTask={handleApproveTask}
                onViewTask={onViewTask}
                actionsDisabled={prospectArchived}
                className="mt-4 rounded-none border-none"
              />
            )}
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
  );
}
