"use client";

import type { BillingPeriod } from "@/shared/lib/billing/planOfferHelpers";
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
          <TabsTrigger key={period} value={period} className="flex-1">
            {period === "monthly" ? "Monthly" : "Yearly"}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
