"use client";

import * as React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/shared/ui/components/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/Select";
import { cn } from "@/shared/lib/utils";

type PaginationToken = number | "ellipsis-left" | "ellipsis-right";

function buildPaginationTokens(
  currentPage: number,
  totalPages: number
): PaginationToken[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index);
  }

  const lastPage = totalPages - 1;

  if (currentPage <= 2) {
    return [0, 1, 2, "ellipsis-right", lastPage];
  }

  if (currentPage >= lastPage - 2) {
    return [0, "ellipsis-left", lastPage - 2, lastPage - 1, lastPage];
  }

  return [
    0,
    "ellipsis-left",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis-right",
    lastPage,
  ];
}

export interface TablePaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (pageSize: number) => void;
  size?: "xs" | "sm";
  className?: string;
}

export function TablePagination({
  page,
  totalPages,
  onPageChange,
  pageSize,
  pageSizeOptions = [5, 10, 20],
  onPageSizeChange,
  size = "sm",
  className,
}: TablePaginationProps) {
  const resolvedTotalPages = Math.max(totalPages, 1);
  const currentPage = Math.min(Math.max(page, 0), resolvedTotalPages - 1);
  const canPrevious = currentPage > 0;
  const canNext = currentPage < resolvedTotalPages - 1;
  const tokens = buildPaginationTokens(currentPage, resolvedTotalPages);
  const showPageSizeSelect =
    pageSize !== undefined &&
    onPageSizeChange !== undefined &&
    pageSizeOptions.length > 0;
  const isCompact = size === "xs";
  const triggerWidthClass = isCompact ? "w-[112px]" : "w-[132px]";
  const itemSizeClass = isCompact ? "h-6 min-w-6 px-2" : "h-9 min-w-9 px-3";
  const navItemClass = isCompact ? "h-6 px-2 text-xs" : "h-9 px-3";

  return (
    <div
      className={cn(
        showPageSizeSelect
          ? "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          : "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end",
        className
      )}
    >
      {showPageSizeSelect ? (
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value))}
        >
          <SelectTrigger
            size={size}
            className={cn("w-full sm:w-auto", triggerWidthClass)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent className="gap-1.5">
          <PaginationItem>
            <PaginationPrevious
              href="#"
              size={size}
              aria-disabled={!canPrevious}
              className={cn(
                navItemClass,
                !canPrevious && "pointer-events-none opacity-50"
              )}
              onClick={(event) => {
                event.preventDefault();
                if (canPrevious) {
                  onPageChange(currentPage - 1);
                }
              }}
            />
          </PaginationItem>

          {tokens.map((token, index) => {
            if (typeof token !== "number") {
              return (
                <PaginationItem key={`${token}-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              );
            }

            const isActive = token === currentPage;

            return (
              <PaginationItem key={token}>
                <PaginationLink
                  href="#"
                  size={size}
                  isActive={isActive}
                  className={itemSizeClass}
                  onClick={(event) => {
                    event.preventDefault();
                    if (!isActive) {
                      onPageChange(token);
                    }
                  }}
                >
                  {token + 1}
                </PaginationLink>
              </PaginationItem>
            );
          })}

          <PaginationItem>
            <PaginationNext
              href="#"
              size={size}
              aria-disabled={!canNext}
              className={cn(
                navItemClass,
                !canNext && "pointer-events-none opacity-50"
              )}
              onClick={(event) => {
                event.preventDefault();
                if (canNext) {
                  onPageChange(currentPage + 1);
                }
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
