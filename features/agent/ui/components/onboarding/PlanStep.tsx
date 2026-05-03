"use client";

import { api } from "@/convex/_generated/api";
import { useQueryWithStatus } from "@/shared/hooks";
import { PlanSelector } from "@/features/billing/ui/components/PlanSelector";
import type { BillingPeriod } from "./planStepConfig";

export interface PlanStepProps {
  onSelectFree: () => void | Promise<void>;
  onUpgradePaid: (selection: {
    tier: "base" | "pro";
    billing: BillingPeriod;
  }) => void;
  isStartingCheckout?: boolean;
}

export function PlanStep({
  onSelectFree,
  onUpgradePaid,
  isStartingCheckout = false,
}: PlanStepProps) {
  const currentPlanQuery = useQueryWithStatus(api.plans.getCurrentPlan);
  const planTier = currentPlanQuery.data?.tier ?? "free";

  return (
    <PlanSelector
      mode="onboarding"
      currentTier={planTier}
      onSelectFree={onSelectFree}
      onUpgradePaid={onUpgradePaid}
      isStartingCheckout={isStartingCheckout}
    />
  );
}
