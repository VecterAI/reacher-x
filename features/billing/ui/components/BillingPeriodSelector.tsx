"use client";

import type { BillingPeriod } from "@/shared/lib/billing/planOfferHelpers";
import { Badge } from "@/shared/ui/components/Badge";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/components/Tabs";

export function BillingPeriodSelector({
  periods,
  value,
  onChange,
}: {
  periods: readonly BillingPeriod[];
  value: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
}) {
  if (periods.length < 2)
    return periods.length === 1 ? (
      <p className="text-muted-foreground text-center text-sm">
        {periods[0] === "yearly" ? "Billed yearly" : "Billed monthly"}
      </p>
    ) : null;
  return (
    <Tabs
      value={value}
      onValueChange={(period) => {
        if (period === "monthly" || period === "yearly") onChange(period);
      }}
      className="w-full"
    >
      <TabsList className="flex w-full" aria-label="Billing period">
        {periods.map((period) => (
          <TabsTrigger
            key={period}
            value={period}
            className={period === "yearly" ? "group flex-1 gap-1.5" : "flex-1"}
          >
            {period === "monthly" ? "Monthly" : "Yearly"}
            {period === "yearly" ? (
              <Badge
                variant="outline-strong"
                className="border-muted-foreground text-muted-foreground group-data-[state=active]:border-foreground group-data-[state=active]:text-foreground"
              >
                2 months free
              </Badge>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
