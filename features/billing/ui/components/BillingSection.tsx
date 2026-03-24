"use client";

import { Button } from "@/shared/ui/components/Button";

export interface BillingSectionProps {
  onManageBilling: () => void;
}

export function BillingSection({ onManageBilling }: BillingSectionProps) {
  return (
    <section className="border-border border-b px-4 py-4 last:border-b-0">
      <h2 className="text-sm font-medium">Billing &amp; Invoices</h2>
      <p className="text-muted-foreground text-sm">
        Manage billing info and invoices in Polar.
      </p>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="mt-2"
        onClick={onManageBilling}
      >
        Manage billing
      </Button>
    </section>
  );
}
