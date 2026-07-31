/**
 * DemoOutreachPlanSection
 * Static equivalent of OutreachPlanSection (which is Convex-wired): renders
 * the real OutreachPlanCard in its "current" variant with mock plan data.
 * Approve/Pause/Resume work on local state so the waiting-for-approval
 * flow is clickable; edit/view handlers are inert (they open wired panels
 * in the real app).
 */
"use client";

import * as React from "react";
import { OutreachPlanCard } from "@/features/prospects/ui/components/outreach-plan";
import type { DemoOutreachPlan } from "../useCaseDemoData";

export function DemoOutreachPlanSection({
  plan,
  prospectId,
}: {
  plan: DemoOutreachPlan;
  prospectId: string;
}) {
  const [status, setStatus] = React.useState<string>(plan.status);
  const isDraft = status === "draft";
  const isExecuting = status === "executing";
  const isPaused = status === "paused";

  return (
    <OutreachPlanCard
      variant="current"
      status={status}
      rationale={plan.rationale}
      tasks={plan.tasks}
      prospectId={prospectId}
      onApprove={isDraft ? () => setStatus("executing") : undefined}
      onPause={isExecuting ? () => setStatus("paused") : undefined}
      onResume={isPaused ? () => setStatus("executing") : undefined}
    />
  );
}
