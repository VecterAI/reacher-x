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
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, Suspense } from "react";
import { Button } from "@/shared/ui/components/Button";
import { CheckCircleIcon } from "@/shared/ui/components/icons";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const checkoutId = searchParams.get("checkout_id");

  // Poll subscription status
  const subscription = useQuery(api.polar.getSubscription);
  const plan = useQuery(api.plans.getCurrentPlan);

  useEffect(() => {
    // If subscription is active, redirect to dashboard after 3s
    if (subscription?.status === "active") {
      const timeout = setTimeout(() => router.push("/"), 3000);
      return () => clearTimeout(timeout);
    }
  }, [subscription, router]);

  // Derive plan name from tier
  const planName = plan?.tier
    ? plan.tier.charAt(0).toUpperCase() + plan.tier.slice(1)
    : "Premium";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="flex items-center gap-3 text-green-500">
        <CheckCircleIcon className="h-12 w-12 fill-current" />
        <h1 className="text-2xl font-bold">Payment Successful!</h1>
      </div>

      <p className="text-muted-foreground max-w-md text-center">
        Thank you for upgrading to {planName}. Your subscription is now active.
      </p>

      {checkoutId && (
        <p className="text-muted-foreground text-xs">
          Checkout ID: {checkoutId}
        </p>
      )}

      <Button onClick={() => router.push("/")}>Go to Dashboard</Button>
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
