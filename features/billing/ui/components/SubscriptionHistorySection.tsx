"use client";

import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/Table";
import { Button } from "@/shared/ui/components/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import { TablePagination } from "@/shared/ui/components/TablePagination";
import { MoreHorizontal } from "lucide-react";

export type HistoryRow = {
  id: string;
  planLabel: string;
  totalAmount: number;
  currency: string;
  billingReason: string;
  status: string;
  createdAt: number;
};

export interface SubscriptionHistorySectionProps {
  rows: HistoryRow[];
  page: number;
  totalPages: number;
  pageSize: number;
  onPageSizeChange: (n: number) => void;
  onPageChange: (page: number) => void;
  onOpenPortal: () => void;
}

function formatSentenceCaseLabel(value: string) {
  const normalized = value.trim().replace(/[_-]+/g, " ");
  if (!normalized) return "Unknown";

  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function formatBillingReason(reason: string) {
  const normalized = reason.trim().toLowerCase();
  const knownReasons: Record<string, string> = {
    subscription_create: "Subscription created",
    subscription_cycle: "Subscription renewed",
    subscription_update: "Subscription updated",
    subscription_cancel: "Subscription canceled",
  };

  return knownReasons[normalized] ?? formatSentenceCaseLabel(normalized);
}

function formatBillingStatus(status: string) {
  return formatSentenceCaseLabel(status);
}

function formatCurrencyCode(currency: string) {
  return currency.trim().toUpperCase();
}

export function SubscriptionHistorySection({
  rows,
  page,
  totalPages,
  pageSize,
  onPageSizeChange,
  onPageChange,
  onOpenPortal,
}: SubscriptionHistorySectionProps) {
  return (
    <section className="border-border border-b px-4 py-4">
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-medium">Subscription history</h2>
        </div>

        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Billing reason</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-0 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.planLabel}</TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">
                    {(row.totalAmount / 100).toFixed(2)}{" "}
                    {formatCurrencyCode(row.currency)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatBillingReason(row.billingReason)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {format(row.createdAt, "MMM d, yyyy, HH:mm:ss")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatBillingStatus(row.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xsIcon"
                          aria-label="Row actions"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={onOpenPortal}>
                          Open billing portal
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          size="xs"
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </section>
  );
}
