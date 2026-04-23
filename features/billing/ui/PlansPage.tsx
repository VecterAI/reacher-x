"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import { useQueryWithStatus } from "@/shared/hooks";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import { toast } from "sonner";
import { ActivePlanSection } from "./components/ActivePlanSection";
import { UsageSection } from "./components/UsageSection";
import { SubscriptionHistorySection } from "./components/SubscriptionHistorySection";
import type { HistoryRow } from "./components/SubscriptionHistorySection";
import { BillingSection } from "./components/BillingSection";
import { PlanSelector } from "./components/PlanSelector";
import { Button } from "@/shared/ui/components/Button";
import { cn } from "@/shared/lib/utils";
import { X } from "lucide-react";
import { ArrowBackIcon } from "@/shared/ui/components/icons";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { PLANS_UPGRADE_VALUE } from "@/features/billing/lib/plansUpgradeUrl";

export function PlansPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [upgradeParam, setUpgradeParam] = useQueryState(
    "upgrade",
    parseAsStringLiteral([PLANS_UPGRADE_VALUE])
  );
  const [selectedCycleId, setSelectedCycleId] = React.useState<
    Id<"planUsageCycles"> | undefined
  >(undefined);
  const [historyPage, setHistoryPage] = React.useState(0);
  const [historyPageSize, setHistoryPageSize] = React.useState(5);
  const [historyRows, setHistoryRows] = React.useState<HistoryRow[]>([]);
  const [historyTotalPages, setHistoryTotalPages] = React.useState(0);
  const [historyLoading, setHistoryLoading] = React.useState(false);

  const ensureUsageCycles = useMutation(api.planUsage.ensureUsageCycles);
  const startCheckoutFlow = useAction(api.billing.startCheckoutFlow);
  const startCustomerPortalFlow = useAction(
    api.billing.startCustomerPortalFlow
  );
  const listSubscriptionHistory = useAction(
    api.billing.listSubscriptionHistory
  );

  const planQuery = useQueryWithStatus(api.plans.getCurrentPlan);
  const subscriptionQuery = useQueryWithStatus(api.polar.getSubscription);
  const usageQuery = useQueryWithStatus(
    api.planUsage.getUsageCyclesForPlansPage,
    {
      selectedCycleId,
    }
  );

  React.useEffect(() => {
    void ensureUsageCycles().catch(() => {
      /* ignore */
    });
  }, [ensureUsageCycles]);

  const plan = planQuery.data;
  const subscription = subscriptionQuery.data;
  const tier = plan?.tier ?? "free";
  const isPaid = tier !== "free";

  const showUpgradePanel = tier !== "pro";
  const upgradeOpen = showUpgradePanel && upgradeParam === PLANS_UPGRADE_VALUE;

  React.useEffect(() => {
    if (!showUpgradePanel && upgradeParam === PLANS_UPGRADE_VALUE) {
      void setUpgradeParam(null);
    }
  }, [showUpgradePanel, upgradeParam, setUpgradeParam]);
  const shouldFetchHistory = isPaid && Boolean(plan?.polarCustomerId);
  const showHistoryPanel =
    shouldFetchHistory &&
    (historyLoading || historyRows.length > 0 || historyTotalPages > 0);

  React.useEffect(() => {
    if (!shouldFetchHistory) {
      setHistoryRows([]);
      setHistoryTotalPages(0);
      setHistoryLoading(false);
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);
    void listSubscriptionHistory({
      page: historyPage + 1,
      limit: historyPageSize,
    })
      .then((data) => {
        if (cancelled) return;
        setHistoryRows(data.rows);
        setHistoryTotalPages(data.totalPages);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Could not load subscription history.");
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    historyPage,
    historyPageSize,
    listSubscriptionHistory,
    shouldFetchHistory,
  ]);

  const startCheckout = React.useCallback(
    async (selection: {
      tier: "base" | "pro";
      billing: "monthly" | "yearly";
    }) => {
      if (typeof window === "undefined") return;
      try {
        const { url } = await startCheckoutFlow({
          tier: selection.tier,
          billingPeriod: selection.billing,
          source: "plans_page_upgrade",
          origin: window.location.origin,
          returnTo: "/plans",
        });
        window.location.assign(url);
      } catch (error) {
        toast.error("Could not start checkout", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      }
    },
    [startCheckoutFlow]
  );

  const openPortal = React.useCallback(async () => {
    try {
      const { url } = await startCustomerPortalFlow({});
      window.location.assign(url);
    } catch (error) {
      toast.error("Could not open billing portal", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  }, [startCustomerPortalFlow]);

  const usage = usageQuery.data;
  const upgradePanelContent = (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <header className="mb-4">
        <h2
          id="plans-upgrade-heading"
          className="text-xl font-semibold tracking-tight"
        >
          Your ∆ Agent works around the clock — so you don&apos;t have to.
        </h2>
      </header>
      <PlanSelector
        mode="plans"
        currentTier={tier}
        hideMarketingHeadline
        onSelectFree={async () => {
          void setUpgradeParam(null);
        }}
        onUpgradePaid={(selection) => startCheckout(selection)}
      />
    </div>
  );

  const mainColumn = (
    <PageLayout
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        upgradeOpen &&
          !isMobile &&
          "md:min-w-0 md:flex-1 md:basis-0 md:border-r"
      )}
    >
      <PageHeader title="Plans" onBack={() => router.back()} />
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-0">
        <div className="flex h-full min-h-0 w-full flex-col">
          <ActivePlanSection
            plan={plan}
            subscription={subscription}
            isPaid={isPaid}
            onUpgrade={() => void setUpgradeParam(PLANS_UPGRADE_VALUE)}
            onUpgradeToPro={() => void setUpgradeParam(PLANS_UPGRADE_VALUE)}
            onManageBilling={openPortal}
          />

          <UsageSection
            resetLabel={usage?.resetLabel ?? "--"}
            cycleOptions={usage?.cycleOptions ?? []}
            selectedCycleId={usage?.selectedCycleId}
            onCycleChange={(id) => setSelectedCycleId(id)}
            prospects={
              usage?.prospects ?? {
                used: 0,
                limit: 100,
                unlimited: false,
                percentUsed: 0,
              }
            }
            workspaces={
              usage?.workspaces ?? {
                used: 0,
                limit: 1,
                percentUsed: 0,
              }
            }
            isLoading={usageQuery.isPending || !usage}
          />

          {showHistoryPanel ? (
            historyLoading && historyRows.length === 0 ? (
              <p className="text-muted-foreground border-b px-4 py-4 text-xs">
                Loading history…
              </p>
            ) : historyTotalPages > 0 || historyRows.length > 0 ? (
              <SubscriptionHistorySection
                rows={historyRows}
                page={historyPage}
                totalPages={historyTotalPages}
                pageSize={historyPageSize}
                onPageSizeChange={(n) => {
                  setHistoryPageSize(n);
                  setHistoryPage(0);
                }}
                onPageChange={(nextPage) => setHistoryPage(nextPage)}
                onOpenPortal={openPortal}
              />
            ) : null
          ) : null}

          {isPaid ? <BillingSection onManageBilling={openPortal} /> : null}
        </div>
      </PageContent>
    </PageLayout>
  );

  const upgradePanel = showUpgradePanel && upgradeOpen && (
    <>
      {!isMobile ? (
        <aside
          className="bg-background flex h-full min-h-0 w-full flex-col overflow-hidden md:max-w-lg md:min-w-0 md:flex-1 md:basis-0 md:border-r"
          aria-label="Upgrade plans"
        >
          <div className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
            <Button
              type="button"
              variant="ghost"
              size="xsIcon"
              onClick={() => void setUpgradeParam(null)}
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
              onClick={() => void setUpgradeParam(null)}
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
  );

  if (showUpgradePanel && upgradeOpen) {
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
