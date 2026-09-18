/** Fictional billing history; available upgrades use the live public offer configuration. */
"use client";

import * as React from "react";
import { useDemoShell } from "../demoShellContext";
import { ActivePlanSection } from "@/features/billing/ui/components/ActivePlanSection";
import { BillingSection } from "@/features/billing/ui/components/BillingSection";
import { SubscriptionHistorySection } from "@/features/billing/ui/components/SubscriptionHistorySection";
import type { HistoryRow } from "@/features/billing/ui/components/SubscriptionHistorySection";
import { useAvailablePlanOffers } from "@/features/billing/hooks/useAvailablePlanOffers";
import { PlanOffersSkeleton } from "@/features/billing/ui/components/PlanOffersSkeleton";
import { PLAN_OFFERS_UNAVAILABLE } from "@/shared/lib/billing/planOfferHelpers";
import { ONBOARDING_PLAN_TIERS } from "@/features/agent/ui/components/onboarding/planStepConfig";
import { PlanSelector } from "@/features/billing/ui/components/PlanSelector";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import { ArrowBackIcon, CloseIcon } from "@/shared/ui/components/icons";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import { getUpgradeOffers } from "@/shared/lib/billing/planOfferHelpers";

// Example billing dates; the plan and billing period follow current availability.
const DEMO_RENEWS_AT = Date.UTC(2026, 9, 15);

// ---------------------------------------------------------------------------
// DemoPlansPage (replica of features/billing/ui/PlansPage.tsx)
// ---------------------------------------------------------------------------

export function DemoPlansPage() {
  const { labels } = useDemoShell();
  const isMobile = useIsMobile();
  const [upgradeOpen, setUpgradeOpen] = React.useState(false);
  const availability = useAvailablePlanOffers();
  const offer = availability.data?.[0];
  const hasUpgradeOffer = offer
    ? getUpgradeOffers(availability.data ?? [], offer.tier).length > 0
    : undefined;
  const tierConfig = ONBOARDING_PLAN_TIERS.find(
    (tier) => tier.id === offer?.tier
  );
  const demoPlan = { tier: offer?.tier ?? ("free" as const) };
  const demoSubscription = {
    recurringInterval: offer?.billingPeriod === "yearly" ? "year" : "month",
    currentPeriodEnd: DEMO_RENEWS_AT,
    cancelAtPeriodEnd: false,
  };
  const historyRows: HistoryRow[] =
    offer && tierConfig
      ? [
          {
            id: "demo-invoice",
            planLabel: tierConfig.title,
            totalAmount: Math.round(
              (tierConfig.pricing[offer.billingPeriod].amount ?? 0) * 100
            ),
            currency: "usd",
            billingReason: "subscription_create",
            status: "paid",
            createdAt:
              offer.billingPeriod === "yearly"
                ? Date.UTC(2025, 8, 15)
                : Date.UTC(2026, 7, 15),
          },
        ]
      : [];

  const openUpgradePanel = React.useCallback(() => setUpgradeOpen(true), []);
  const closeUpgradePanel = React.useCallback(() => setUpgradeOpen(false), []);
  const noop = React.useCallback(() => {}, []);

  if (availability.isPending) return <PlanOffersSkeleton />;
  if (availability.isError || !offer)
    return <p role="status">{PLAN_OFFERS_UNAVAILABLE}</p>;

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
      <PlanSelector
        mode="plans"
        hideMarketingHeadline
        currentTier={offer.tier}
        entityPlural={labels.entityPlural}
        onUpgradePaid={noop}
      />
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
            entityPlural={labels.entityPlural}
            plan={demoPlan}
            subscription={demoSubscription}
            isPaid={true}
            onUpgrade={openUpgradePanel}
            onUpgradeToPro={openUpgradePanel}
            onManageBilling={noop}
            hasUpgradeOffer={hasUpgradeOffer}
          />
          <SubscriptionHistorySection
            rows={historyRows}
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
              <CloseIcon className="size-4 fill-current" />
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
