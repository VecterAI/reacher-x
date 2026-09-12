"use client";

import type { OutreachReadiness } from "@/convex/lib/outreachReadinessCore";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  resolveOutreachPlanPreviewState,
  type OutreachPlanPreviewState,
} from "@/shared/lib/outreach/planPreviewState";
import { useConvexReady } from "./useConvexReady";
import { useQueryWithStatus } from "./useQueryWithStatus";

interface LivePlanPreviewData<TTask> {
  plan: {
    status: string;
    strategy: {
      rationale: string;
    };
  };
  tasks: TTask[];
}

export function useOutreachPlanPreviewState<TTask>({
  planId,
  fallbackStatus,
  fallbackRationale,
  fallbackTasks,
}: {
  planId?: string | null;
  fallbackStatus: string;
  fallbackRationale: string;
  fallbackTasks: TTask[];
}): {
  resolvedPlanPreview: OutreachPlanPreviewState<TTask> | null;
  isPending: boolean;
  readiness?: OutreachReadiness;
  canStart: boolean;
  prospectId?: string;
  threadId?: string;
} {
  const { isReady: isConvexReady, isLoading: isConvexReadyLoading } =
    useConvexReady();
  const livePlanQuery = useQueryWithStatus(
    api.outreach.getPlanById,
    isConvexReady && planId ? { planId: planId as Id<"outreachPlans"> } : "skip"
  );

  const livePlanData = livePlanQuery.isSuccess
    ? ((livePlanQuery.data as LivePlanPreviewData<TTask> | null) ?? null)
    : undefined;
  const isPending =
    Boolean(planId) &&
    (!isConvexReady ||
      isConvexReadyLoading ||
      (isConvexReady && livePlanQuery.isPending));

  return {
    resolvedPlanPreview: resolveOutreachPlanPreviewState({
      planId,
      livePlanData,
      fallbackStatus,
      fallbackRationale,
      fallbackTasks,
      isPending,
    }),
    isPending,
    readiness: livePlanQuery.data?.readiness,
    canStart:
      livePlanQuery.data?.plan.status === "approved" &&
      !livePlanQuery.data.plan.workflowId,
    prospectId: livePlanQuery.data?.plan.prospectId,
    threadId: livePlanQuery.data?.plan.threadId,
  };
}
