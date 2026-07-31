/**
 * DemoPlansPage
 * Faithful replica of the real plans route (app/(webapp)/plans/page.tsx ->
 * features/billing/ui/PlansPage.tsx) running on static data. Reuses the real
 * ActivePlanSection, SubscriptionHistorySection, and BillingSection as-is
 * (they are prop-driven). The PlanSelector is replicated presentational-only
 * because the real one fires a Convex pricing query on mount; the replicated
 * version uses the static ONBOARDING_PLAN_TIERS pricing and a local billing
 * period toggle. Upgrade/manage-billing actions are no-ops.
 */
"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { ActivePlanSection } from "@/features/billing/ui/components/ActivePlanSection";
import { BillingSection } from "@/features/billing/ui/components/BillingSection";
import { SubscriptionHistorySection } from "@/features/billing/ui/components/SubscriptionHistorySection";
import type { HistoryRow } from "@/features/billing/ui/components/SubscriptionHistorySection";
import {
  type BillingPeriod,
  type OnboardingPlanTierConfig,
  ONBOARDING_PLAN_TIERS,
  formatPlanPriceLabel,
} from "@/features/agent/ui/components/onboarding/planStepConfig";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import { cn } from "@/shared/lib/utils";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { Badge } from "@/shared/ui/components/Badge";
import { Button } from "@/shared/ui/components/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/Card";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/components/Tabs";
import { ArrowBackIcon } from "@/shared/ui/components/icons";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";

// ---------------------------------------------------------------------------
// Static demo data (Base plan, monthly, active)
// ---------------------------------------------------------------------------

const DEMO_TIER = "base" as const;
const DEMO_RENEWS_AT = Date.UTC(2026, 8, 15); // Sep 15, 2026

const DEMO_PLAN = { tier: DEMO_TIER };
const DEMO_SUBSCRIPTION = {
  recurringInterval: "month",
  currentPeriodEnd: DEMO_RENEWS_AT,
  cancelAtPeriodEnd: false,
};

const DEMO_HISTORY_ROWS: HistoryRow[] = [
  {
    id: "demo-invoice-3",
    planLabel: "Base",
    totalAmount: 4999,
    currency: "usd",
    billingReason: "subscription_cycle",
    status: "paid",
    createdAt: Date.UTC(2026, 7, 15, 9, 0, 0),
  },
  {
    id: "demo-invoice-2",
    planLabel: "Base",
    totalAmount: 4999,
    currency: "usd",
    billingReason: "subscription_cycle",
    status: "paid",
    createdAt: Date.UTC(2026, 6, 15, 9, 0, 0),
  },
  {
    id: "demo-invoice-1",
    planLabel: "Base",
    totalAmount: 4999,
    currency: "usd",
    billingReason: "subscription_create",
    status: "paid",
    createdAt: Date.UTC(2026, 5, 15, 9, 0, 0),
  },
];

// ---------------------------------------------------------------------------
// PlanSelector replica (features/billing/ui/components/PlanSelector.tsx)
// Replicated because the real component fires api.polar.getConfiguredProducts
// on mount. JSX, classes, and copy are copied verbatim; pricing comes from the
// static ONBOARDING_PLAN_TIERS config (same fallback the real component uses).
// ---------------------------------------------------------------------------

function PlanPriceBlock({
  tier,
  billing,
}: {
  tier: OnboardingPlanTierConfig;
  billing: BillingPeriod;
}) {
  const periodKey = billing === "monthly" ? "monthly" : "yearly";
  const amount = tier.pricing[periodKey].amount;
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
  onUpgradePaid,
}: {
  tier: OnboardingPlanTierConfig;
  billing: BillingPeriod;
  onUpgradePaid: (selection: {
    tier: "hobby" | "base" | "pro";
    billing: BillingPeriod;
  }) => void;
}) {
  const monthlyAmount = tier.pricing.monthly.amount;
  const yearlyAmount = tier.pricing.yearly.amount;
  const amountForCta = billing === "monthly" ? monthlyAmount : yearlyAmount;

  return (
    <Card className="shadow-none">
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
      <CardContent className="space-y-3 p-4 pt-0">
        <PlanPriceBlock tier={tier} billing={billing} />

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

        <Button
          type="button"
          size="xs"
          className="w-full"
          disabled={amountForCta == null}
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

function DemoPlanSelector({
  currentTier,
  onUpgradePaid,
}: {
  currentTier: "free" | "hobby" | "base" | "pro";
  onUpgradePaid: (selection: {
    tier: "hobby" | "base" | "pro";
    billing: BillingPeriod;
  }) => void;
}) {
  const [billing, setBilling] = React.useState<BillingPeriod>("monthly");

  // visibleTiersForMode("plans", currentTier) from the real PlanSelector.
  const visibleTiers = React.useMemo(() => {
    if (currentTier === "free") {
      return ONBOARDING_PLAN_TIERS;
    }
    if (currentTier === "hobby") {
      return ONBOARDING_PLAN_TIERS.filter(
        (t) => t.id === "base" || t.id === "pro"
      );
    }
    if (currentTier === "base") {
      return ONBOARDING_PLAN_TIERS.filter((t) => t.id === "pro");
    }
    return [];
  }, [currentTier]);

  if (visibleTiers.length === 0) {
    return null;
  }

  return (
    <section className="min-w-0" aria-labelledby="plans-upgrade-heading">
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
          <TabsTrigger
            value="yearly"
            size="sm"
            className="group flex-1 gap-1.5"
          >
            Yearly
            <Badge
              variant="outline-strong"
              className="border-muted-foreground text-muted-foreground group-data-[state=active]:border-foreground group-data-[state=active]:text-foreground"
            >
              2 months free
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 space-y-3">
        {visibleTiers.map((tier) => (
          <PlanTierCard
            key={tier.id}
            tier={tier}
            billing={billing}
            onUpgradePaid={onUpgradePaid}
          />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// DemoPlansPage (replica of features/billing/ui/PlansPage.tsx)
// ---------------------------------------------------------------------------

export function DemoPlansPage() {
  const isMobile = useIsMobile();
  const [upgradeOpen, setUpgradeOpen] = React.useState(false);

  const openUpgradePanel = React.useCallback(() => setUpgradeOpen(true), []);
  const closeUpgradePanel = React.useCallback(() => setUpgradeOpen(false), []);
  const noop = React.useCallback(() => {}, []);

  const upgradePanelContent = (
    <div className="scroll-fade min-h-0 flex-1 overflow-y-auto p-4">
      <header className="mb-4">
        <h2
          id="plans-upgrade-heading"
          className="text-xl font-semibold tracking-tight"
        >
          Your △ Agent works around the clock, so you don&apos;t have to.
        </h2>
      </header>
      <DemoPlanSelector currentTier={DEMO_TIER} onUpgradePaid={noop} />
    </div>
  );

  const mainColumn = (
    <PageLayout
      className={cn(
        "flex min-h-0 max-w-none flex-1 flex-col overflow-hidden border-none",
        upgradeOpen && !isMobile && "md:min-w-0 md:flex-1 md:basis-0"
      )}
    >
      <PageHeader title="Plans" />
      <PageContent className="scroll-fade min-h-0 flex-1 overflow-y-auto p-0">
        <div className="flex h-full min-h-0 w-full flex-col">
          <ActivePlanSection
            plan={DEMO_PLAN}
            subscription={DEMO_SUBSCRIPTION}
            isPaid={true}
            onUpgrade={openUpgradePanel}
            onUpgradeToPro={openUpgradePanel}
            onManageBilling={noop}
          />
          <SubscriptionHistorySection
            rows={DEMO_HISTORY_ROWS}
            page={0}
            totalPages={1}
            pageSize={5}
            onPageSizeChange={noop}
            onPageChange={noop}
            onOpenPortal={noop}
          />
          <BillingSection onManageBilling={noop} />
        </div>
      </PageContent>
    </PageLayout>
  );

  const upgradePanel = upgradeOpen ? (
    <>
      {!isMobile ? (
        <aside
          className="bg-background flex h-full min-h-0 w-full flex-col overflow-hidden md:max-w-lg md:min-w-0 md:flex-1 md:basis-0 md:border-l"
          aria-label="Upgrade plans"
        >
          <div className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
            <Button
              type="button"
              variant="ghost"
              size="xsIcon"
              onClick={closeUpgradePanel}
              aria-label="Close upgrade panel"
            >
              <ArrowBackIcon className="fill-current" />
            </Button>
            <span className="text-sm font-medium">Upgrade</span>
          </div>
          {upgradePanelContent}
        </aside>
      ) : (
        <div
          className="bg-background fixed inset-0 z-50 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Upgrade plans"
        >
          <div className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
            <Button
              type="button"
              variant="ghost"
              size="xsIcon"
              onClick={closeUpgradePanel}
              aria-label="Close upgrade panel"
            >
              <X className="size-4" />
            </Button>
            <span className="text-sm font-medium">Upgrade</span>
          </div>
          {upgradePanelContent}
        </div>
      )}
    </>
  ) : null;

  if (upgradeOpen) {
    return (
      <div
        className={cn(
          "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col md:flex-row md:items-stretch",
          isMobile && "relative"
        )}
      >
        {mainColumn}
        {upgradePanel}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
      {mainColumn}
    </div>
  );
}
