"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { PLAN_TIER_LABELS } from "@/convex/lib/planConstants";
import { Button } from "@/shared/ui/components/Button";

/** A grant may arrive while the user is already waiting at the plan gate. */
export function GrantedPlanStep({ threadId }: { threadId: string }) {
  const plan = useQuery(api.plans.getCurrentPlan);
  const selectPlan = useMutation(api.setupSessions.selectSetupPlanByThreadId);
  const [isContinuing, setIsContinuing] = useState(false);
  const tier = plan?.tier;

  async function handleContinue() {
    if (!tier || tier === "free" || isContinuing) return;
    setIsContinuing(true);
    try {
      await selectPlan({ threadId, planChoice: tier });
    } catch {
      toast.error("Could not continue setup. Check your access and try again.");
    } finally {
      setIsContinuing(false);
    }
  }

  return (
    <section className="space-y-3">
      <p className="text-sm">
        {tier && tier !== "free"
          ? "Your plan access is ready. Continue to finish setup."
          : plan === undefined
            ? "Checking your plan access."
            : "Plan access is no longer available. Choose a plan to continue."}
      </p>
      <Button
        size="xs"
        disabled={!tier || tier === "free" || isContinuing}
        onClick={() => void handleContinue()}
      >
        {isContinuing
          ? "Continuing..."
          : tier && tier !== "free"
            ? `Continue with ${PLAN_TIER_LABELS[tier]}`
            : plan === undefined
              ? "Loading plan..."
              : "Plan access unavailable"}
      </Button>
    </section>
  );
}
