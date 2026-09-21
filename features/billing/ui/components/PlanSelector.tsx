"use client";

import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { useQueryWithStatus } from "@/shared/hooks";
import { Button } from "@/shared/ui/components/Button";
import { Badge } from "@/shared/ui/components/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/Card";
import { BillingPeriodSelector } from "./BillingPeriodSelector";
import { PlanOffersSkeleton } from "./PlanOffersSkeleton";
import { useAvailablePlanOffers } from "../../hooks/useAvailablePlanOffers";
import {
  getPlanOfferSelection,
  getUpgradeOffers,
  PLAN_OFFERS_UNAVAILABLE,
} from "@/shared/lib/billing/planOfferHelpers";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import {
  CheckIcon,
  CheckBoxOutlineBlankIcon,
} from "@/shared/ui/components/icons";
import {
  type BillingPeriod,
  type OnboardingPlanTierConfig,
  ONBOARDING_PLAN_TIERS,
  formatPlanPriceLabel,
} from "@/features/agent/ui/components/onboarding/planStepConfig";
import { resolvePlanFeatureEntityCopy } from "@/features/landing/lib/pricingUseCaseCopy";

export type PlanSelectorMode = "onboarding" | "plans";

export interface PlanSelectorProps {
  mode: PlanSelectorMode;
  currentTier: "free" | "hobby" | "base" | "pro";
  onUpgradePaid: (selection: {
    tier: "hobby" | "base" | "pro";
    billing: BillingPeriod;
  }) => void;
  isStartingCheckout?: boolean;
  /** Omit the marketing headline when the parent already provides a title (e.g. upgrade panel). */
  hideMarketingHeadline?: boolean;
  /**
   * Use-case entity plural for feature lines (e.g. “Candidates”).
   * Matches landing `/pricing` terminology swaps. Defaults to “prospects”.
   */
  entityPlural?: string;
}

function PlanPriceBlock({
  tier,
  billing,
  amountOverride,
}: {
  tier: OnboardingPlanTierConfig;
  billing: BillingPeriod;
  amountOverride?: number | null;
}) {
  const periodKey = billing === "monthly" ? "monthly" : "yearly";
  const amount = amountOverride ?? tier.pricing[periodKey].amount;
  if (amount == null) {
    return null;
  }

  const suffix = billing === "monthly" ? "/mo" : "/yr";
  const strike =
    billing === "monthly"
      ? tier.pricing.strikethroughMonthly
      : tier.pricing.strikethroughYearly;

  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <AnimatedNumber
        value={amount}
        prefix="$"
        decimals={2}
        format={{ minimumFractionDigits: 2 }}
        suffix={suffix}
        className="text-foreground text-2xl font-semibold tracking-tight"
      />
      {strike != null ? (
        <span
          className="text-muted-foreground font-mono text-sm tabular-nums line-through"
          aria-hidden
        >
          ${strike.toFixed(2)}
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

function PlanTierCard({
  tier,
  billing,
  amountOverride,
  onUpgradePaid,
  disabled,
  mode,
  entityPlural,
}: {
  tier: OnboardingPlanTierConfig;
  billing: BillingPeriod;
  amountOverride?: number | null;
  onUpgradePaid: (selection: {
    tier: "hobby" | "base" | "pro";
    billing: BillingPeriod;
  }) => void;
  disabled?: boolean;
  mode: PlanSelectorMode;
  entityPlural?: string;
}) {
  const monthlyAmount = tier.pricing.monthly.amount;
  const yearlyAmount = tier.pricing.yearly.amount;
  const amountForCta =
    amountOverride ?? (billing === "monthly" ? monthlyAmount : yearlyAmount);
  const isPlansMode = mode === "plans";
  const featureLines = tier.features.map((line) =>
    resolvePlanFeatureEntityCopy(line, entityPlural)
  );

  return (
    <Card className={isPlansMode ? "shadow-none" : undefined}>
      <CardHeader className="space-y-1 p-4 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base font-semibold">
            {tier.title}
          </CardTitle>
          {tier.badge ? (
            <Badge variant="outline-strong">{tier.badge}</Badge>
          ) : null}
        </div>
        <CardDescription>{tier.subtitle}</CardDescription>
      </CardHeader>
      <CardContent
        className={isPlansMode ? "space-y-3 p-4 pt-0" : "space-y-4 p-4 pt-0"}
      >
        <PlanPriceBlock
          tier={tier}
          billing={billing}
          amountOverride={amountOverride}
        />

        {tier.featureLeadIn ? (
          <p className="text-foreground text-sm font-medium">
            {tier.featureLeadIn}
          </p>
        ) : null}
        <ul className="space-y-2 text-sm">
          {featureLines.map((line) => {
            const isComingSoon = line.endsWith("(Coming soon)");
            const label = isComingSoon
              ? line.replace(/ \(Coming soon\)$/, "")
              : line;
            return (
              <li key={line} className="flex gap-2">
                {isComingSoon ? (
                  <>
                    <CheckBoxOutlineBlankIcon
                      className="text-muted-foreground mt-0.5 size-4 shrink-0 fill-current"
                      aria-hidden
                    />
                    <span>{label}</span>
                    <Badge variant="outline-strong" className="shrink-0">
                      Coming soon
                    </Badge>
                  </>
                ) : (
                  <>
                    <CheckIcon
                      className="text-foreground mt-0.5 size-4 shrink-0 fill-current"
                      aria-hidden
                    />
                    <span>{line}</span>
                  </>
                )}
              </li>
            );
          })}
        </ul>

        <Button
          type="button"
          size="xs"
          className="w-full"
          disabled={amountForCta == null || disabled}
          onClick={() =>
            onUpgradePaid({
              tier: tier.id,
              billing,
            })
          }
        >
          {amountForCta != null
            ? `Upgrade for ${formatPlanPriceLabel(amountForCta, billing)}`
            : "Upgrade plan"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function PlanSelector({
  mode,
  currentTier,
  onUpgradePaid,
  isStartingCheckout = false,
  hideMarketingHeadline = false,
  entityPlural,
}: PlanSelectorProps) {
  const [preferredBilling, setBilling] = useState<BillingPeriod>("monthly");
  const productsQuery = useQueryWithStatus(api.polar.getConfiguredProducts);
  const availability = useAvailablePlanOffers();
  const offers = getUpgradeOffers(availability.data ?? [], currentTier);
  const { billing, periods, tiers } = getPlanOfferSelection(
    offers,
    preferredBilling
  );
  const visibleTiers = ONBOARDING_PLAN_TIERS.filter((tier) =>
    tiers.includes(tier.id)
  );

  const livePricing = {
    hobby: {
      monthly:
        productsQuery.data?.hobbyMonthly?.prices?.[0]?.priceAmount != null
          ? productsQuery.data.hobbyMonthly.prices[0].priceAmount / 100
          : undefined,
      yearly:
        productsQuery.data?.hobbyYearly?.prices?.[0]?.priceAmount != null
          ? productsQuery.data.hobbyYearly.prices[0].priceAmount / 100
          : undefined,
    },
    base: {
      monthly:
        productsQuery.data?.baseMonthly?.prices?.[0]?.priceAmount != null
          ? productsQuery.data.baseMonthly.prices[0].priceAmount / 100
          : undefined,
      yearly:
        productsQuery.data?.baseYearly?.prices?.[0]?.priceAmount != null
          ? productsQuery.data.baseYearly.prices[0].priceAmount / 100
          : undefined,
    },
    pro: {
      monthly:
        productsQuery.data?.proMonthly?.prices?.[0]?.priceAmount != null
          ? productsQuery.data.proMonthly.prices[0].priceAmount / 100
          : undefined,
      yearly:
        productsQuery.data?.proYearly?.prices?.[0]?.priceAmount != null
          ? productsQuery.data.proYearly.prices[0].priceAmount / 100
          : undefined,
    },
  } as const;

  if (availability.isPending) return <PlanOffersSkeleton />;
  if (availability.isError || !availability.data?.length)
    return <p role="status">{PLAN_OFFERS_UNAVAILABLE}</p>;
  if (visibleTiers.length === 0)
    return (
      <p role="status">
        There are no upgrades available for your plan right now.
      </p>
    );

  return (
    <section
      className="min-w-0"
      aria-labelledby={
        mode === "onboarding"
          ? "onboarding-plan-heading"
          : "plans-upgrade-heading"
      }
    >
      {mode === "onboarding" ? (
        <header className="mb-4">
          <h2
            id="onboarding-plan-heading"
            className="text-xl font-semibold tracking-tight"
          >
            Your △ Agent works around the clock — so you don&apos;t have to.
          </h2>
        </header>
      ) : !hideMarketingHeadline ? (
        <header className="mb-4">
          <h2
            id="plans-upgrade-heading"
            className="text-xl font-semibold tracking-tight"
          >
            Your △ Agent works around the clock — so you don&apos;t have to.
          </h2>
        </header>
      ) : null}

      <BillingPeriodSelector
        periods={periods}
        value={billing}
        onChange={setBilling}
      />

      <div className="mt-4 space-y-3">
        {visibleTiers.map((tier) => (
          <PlanTierCard
            key={tier.id}
            tier={tier}
            billing={billing}
            mode={mode}
            entityPlural={entityPlural}
            amountOverride={
              tier.id === "hobby" || tier.id === "base" || tier.id === "pro"
                ? livePricing[tier.id]?.[billing]
                : undefined
            }
            onUpgradePaid={onUpgradePaid}
            disabled={isStartingCheckout}
          />
        ))}
      </div>
      {productsQuery.isError ? (
        <p className="text-muted-foreground mt-3 text-xs">
          Live pricing is temporarily unavailable. You can still continue or try
          checkout again in a moment.
        </p>
      ) : null}
    </section>
  );
}
