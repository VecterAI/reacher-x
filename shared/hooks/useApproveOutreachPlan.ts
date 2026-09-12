"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getStringProperty, isRecord } from "@/convex/lib/typeGuards";

/** Shared feedback for approval from a plan panel or a chat preview. */
export function useApproveOutreachPlan() {
  const approve = useMutation(api.outreach.approvePlan);
  const pending = useRef(false);
  const [isApproving, setIsApproving] = useState(false);
  const approvePlan = useCallback(
    async ({ planId }: { planId: Id<"outreachPlans"> }) => {
      if (pending.current) return;
      pending.current = true;
      setIsApproving(true);
      const toastId = toast.loading("Starting plan…");
      try {
        await approve({ planId });
        toast.success("Plan started", { id: toastId });
      } catch (error) {
        const message =
          error instanceof ConvexError && isRecord(error.data)
            ? getStringProperty(error.data, "message")
            : undefined;
        toast.error(message ?? "Could not start the plan. Try again.", {
          id: toastId,
        });
      } finally {
        pending.current = false;
        setIsApproving(false);
      }
    },
    [approve]
  );
  return { approvePlan, isApproving };
}
