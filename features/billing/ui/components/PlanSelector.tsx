"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/components/Tabs";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import {
  type BillingPeriod,
  type OnboardingPlanTierConfig,
  ONBOARDING_PLAN_TIERS,
  formatPlanPriceLabel,
} from "@/features/agent/ui/components/onboarding/planStepConfig";

export type PlanSelectorMode = "onboarding" | "plans";

export interface PlanSelectorProps {
  mode: PlanSelectorMode;
  currentTier: "free" | "base" | "pro";
  onSelectFree: () => void | Promise<void>;
  onUpgradePaid: (selection: {
    tier: "base" | "pro";
    billing: BillingPeriod;
  }) => void;
  isStartingCheckout?: boolean;
  /** Omit the marketing headline when the parent already provides a title (e.g. upgrade panel). */
  hideMarketingHeadline?: boolean;
}

function visibleTiersForMode(
  mode: PlanSelectorMode,
  currentTier: "free" | "base" | "pro"
): typeof ONBOARDING_PLAN_TIERS {
  if (mode === "onboarding") {
    return currentTier === "base"
      ? ONBOARDING_PLAN_TIERS.filter((t) => t.id === "pro")
      : ONBOARDING_PLAN_TIERS;
  }
  if (currentTier === "free") {
    return ONBOARDING_PLAN_TIERS.filter(
      (t) => t.id === "base" || t.id === "pro"
    );
  }
  if (currentTier === "base") {
    return ONBOARDING_PLAN_TIERS.filter((t) => t.id === "pro");
  }
  return [];
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
  if (tier.id === "hobby") {
    return (
      <p className="text-2xl font-semibold tracking-tight" aria-live="polite">
        Free
      </p>
    );
  }

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
  onSelectFree,
  onUpgradePaid,
  disabled,
  mode,
}: {
  tier: OnboardingPlanTierConfig;
  billing: BillingPeriod;
  amountOverride?: number | null;
  onSelectFree: () => void | Promise<void>;
  onUpgradePaid: (selection: {
    tier: "base" | "pro";
    billing: BillingPeriod;
  }) => void;
  disabled?: boolean;
  mode: PlanSelectorMode;
}) {
  const monthlyAmount = tier.pricing.monthly.amount;
  const yearlyAmount = tier.pricing.yearly.amount;
  const amountForCta =
    amountOverride ?? (billing === "monthly" ? monthlyAmount : yearlyAmount);
  const isPlansMode = mode === "plans";

  return (
    <Card className={isPlansMode ? "shadow-none" : undefined}>
      <CardHeader className="space-y-1 p-4 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base font-semibold">
            {tier.title}
          </CardTitle>
          {tier.badge ? (
            <Badge variant="outline" className="text-xs font-normal">
              {tier.badge}
            </Badge>
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
          {tier.features.map((line) => (
            <li key={line} className="flex gap-2">
              <Check
                className="text-foreground mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        {tier.id === "hobby" ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="w-full"
            disabled={disabled}
            onClick={() => void onSelectFree()}
          >
            Start for free — no credit card needed
          </Button>
        ) : (
          <Button
            type="button"
            size="xs"
            className="w-full"
            disabled={amountForCta == null || disabled}
            onClick={() =>
              onUpgradePaid({
                tier: tier.id === "base" ? "base" : "pro",
                billing,
              })
            }
          >
            {amountForCta != null
              ? `Upgrade for ${formatPlanPriceLabel(amountForCta, billing)}`
              : "Upgrade"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function PlanSelector({
  mode,
  currentTier,
  onSelectFree,
  onUpgradePaid,
  isStartingCheckout = false,
  hideMarketingHeadline = false,
}: PlanSelectorProps) {
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const productsQuery = useQueryWithStatus(api.polar.getConfiguredProducts);
  const visibleTiers = useMemo(
    () => visibleTiersForMode(mode, currentTier),
    [mode, currentTier]
  );

  const livePricing = {
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

  if (visibleTiers.length === 0) {
    return null;
  }

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

      <Tabs
        value={billing}
        onValueChange={(v) => {
          if (v === "monthly" || v === "yearly") {
            setBilling(v);
          }
        }}
        className="w-full"
      >
        <TabsList size="sm" className="flex w-full">
          <TabsTrigger value="monthly" size="sm" className="flex-1">
            Monthly
          </TabsTrigger>
          <TabsTrigger value="yearly" size="sm" className="flex-1">
            Yearly · Save 20%
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 space-y-3">
        {visibleTiers.map((tier) => (
          <PlanTierCard
            key={tier.id}
            tier={tier}
            billing={billing}
            mode={mode}
            amountOverride={
              tier.id === "base" || tier.id === "pro"
                ? livePricing[tier.id]?.[billing]
                : undefined
            }
            onSelectFree={onSelectFree}
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
