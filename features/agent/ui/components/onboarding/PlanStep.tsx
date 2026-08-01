"use client";

import { api } from "@/convex/_generated/api";
import { useQueryWithStatus } from "@/shared/hooks";
import { PlanSelector } from "@/features/billing/ui/components/PlanSelector";
import type { BillingPeriod } from "./planStepConfig";

export interface PlanStepProps {
  onUpgradePaid: (selection: {
    tier: "hobby" | "base" | "pro";
    billing: BillingPeriod;
  }) => void;
  isStartingCheckout?: boolean;
  /** Use-case entity plural for plan feature lines (matches landing pricing). */
  entityPlural?: string;
}

export function PlanStep({
  onUpgradePaid,
  isStartingCheckout = false,
  entityPlural,
}: PlanStepProps) {
  const currentPlanQuery = useQueryWithStatus(api.plans.getCurrentPlan);
  const planTier = currentPlanQuery.data?.tier ?? "free";

  return (
    <PlanSelector
      mode="onboarding"
      currentTier={planTier}
      onUpgradePaid={onUpgradePaid}
      isStartingCheckout={isStartingCheckout}
      entityPlural={entityPlural}
    />
  );
}
