import { addMonths, format, startOfMonth, subMonths } from "date-fns";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { PLAN_LIMITS } from "@/convex/lib/planConstants";
import {
  buildUsageTrendPoints,
  createUsageCycleKey,
  formatUsageCycleLabel,
  sortUsageWorkspaceRows,
} from "@/convex/lib/usageDashboardCore";
import {
  getCalendarDaysUntil,
  getCurrentUTCTimestamp,
} from "@/shared/lib/utils/time/timeUtils";
import { ONBOARDING_PLAN_TIERS } from "@/features/agent/ui/components/onboarding/planStepConfig";
import type { createAppFixtures } from "./appFixtures";
import type { LocalClient } from "./LocalClient";

export function registerAccountServices(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>
) {
  const now = getCurrentUTCTimestamp();
  const currentStart = startOfMonth(now);
  const cycles = [0, 1, 2].map((offset) => ({
    cycleStart: +subMonths(currentStart, offset),
    cycleEnd: +addMonths(currentStart, 1 - offset),
  }));
  const limits = PLAN_LIMITS.pro;
  const usage = ({
    selectedCycleKey,
  }: FunctionArgs<typeof api.usage.getUsageDashboardSnapshot>): NonNullable<
    FunctionReturnType<typeof api.usage.getUsageDashboard>
  > => {
    const cycle =
      cycles.find((item) => createUsageCycleKey(item) === selectedCycleKey) ??
      cycles[0];
    const workspaces = sortUsageWorkspaceRows(
      state.workspaces.map((workspace) => {
        // Usage counts qualified people once, including archived and converted people.
        const timestamps = state.prospects
          .filter(
            (person) =>
              person.workspaceId === workspace._id &&
              person.qualificationStatus === "qualified"
          )
          .map((person) => person.qualifiedAt ?? person._creationTime)
          .filter(
            (timestamp) =>
              timestamp >= cycle.cycleStart && timestamp < cycle.cycleEnd
          );
        return {
          workspaceId: workspace._id,
          name: workspace.name,
          used: timestamps.length,
          limit: limits.prospectsLimit,
          unlimited: true,
          percentUsed: 0,
          trend: buildUsageTrendPoints({ window: cycle, timestamps, now }),
        };
      })
    );
    return {
      cycleOptions: cycles.map((item, index) => ({
        key: createUsageCycleKey(item),
        label: formatUsageCycleLabel(item),
        isCurrent: index === 0,
      })),
      selectedCycleKey: createUsageCycleKey(cycle),
      summary: {
        plan: { tier: "pro", label: "Pro" },
        perWorkspaceLimit: limits.prospectsLimit,
        workspacesUsed: state.workspaces.length,
        workspacesLimit: limits.workspacesLimit,
        resetDaysLeft: getCalendarDaysUntil(now, cycle.cycleEnd) ?? 0,
        resetLabel: format(cycle.cycleEnd, "d MMM yyyy"),
      },
      workspaces,
      comparison: {
        mode: "count",
        rows: workspaces.map((workspace) => ({
          workspaceId: workspace.workspaceId,
          name: workspace.name,
          value: workspace.used,
          used: workspace.used,
          limit: null,
        })),
      },
    };
  };
  client.register(
    api.workspaceReporting.getUserWorkspaceReportingStatus,
    () => ({ ready: true, workspaceCount: state.workspaces.length })
  );
  client.register(api.usage.getUsageDashboard, usage);
  client.register(api.usage.getUsageDashboardSnapshot, usage);

  const price = Math.round(
    ONBOARDING_PLAN_TIERS.find((tier) => tier.id === "pro")!.pricing.monthly
      .amount! * 100
  );
  const createdAt = new Date(cycles[2].cycleStart).toISOString();
  const subscription: NonNullable<
    FunctionReturnType<typeof api.polar.getSubscription>
  > = {
    id: "demo_subscription",
    customerId: "demo_customer",
    createdAt,
    modifiedAt: null,
    amount: price,
    currency: "usd",
    recurringInterval: "month",
    status: "active",
    currentPeriodStart: new Date(cycles[0].cycleStart).toISOString(),
    currentPeriodEnd: new Date(cycles[0].cycleEnd).toISOString(),
    cancelAtPeriodEnd: false,
    startedAt: createdAt,
    endedAt: null,
    productId: "demo_pro_monthly",
    checkoutId: null,
    metadata: {},
    productKey: "proMonthly",
    product: {
      id: "demo_pro_monthly",
      createdAt,
      modifiedAt: null,
      name: "Pro",
      description: "Pro monthly subscription",
      recurringInterval: "month",
      isRecurring: true,
      isArchived: false,
      organizationId: "demo_organization",
      prices: [],
      medias: [],
    },
  };
  client.register(api.polar.getSubscription, () => subscription);
  client.register(
    api.billing.listSubscriptionHistory,
    ({ page = 1, limit = 5 }) => ({
      rows: cycles.slice((page - 1) * limit, page * limit).map((cycle) => ({
        id: `demo_invoice_${cycle.cycleStart}`,
        planLabel: "Pro",
        totalAmount: price,
        currency: "usd",
        billingReason:
          cycle.cycleStart === cycles[2].cycleStart
            ? "subscription_create"
            : "subscription_cycle",
        status: "paid",
        createdAt: cycle.cycleStart,
      })),
      page,
      totalPages: Math.ceil(cycles.length / limit),
      totalCount: cycles.length,
    })
  );
  const demoBillingOnly = () => {
    throw new Error(
      "Billing is a preview in this demo. No payment details are needed."
    );
  };
  client.register(api.billing.startCustomerPortalFlow, demoBillingOnly);
  client.register(api.billing.startCheckoutFlow, demoBillingOnly);
  client.register(api.linkedin.getLinkedInConnectionStatus, () => ({
    isConnected: true,
    status: "connected" as const,
    displayName: "Maya Chen",
    connectedAt: cycles[2].cycleStart,
    publicProfileUrl: "https://www.linkedin.com/in/fictional-maya-chen/",
    providerId: "demo_linkedin_account",
  }));
}
