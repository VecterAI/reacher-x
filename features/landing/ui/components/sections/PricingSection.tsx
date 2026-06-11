"use client";

import React, { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { Check } from "lucide-react";

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
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/components/Tabs";
import {
  LeadsCustomersUsersIcon,
  PartnershipsIcon,
  InvestorsIcon,
  CandidatesIcon,
  CommunityMembersIcon,
  CreatorsIcon,
  PodcastGuestsIcon,
  ResearchParticipantsIcon,
} from "@/features/agent/ui/components/onboarding/use-case-illustrations/icons";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { useQueryWithStatus } from "@/shared/hooks";
import {
  type BillingPeriod,
  type OnboardingPlanTierConfig,
  ONBOARDING_PLAN_TIERS,
  formatPlanPriceLabel,
} from "@/features/agent/ui/components/onboarding/planStepConfig";
import { resolvePricingFeatureCopy } from "@/features/landing/lib/pricingUseCaseCopy";

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
  if (tier.id === "hobby") {
    return (
      <p className="text-3xl font-semibold tracking-tight" aria-live="polite">
        Free
      </p>
    );
  }

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
  free: "hobby",
  base: "base",
  pro: "pro",
} as const satisfies Record<string, OnboardingPlanTierConfig["id"]>;

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
  const ctaHref = !isAuthenticated
    ? "/login"
    : tier.id === "hobby" || isLowerThanCurrentPlan
      ? PLANS_PATH
      : getPlansUpgradeHref();

  const ctaLabel = (() => {
    if (tier.id === "hobby") {
      return isAuthenticated
        ? "Manage plan"
        : "Start for free \u2014 no credit card needed";
    }

    if (isLowerThanCurrentPlan) {
      return "Manage plan";
    }

    return amount != null
      ? `Upgrade for ${formatPlanPriceLabel(amount, billing)}`
      : "Upgrade";
  })();

  const ctaVariant =
    tier.id === "hobby" || isLowerThanCurrentPlan ? "outline" : "default";

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

    return (
      <Link
        href={ctaHref}
        className={cn(
          buttonVariants({
            variant: ctaVariant,
            size: "default",
          }),
          "w-full"
        )}
      >
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
              <Check
                className="text-foreground mt-0.5 size-4 shrink-0"
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

const useCaseIconByKey: Record<
  WorkspaceUseCaseKey,
  React.FC<React.SVGProps<SVGSVGElement>>
> = {
  customer_prospecting: LeadsCustomersUsersIcon,
  recruiting: CandidatesIcon,
  partnership_outreach: PartnershipsIcon,
  investor_outreach: InvestorsIcon,
  user_research_recruitment: ResearchParticipantsIcon,
  creator_outreach: CreatorsIcon,
  community_growth: CommunityMembersIcon,
  podcast_speaker_sourcing: PodcastGuestsIcon,
};

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
}: {
  initialUseCaseKey?: WorkspaceUseCaseKey;
}) {
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const persistedUseCaseKey = useSyncExternalStore(
    subscribeWorkspaceUseCaseLocalStorage,
    getWorkspaceUseCaseLocalStorageSnapshot,
    getWorkspaceUseCaseLocalStorageServerSnapshot
  );
  const { user } = useAuth();
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
  const isCheckingCurrentPlan = isAuthenticated && planQuery.isPending;
  const selectedUseCaseKey = persistedUseCaseKey ?? initialUseCaseKey;

  return (
    <section aria-labelledby="pricing-heading" className="px-4 py-16 md:py-24">
      {/* Heading */}
      <header className="mb-12 text-center md:mb-16">
        <h1
          id="pricing-heading"
          className="font-pixel-square text-5xl font-bold tracking-tight md:text-6xl"
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
                      icon={useCaseIconByKey[item.key]}
                    >
                      {item.title}
                    </UseCaseSelectItem>
                  ))}
                </SelectGroup>
              </React.Fragment>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Billing toggle */}
      <div className="mx-auto mb-8 max-w-xs md:mb-10">
        <Tabs
          value={billing}
          onValueChange={(v) => {
            if (v === "monthly" || v === "yearly") setBilling(v);
          }}
          className="w-full"
        >
          <TabsList className="flex w-full">
            <TabsTrigger value="monthly" className="flex-1">
              Monthly
            </TabsTrigger>
            <TabsTrigger value="yearly" className="group flex-1 gap-1.5">
              Yearly
              <Badge
                variant="outline-strong"
                className="border-muted-foreground text-muted-foreground group-data-[state=active]:border-foreground group-data-[state=active]:text-foreground"
              >
                Save 20%
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {ONBOARDING_PLAN_TIERS.map((tier) => (
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
    </section>
  );
}
