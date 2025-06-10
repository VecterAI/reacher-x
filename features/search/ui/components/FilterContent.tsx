// features/search/ui/components/FilterContent.tsx
"use client";

import { memo, useCallback } from "react";
import { Button } from "@/shared/ui/components/Button";
import { Input } from "@/shared/ui/components/Input";
import { Checkbox } from "@/shared/ui/components/Checkbox";
import { Label } from "@/shared/ui/components/Label";
import { Separator } from "@/shared/ui/components/Separator";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { ArrowBackIcon } from "@/shared/ui/components/icons";
import { cn } from "@/shared/lib/utils/utils";
import type { FilterState } from "../../types";

interface FilterContentProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onApply: () => void;
  onReset: () => void;
  onBack?: () => void; // For mobile back navigation
  className?: string;
}

export const FilterContent = memo<FilterContentProps>(function FilterContent({
  filters,
  onFiltersChange,
  onApply,
  onReset,
  onBack,
  className,
}) {
  const handleFilterChange = useCallback(
    (key: keyof FilterState, value: boolean | string) => {
      onFiltersChange({ ...filters, [key]: value });
    },
    [filters, onFiltersChange]
  );

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <aside className={cn("flex h-full flex-col", className)}>
      {/* Mobile Header with Back Button */}
      <header className="flex items-center justify-between border-b py-2 pl-2.5 pr-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="xsIcon"
            onClick={onBack}
            aria-label="Go back"
          >
            <ArrowBackIcon className="h-4 w-4 fill-current" />
          </Button>
          <small className="text-sm font-medium">Filter.</small>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={onReset}
            disabled={!hasActiveFilters}
          >
            Reset
          </Button>
          <Button size="xs" onClick={onApply}>
            Apply
          </Button>
        </div>
      </header>

      {/* Filter Content - Scrollable */}
      <ScrollArea className="flex-1">
        <div className="space-y-4">
          {/* Verification */}
          <section className="space-y-3 px-4 pt-4">
            <div className="space-y-1.5">
              <h3 className="font-medium">Verification.</h3>
              <p className="text-sm text-muted-foreground">
                ↳ Filter based on verification status.
              </p>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="verified"
                  checked={filters.verified || false}
                  onCheckedChange={(checked) =>
                    handleFilterChange("verified", checked as boolean)
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="verified"
                    className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Verified
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    ↳ Potential customer with a verification badge.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="unverified"
                  checked={filters.unverified || false}
                  onCheckedChange={(checked) =>
                    handleFilterChange("unverified", checked as boolean)
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="unverified"
                    className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Unverified
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    ↳ Potential customer without a verification badge.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* From */}
          <div className="space-y-3">
            <Label htmlFor="from" className="font-medium">
              From
            </Label>
            <Input
              id="from"
              placeholder="e.g., elonmusk"
              value={filters.from || ""}
              onChange={(e) => handleFilterChange("from", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Posts from a specific @username.
            </p>
          </div>

          <Separator />

          {/* To */}
          <div className="space-y-3">
            <Label htmlFor="to" className="font-medium">
              To
            </Label>
            <Input
              id="to"
              placeholder="e.g., elonmusk"
              value={filters.to || ""}
              onChange={(e) => handleFilterChange("to", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Posts replying to a specific @username.
            </p>
          </div>

          <Separator />

          {/* Mention */}
          <div className="space-y-3">
            <Label htmlFor="mention" className="font-medium">
              Mention
            </Label>
            <Input
              id="mention"
              placeholder="e.g., elonmusk"
              value={filters.mention || ""}
              onChange={(e) => handleFilterChange("mention", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Posts mentioning a specific @username.
            </p>
          </div>

          <Separator />

          {/* List */}
          <div className="space-y-3">
            <Label htmlFor="list" className="font-medium">
              List
            </Label>
            <Input
              id="list"
              placeholder="e.g., esa/astronauts"
              value={filters.list || ""}
              onChange={(e) => handleFilterChange("list", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Posts from members of a specified public list (by list ID or
              slug).
            </p>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
});
