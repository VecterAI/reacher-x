"use client";

import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/Select";
import {
  Table,
  TableBody,
  TableCell,
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/shared/ui/components/pagination";
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
  onPreviousPage: () => void;
  onNextPage: () => void;
  onOpenPortal: () => void;
}

function PaginationRow({
  page,
  totalPages,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <Pagination className="justify-between">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            aria-disabled={!canPrevious}
            className={
              !canPrevious ? "pointer-events-none opacity-50" : undefined
            }
            onClick={(event) => {
              event.preventDefault();
              if (canPrevious) onPrevious();
            }}
          />
        </PaginationItem>
        <PaginationItem className="text-muted-foreground px-3 text-sm">
          Page {page + 1} of {totalPages}
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            href="#"
            aria-disabled={!canNext}
            className={!canNext ? "pointer-events-none opacity-50" : undefined}
            onClick={(event) => {
              event.preventDefault();
              if (canNext) onNext();
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export function SubscriptionHistorySection({
  rows,
  page,
  totalPages,
  pageSize,
  onPageSizeChange,
  onPreviousPage,
  onNextPage,
  onOpenPortal,
}: SubscriptionHistorySectionProps) {
  const canPrevious = page > 0;
  const canNext = page + 1 < totalPages;

  return (
    <section className="border-border border-b px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Subscription history</h2>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
        >
          <SelectTrigger size="xs" className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[5, 10, 20].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-2 space-y-4">
        <div className="rounded-lg border">
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
                    {(row.totalAmount / 100).toFixed(2)} {row.currency}
                  </TableCell>
                  <TableCell className="text-sm">{row.billingReason}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {format(row.createdAt, "MMM d, yyyy, HH:mm:ss")}
                  </TableCell>
                  <TableCell className="text-sm">{row.status}</TableCell>
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
        </div>
        {totalPages > 0 ? (
          <PaginationRow
            page={page}
            totalPages={totalPages}
            canPrevious={canPrevious}
            canNext={canNext}
            onPrevious={onPreviousPage}
            onNext={onNextPage}
          />
        ) : null}
      </div>
    </section>
  );
}
