"use client";

import React, { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useAuth } from "@workos-inc/authkit-nextjs/components";

import * as SelectPrimitive from "@radix-ui/react-select";

import { api } from "@/convex/_generated/api";
import {
  getPlansUpgradeHref,
  PLANS_PATH,
} from "@/features/billing/lib/plansUpgradeUrl";
import {
  DEFAULT_WORKSPACE_USE_CASE_KEY,
  isWorkspaceUseCaseKey,
  type WorkspaceUseCaseKey,
} from "@/shared/lib/workspaceUseCases";
import { WORKSPACE_USE_CASE_GROUPS } from "@/shared/lib/workspaceUseCaseGroups";
import {
  getWorkspaceUseCaseLocalStorageServerSnapshot,
  getWorkspaceUseCaseLocalStorageSnapshot,
  persistWorkspaceUseCaseKey,
  subscribeWorkspaceUseCaseLocalStorage,
} from "@/shared/lib/workspaceUseCaseCache";
import { cn } from "@/shared/lib/utils";
import { Button, buttonVariants } from "@/shared/ui/components/Button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/ui/components/Card";
import { Badge } from "@/shared/ui/components/Badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/Select";
import { CheckIcon } from "@/shared/ui/components/icons";
import { BillingPeriodSelector } from "@/features/billing/ui/components/BillingPeriodSelector";
import { PlanOffersSkeleton } from "@/features/billing/ui/components/PlanOffersSkeleton";
import { useAvailablePlanOffers } from "@/features/billing/hooks/useAvailablePlanOffers";
import {
  type PlanOffer,
  getPlanOfferSelection,
  PLAN_OFFERS_UNAVAILABLE,
} from "@/shared/lib/billing/planOfferHelpers";
import { workspaceUseCaseIcons } from "@/shared/ui/components/icons/workspaceUseCaseIconHelpers";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { useQueryWithStatus } from "@/shared/hooks";
import {
  type BillingPeriod,
  type OnboardingPlanTierConfig,
  ONBOARDING_PLAN_TIERS,
  formatPlanPriceLabel,
} from "@/features/agent/ui/components/onboarding/planStepConfig";
import { resolvePricingFeatureCopy } from "@/features/landing/lib/pricingUseCaseCopy";
import { LandingAuthLink } from "@/features/landing/ui/components/LandingAuthLink";
import { SETUP_SIGN_UP_HREF } from "@/shared/lib/urls/authRoutes";

/* -------------------------------------------------------------------------- */
/*  Price display                                                              */
/* -------------------------------------------------------------------------- */

function PriceDisplay({
  tier,
  billing,
}: {
  tier: OnboardingPlanTierConfig;
  billing: BillingPeriod;
}) {
  const amount = tier.pricing[billing].amount;
  if (amount == null) return null;

  const suffix = billing === "monthly" ? "/mo" : "/yr";
  const strike =
    billing === "monthly"
      ? tier.pricing.strikethroughMonthly
      : tier.pricing.strikethroughYearly;

  return (
    <div className="flex flex-wrap items-baseline gap-2" aria-live="polite">
      <AnimatedNumber
        value={amount}
        prefix="$"
        decimals={2}
        format={{ minimumFractionDigits: 2 }}
        suffix={suffix}
        className="text-3xl font-semibold tracking-tight"
      />
      {strike != null && (
        <span
          className="text-muted-foreground font-mono text-sm tabular-nums line-through"
          aria-hidden
        >
          ${strike.toFixed(2)}
          {suffix}
        </span>
      )}
    </div>
  );
}

const PLAN_TIER_TO_PRICING_TIER = {
  free: null,
  hobby: "hobby",
  base: "base",
  pro: "pro",
} as const satisfies Record<string, OnboardingPlanTierConfig["id"] | null>;

const PRICING_TIER_RANK = {
  hobby: 0,
  base: 1,
  pro: 2,
} as const satisfies Record<OnboardingPlanTierConfig["id"], number>;

function getCurrentPricingTierId(
  tier: keyof typeof PLAN_TIER_TO_PRICING_TIER | null | undefined
): OnboardingPlanTierConfig["id"] | null {
  return tier ? PLAN_TIER_TO_PRICING_TIER[tier] : null;
}

/* -------------------------------------------------------------------------- */
/*  Tier card                                                                  */
/* -------------------------------------------------------------------------- */

function TierCard({
  tier,
  billing,
  isAuthenticated,
  currentTierId,
  isCheckingCurrentPlan,
  useCaseKey,
}: {
  tier: OnboardingPlanTierConfig;
  billing: BillingPeriod;
  isAuthenticated: boolean;
  currentTierId: OnboardingPlanTierConfig["id"] | null;
  isCheckingCurrentPlan: boolean;
  useCaseKey: WorkspaceUseCaseKey;
}) {
  const amount = tier.pricing[billing].amount;
  const isCurrentPlan = currentTierId === tier.id;
  const isLowerThanCurrentPlan =
    currentTierId != null &&
    PRICING_TIER_RANK[tier.id] < PRICING_TIER_RANK[currentTierId];
  const ctaHref = isLowerThanCurrentPlan ? PLANS_PATH : getPlansUpgradeHref();

  const priceLabel =
    amount != null ? formatPlanPriceLabel(amount, billing) : null;

  const ctaLabel = (() => {
    if (isLowerThanCurrentPlan) {
      return "Manage plan";
    }

    if (!priceLabel) {
      return "Start";
    }

    // Anonymous visitors are starting out, not upgrading.
    return isAuthenticated ? `Upgrade for ${priceLabel}` : `Start for ${priceLabel}`;
  })();

  const ctaVariant = isLowerThanCurrentPlan ? "outline" : "default";

  const cta = (() => {
    if (isCheckingCurrentPlan) {
      return (
        <Button
          type="button"
          variant={ctaVariant}
          size="default"
          className="w-full"
          disabled
        >
          Checking plan…
        </Button>
      );
    }

    if (isCurrentPlan) {
      return (
        <Button
          type="button"
          variant="secondary"
          size="default"
          className="w-full disabled:opacity-100"
          disabled
          aria-label={`${tier.title} is your current plan`}
        >
          Your current plan
        </Button>
      );
    }

    const ctaClassName = cn(
      buttonVariants({
        variant: ctaVariant,
        size: "default",
      }),
      "w-full"
    );

    if (!isAuthenticated) {
      return (
        <LandingAuthLink href={SETUP_SIGN_UP_HREF} className={ctaClassName}>
          {ctaLabel}
        </LandingAuthLink>
      );
    }

    return (
      <Link href={ctaHref} className={ctaClassName}>
        {ctaLabel}
      </Link>
    );
  })();

  return (
    <Card className="flex min-h-[474px] flex-col rounded-xl shadow-none">
      <CardHeader className="space-y-1 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base font-semibold">
            {tier.title}
          </CardTitle>
          {tier.badge && <Badge variant="outline-strong">{tier.badge}</Badge>}
        </div>
        <CardDescription>{tier.subtitle}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 p-4 pt-0">
        <PriceDisplay tier={tier} billing={billing} />

        {tier.featureLeadIn && (
          <p className="text-foreground text-sm font-medium">
            {tier.featureLeadIn}
          </p>
        )}
        <ul className="space-y-2 text-sm">
          {tier.features.map((feature) => (
            <li key={feature} className="flex gap-2">
              <CheckIcon
                className="text-foreground mt-0.5 size-4 shrink-0 fill-current"
                aria-hidden
              />
              <span>{resolvePricingFeatureCopy(feature, useCaseKey)}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="p-4 pt-0">{cta}</CardFooter>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Custom select item (icon left, check right)                                */
/* -------------------------------------------------------------------------- */

function UseCaseSelectItem({
  value,
  icon: Icon,
  children,
}: {
  value: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  children: React.ReactNode;
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      className="focus:bg-accent focus:text-accent-foreground flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50"
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <SelectPrimitive.ItemText className="flex-1">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="ml-auto">
        <CheckIcon className="size-3.5 shrink-0 fill-current" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

/* -------------------------------------------------------------------------- */
/*  PricingSection                                                             */
/* -------------------------------------------------------------------------- */

export function PricingSection({
  initialUseCaseKey = DEFAULT_WORKSPACE_USE_CASE_KEY,
  initialOffers,
  initialOffersError = false,
}: {
  initialUseCaseKey?: WorkspaceUseCaseKey;
  initialOffers?: PlanOffer[];
  initialOffersError?: boolean;
}) {
  const [preferredBilling, setBilling] = useState<BillingPeriod>("monthly");
  const hasInitialOffers = initialOffers !== undefined;
  const availability = useAvailablePlanOffers(!hasInitialOffers);
  const offers = hasInitialOffers ? initialOffers : availability.data;
  const { billing, periods, tiers } = getPlanOfferSelection(
    offers ?? [],
    preferredBilling
  );
  const visibleTiers = ONBOARDING_PLAN_TIERS.filter((tier) =>
    tiers.includes(tier.id)
  );
  const persistedUseCaseKey = useSyncExternalStore(
    subscribeWorkspaceUseCaseLocalStorage,
    getWorkspaceUseCaseLocalStorageSnapshot,
    getWorkspaceUseCaseLocalStorageServerSnapshot
  );
  const { user, loading: authLoading } = useAuth();
  const isAuthenticated = Boolean(user);
  const planQuery = useQueryWithStatus(
    api.plans.getCurrentPlan,
    isAuthenticated ? {} : "skip"
  );
  const currentPlanTier =
    isAuthenticated && !planQuery.isPending && !planQuery.isError
      ? (planQuery.data?.tier ?? "free")
      : null;
  const currentTierId = getCurrentPricingTierId(currentPlanTier);
  const isCheckingCurrentPlan =
    authLoading || (isAuthenticated && planQuery.isPending);
  const selectedUseCaseKey = persistedUseCaseKey ?? initialUseCaseKey;

  return (
    <section aria-labelledby="pricing-heading" className="px-4 py-16 md:py-24">
      {/* Heading */}
      <header className="mb-12 text-center md:mb-16">
        <h1
          id="pricing-heading"
          className="text-5xl leading-[1.1] font-normal tracking-[-0.03em] text-balance md:text-6xl"
        >
          Pricing.
        </h1>
      </header>

      {/* Use-case selector */}
      <div className="mb-4 flex justify-center md:mb-6">
        <Select
          value={selectedUseCaseKey}
          onValueChange={(value) => {
            if (!isWorkspaceUseCaseKey(value)) return;
            persistWorkspaceUseCaseKey(value);
          }}
        >
          <SelectTrigger
            aria-label="Select use case"
            size="xs"
            className="w-auto shadow-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1.5 text-sm font-medium">
              I want to reach…
            </div>
            <SelectSeparator />
            {WORKSPACE_USE_CASE_GROUPS.map((group, groupIndex) => (
              <React.Fragment key={group.categoryLabel}>
                {groupIndex > 0 && <SelectSeparator />}
                <SelectGroup>
                  <SelectLabel className="text-muted-foreground pl-2 text-xs font-normal">
                    {group.categoryLabel}
                  </SelectLabel>
                  {group.items.map((item) => (
                    <UseCaseSelectItem
                      key={item.key}
                      value={item.key}
                      icon={workspaceUseCaseIcons[item.key]}
                    >
                      {item.title}
                    </UseCaseSelectItem>
                  ))}
                </SelectGroup>
              </React.Fragment>
            ))}
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel className="text-muted-foreground pl-2 text-xs font-normal">
                For anything else
              </SelectLabel>
              <UseCaseSelectItem
                value="general_outreach"
                icon={workspaceUseCaseIcons.general_outreach}
              >
                Other
              </UseCaseSelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Billing toggle */}
      <div className="mx-auto mb-8 max-w-xs md:mb-10">
        <BillingPeriodSelector
          periods={periods}
          value={billing}
          onChange={setBilling}
        />
      </div>

      {/* Tier cards */}
      {!hasInitialOffers && availability.isPending ? (
        <PlanOffersSkeleton />
      ) : (hasInitialOffers ? initialOffersError : availability.isError) ||
        !visibleTiers.length ? (
        <p role="status" className="text-muted-foreground text-center">
          {PLAN_OFFERS_UNAVAILABLE}
        </p>
      ) : (
        <div
          className={cn(
            "mx-auto grid grid-cols-1 gap-4",
            visibleTiers.length === 1
              ? "max-w-lg"
              : visibleTiers.length === 2
                ? "max-w-4xl md:grid-cols-2"
                : "md:grid-cols-3"
          )}
        >
          {visibleTiers.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              billing={billing}
              isAuthenticated={isAuthenticated}
              currentTierId={currentTierId}
              isCheckingCurrentPlan={isCheckingCurrentPlan}
              useCaseKey={selectedUseCaseKey}
            />
          ))}
        </div>
      )}

      <p className="text-foreground mt-6 text-center text-sm">
        Every plan comes with a 30-day money-back guarantee.
      </p>
      <p className="text-muted-foreground mt-2 text-center text-sm">
        Self-hosting is free. The social data isn't: X/Twitter and other APIs
        bill per use, and on a hosted plan that cost and the upkeep are on us.
      </p>
    </section>
  );
}
