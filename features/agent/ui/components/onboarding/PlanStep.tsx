"use client";

import { useState } from "react";
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
} from "./planStepConfig";

export interface PlanStepProps {
  onSelectFree: () => void | Promise<void>;
  onUpgradePaid: (selection: {
    tier: "base" | "pro";
    billing: BillingPeriod;
  }) => void;
  isStartingCheckout?: boolean;
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
}) {
  const monthlyAmount = tier.pricing.monthly.amount;
  const yearlyAmount = tier.pricing.yearly.amount;
  const amountForCta =
    amountOverride ?? (billing === "monthly" ? monthlyAmount : yearlyAmount);

  return (
    <Card>
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
      <CardContent className="space-y-4 p-4 pt-0">
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

function PlanCardsStack({
  billing,
  onSelectFree,
  onUpgradePaid,
  livePricing,
  disabled,
  tiers,
}: {
  billing: BillingPeriod;
  onSelectFree: () => void | Promise<void>;
  onUpgradePaid: (selection: {
    tier: "base" | "pro";
    billing: BillingPeriod;
  }) => void;
  livePricing: Partial<
    Record<"base" | "pro", Partial<Record<BillingPeriod, number>>>
  >;
  disabled?: boolean;
  tiers: typeof ONBOARDING_PLAN_TIERS;
}) {
  return (
    <div className="space-y-3">
      {tiers.map((tier) => (
        <PlanTierCard
          key={tier.id}
          tier={tier}
          billing={billing}
          amountOverride={
            tier.id === "base" || tier.id === "pro"
              ? livePricing[tier.id]?.[billing]
              : undefined
          }
          onSelectFree={onSelectFree}
          onUpgradePaid={onUpgradePaid}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

export function PlanStep({
  onSelectFree,
  onUpgradePaid,
  isStartingCheckout = false,
}: PlanStepProps) {
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const currentPlanQuery = useQueryWithStatus(api.plans.getCurrentPlan);
  const planTier = currentPlanQuery.data?.tier ?? "free";
  const visiblePlanTiers =
    planTier === "base"
      ? ONBOARDING_PLAN_TIERS.filter((t) => t.id === "pro")
      : ONBOARDING_PLAN_TIERS;
  const productsQuery = useQueryWithStatus(api.polar.getConfiguredProducts);
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

  return (
    <section className="min-w-0" aria-labelledby="onboarding-plan-heading">
      <header className="mb-4">
        <h2
          id="onboarding-plan-heading"
          className="text-xl font-semibold tracking-tight"
        >
          Your ∆ Agent works around the clock — so you don&apos;t have to.
        </h2>
      </header>

      {/*
        Single pricing stack + controlled billing state so AnimatedNumber stays mounted
        and animates when switching Monthly/Yearly. Two TabsContent panels each mounted
        their own numbers, so values never transitioned on the same instance.
      */}
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

      <div className="mt-4">
        <PlanCardsStack
          billing={billing}
          onSelectFree={onSelectFree}
          onUpgradePaid={onUpgradePaid}
          livePricing={livePricing}
          disabled={isStartingCheckout}
          tiers={visiblePlanTiers}
        />
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
