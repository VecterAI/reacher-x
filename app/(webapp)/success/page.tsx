"use client";

/**
 * Success Page
 *
 * Handles post-checkout redirect from Polar.
 * Displays success message and redirects to dashboard.
 *
 * @see https://www.convex.dev/components/polar#checkout
 */

import { useSearchParams, useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useEffect, Suspense, useMemo, useRef, useState } from "react";
import { Button } from "@/shared/ui/components/Button";
import { CheckCircleIcon } from "@/shared/ui/components/icons";
import { useQueryWithStatus } from "@/shared/hooks";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const checkoutId = searchParams.get("checkout_id");
  const sessionId = searchParams.get("sessionId");
  const tierParam = searchParams.get("tier");
  const selectedTier =
    tierParam === "base" || tierParam === "pro" ? tierParam : null;
  const returnTo = searchParams.get("returnTo");
  const selectSetupPlan = useMutation(api.setupSessions.selectSetupPlan);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [isReadyToRedirect, setIsReadyToRedirect] = useState(false);
  const hasHandledReturnRef = useRef(false);

  // Poll subscription status
  const subscriptionQuery = useQueryWithStatus(api.polar.getSubscription);
  const planQuery = useQueryWithStatus(api.plans.getCurrentPlan);
  const subscription = subscriptionQuery.data;
  const plan = planQuery.data;
  const normalizedReturnTo = useMemo(() => {
    if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
      return "/";
    }
    return returnTo;
  }, [returnTo]);
  const billingReady =
    selectedTier != null
      ? plan?.tier === selectedTier ||
        (selectedTier === "base" && plan?.tier === "pro")
      : subscription?.status === "active";

  useEffect(() => {
    if (!billingReady || hasHandledReturnRef.current) {
      return;
    }

    hasHandledReturnRef.current = true;
    void (async () => {
      try {
        if (sessionId && selectedTier) {
          await selectSetupPlan({
            sessionId: sessionId as Id<"workspaceSetupSessions">,
            planChoice: selectedTier,
          });
        }
        setIsReadyToRedirect(true);
      } catch (error) {
        hasHandledReturnRef.current = false;
        setResumeError(
          error instanceof Error ? error.message : "Could not resume setup."
        );
      }
    })();
  }, [billingReady, selectedTier, selectSetupPlan, sessionId]);

  useEffect(() => {
    if (isReadyToRedirect) {
      const timeout = setTimeout(
        () => router.push(normalizedReturnTo),
        sessionId ? 1500 : 3000
      );
      return () => clearTimeout(timeout);
    }
  }, [isReadyToRedirect, normalizedReturnTo, router, sessionId]);

  // Derive plan name from tier
  const planName = plan?.tier
    ? plan.tier.charAt(0).toUpperCase() + plan.tier.slice(1)
    : "Premium";
  const statusMessage = isReadyToRedirect
    ? sessionId
      ? "Upgrade confirmed. Returning you to setup."
      : "Upgrade confirmed. Taking you back now."
    : "We're confirming your subscription and unlocking your plan.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="flex items-center gap-3 text-green-500">
        <CheckCircleIcon className="h-12 w-12 fill-current" />
        <h1 className="text-2xl font-bold">Payment Successful!</h1>
      </div>

      <p className="text-muted-foreground max-w-md text-center">
        Thank you for upgrading to {planName}. Your subscription is now active.
      </p>
      <p className="text-muted-foreground max-w-md text-center text-sm">
        {statusMessage}
      </p>
      {subscriptionQuery.isError && (
        <p className="text-muted-foreground max-w-md text-center text-sm">
          We&apos;re still confirming your subscription details. Refresh in a
          moment if access doesn&apos;t update automatically.
        </p>
      )}
      {resumeError ? (
        <p className="max-w-md text-center text-sm text-red-500">
          {resumeError}
        </p>
      ) : null}

      {checkoutId && (
        <p className="text-muted-foreground text-xs">
          Checkout ID: {checkoutId}
        </p>
      )}

      <Button onClick={() => router.push(normalizedReturnTo)}>
        {sessionId ? "Return to setup" : "Go to Dashboard"}
      </Button>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
