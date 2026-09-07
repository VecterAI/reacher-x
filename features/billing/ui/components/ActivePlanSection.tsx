"use client";

import { format } from "date-fns";
import { Button } from "@/shared/ui/components/Button";
import { Badge } from "@/shared/ui/components/Badge";
import { ONBOARDING_PLAN_TIERS } from "@/features/agent/ui/components/onboarding/planStepConfig";
import { parseIsoToTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { CheckIcon } from "@/shared/ui/components/icons";

type PlanSummary = {
  tier: "free" | "hobby" | "base" | "pro";
  expiresAt?: number;
  subscriptionTier?: PlanSummary["tier"];
  complimentaryGrant?: { tier: PlanSummary["tier"]; expiresAt?: number } | null;
};

type SubscriptionLike =
  | {
      recurringInterval?: string | null;
      currentPeriodEnd?: unknown;
      cancelAtPeriodEnd?: boolean;
    }
  | null
  | undefined;

export interface ActivePlanSectionProps {
  plan: PlanSummary | null | undefined;
  subscription: SubscriptionLike;
  onUpgrade: () => void;
  onUpgradeToPro: () => void;
  onManageBilling: () => void;
  isPaid: boolean;
}

function tierTitle(tier: "free" | "hobby" | "base" | "pro"): string {
  if (tier === "free") return "Plan required";
  if (tier === "hobby") return "Hobby";
  if (tier === "base") return "Base";
  return "Pro";
}

export function ActivePlanSection({
  plan,
  subscription,
  onUpgrade,
  onUpgradeToPro,
  onManageBilling,
  isPaid,
}: ActivePlanSectionProps) {
  const tier = plan?.tier ?? "free";
  const grant = plan?.complimentaryGrant;
  const billingTier = plan?.subscriptionTier ?? tier;
  const hasSubscription = Boolean(subscription) && billingTier !== "free";
  const tierConfig = ONBOARDING_PLAN_TIERS.find((candidate) => {
    if (tier === "free") return candidate.id === "hobby";
    return candidate.id === tier;
  });
  const features = tierConfig?.features ?? [];

  const renewalTs =
    typeof subscription?.currentPeriodEnd === "number"
      ? subscription.currentPeriodEnd
      : subscription?.currentPeriodEnd instanceof Date
        ? subscription.currentPeriodEnd.getTime()
        : typeof subscription?.currentPeriodEnd === "string"
          ? parseIsoToTimestamp(subscription.currentPeriodEnd)
          : plan?.expiresAt;

  const renewalLabel =
    renewalTs != null ? format(renewalTs, "MMM d, yyyy") : null;

  const intervalLabel =
    subscription?.recurringInterval === "year"
      ? "Yearly"
      : subscription?.recurringInterval === "month"
        ? "Monthly"
        : null;

  const showCancelNotice =
    hasSubscription && Boolean(subscription?.cancelAtPeriodEnd) && renewalLabel;

  return (
    <section className="border-border border-b px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-muted-foreground text-sm font-medium">
            Current plan
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            {tierTitle(tier)}
          </h2>
        </div>
        <Badge variant="outline">
          {grant
            ? "Complimentary access"
            : isPaid
              ? "Active"
              : "Upgrade required"}
        </Badge>
      </div>

      {grant ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Complimentary {tierTitle(grant.tier)} access
          {grant.expiresAt !== undefined ? (
            <>
              {" "}
              until{" "}
              <time dateTime={new Date(grant.expiresAt).toISOString()}>
                {format(grant.expiresAt, "MMM d, yyyy, h:mm a")}
              </time>
            </>
          ) : null}
          .
          {hasSubscription
            ? ` Your ${tierTitle(billingTier)} subscription continues separately.`
            : " No subscription charge."}
        </p>
      ) : null}

      {hasSubscription && (intervalLabel || renewalLabel) ? (
        <div className="text-muted-foreground mt-2 space-y-1 text-xs">
          {intervalLabel ? <p>Billing: {intervalLabel}</p> : null}
          {renewalLabel ? (
            <p>
              {subscription?.cancelAtPeriodEnd ? "Access until" : "Renews"}{" "}
              {renewalLabel}
            </p>
          ) : null}
        </div>
      ) : null}

      {showCancelNotice ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Cancels on {renewalLabel}
        </p>
      ) : null}

      <ul className="mt-4 space-y-2 text-sm">
        {features.map((line) => (
          <li key={line} className="flex gap-2">
            <CheckIcon
              className="text-foreground mt-0.5 size-4 shrink-0 fill-current"
              aria-hidden
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        {grant && tier === "pro" && billingTier !== "pro" ? (
          <Button type="button" size="xs" onClick={onUpgrade}>
            Choose a paid plan
          </Button>
        ) : null}
        {tier === "free" ? (
          <Button type="button" size="xs" onClick={onUpgrade}>
            Upgrade
          </Button>
        ) : null}
        {tier === "hobby" || tier === "base" ? (
          <>
            <Button type="button" size="xs" onClick={onUpgradeToPro}>
              {tier === "hobby" ? "Upgrade plan" : "Upgrade to Pro"}
            </Button>
            {hasSubscription ? (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={onManageBilling}
              >
                Manage billing
              </Button>
            ) : null}
          </>
        ) : null}
        {tier === "pro" && hasSubscription ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={onManageBilling}
          >
            Manage billing
          </Button>
        ) : null}
      </div>
    </section>
  );
}
