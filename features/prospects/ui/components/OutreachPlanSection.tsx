"use client";

/**
 * OutreachPlanSection
 * Displays the outreach plan for a prospect with tasks.
 * Shows loading indicator during auto plan generation (for >= 90 score prospects).
 */

import * as React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/shared/ui/components/Button";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { TaskItem } from "./TaskItem";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  approved: "Ready",
  executing: "In Progress",
  paused: "Paused",
  completed: "Completed",
  abandoned: "Abandoned",
};

export interface OutreachPlanSectionProps {
  prospectId: string;
  onGeneratePlan?: () => void;
}

export function OutreachPlanSection({
  prospectId,
  onGeneratePlan,
}: OutreachPlanSectionProps) {
  const router = useRouter();

  // Query plan data
  const planData = useQuery(api.outreach.getProspectPlan, {
    prospectId: prospectId as Id<"prospects">,
  });

  // Query prospect for planGenerationStatus
  const prospect = useQuery(api.prospects.getProspect, {
    prospectId: prospectId as Id<"prospects">,
  });

  const approvePlan = useMutation(api.outreach.approvePlan);
  const pausePlan = useMutation(api.outreach.pausePlan);

  // Loading state - plan data not yet loaded
  if (planData === undefined) {
    return <PlanSkeleton />;
  }

  // Auto-generation in progress - show loading indicator
  if (!planData && prospect?.planGenerationStatus === "generating") {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Loader2 className="text-primary mx-auto size-6 animate-spin" />
        <p className="mt-2 text-sm font-medium">Generating outreach plan...</p>
        <p className="text-muted-foreground mt-1 text-xs">
          This high-match prospect (90+) is getting a personalized plan
          automatically.
        </p>
      </div>
    );
  }

  // No plan and no auto-generation - show manual button
  if (!planData) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-muted-foreground text-sm">No outreach plan yet.</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            // Navigate with action=generatePlan to trigger auto-prompting
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
  const isPaused = plan.status === "paused";

  const handleApprove = async () => {
    await approvePlan({ planId: plan._id });
  };

  const handlePause = async () => {
    await pausePlan({ planId: plan._id });
  };

  const handleEdit = () => {
    router.push(`/agent?prospectId=${prospectId}`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Outreach Plan</h3>
          <p className="text-muted-foreground text-xs">
            {STATUS_LABELS[plan.status] || plan.status}
          </p>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <>
              <Button variant="ghost" size="sm" onClick={handleEdit}>
                Edit
              </Button>
              <Button size="sm" onClick={handleApprove}>
                Approve
              </Button>
            </>
          )}
          {isExecuting && (
            <Button variant="outline" size="sm" onClick={handlePause}>
              Pause
            </Button>
          )}
          {isPaused && (
            <Button size="sm" onClick={handleApprove}>
              Resume
            </Button>
          )}
        </div>
      </div>

      {/* Strategy */}
      <div className="bg-muted/50 rounded-lg p-3 text-sm">
        <p className="text-muted-foreground text-xs font-medium uppercase">
          Strategy
        </p>
        <p className="mt-1">{plan.strategy.rationale}</p>
      </div>

      {/* Tasks */}
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskItem
            key={task._id}
            order={task.order}
            type={task.type}
            description={task.description}
            status={task.status}
            content={task.content}
          />
        ))}
      </div>
    </div>
  );
}

function PlanSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
