/**
 * ProspectsToolbar
 * Search, stage tabs, and filter/sort actions for the prospects list.
 * Prop-driven so it can be reused by interactive previews with mock data.
 */
"use client";

import { SearchInput } from "@/features/search/ui/components/SearchInput";
import { cn } from "@/shared/lib/utils";
import { IconButtonWithIndicator } from "@/shared/ui/components/IconButtonWithIndicator";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/components/Tabs";
import { FilterAltIcon, SwapVertIcon } from "@/shared/ui/components/icons";

export type ProspectsToolbarTab = "new" | "contacted" | "in_progress";
export type ProspectsToolbarStageCounts = Record<ProspectsToolbarTab, number>;
export type ProspectsToolbarTabAttention = Record<ProspectsToolbarTab, boolean>;

export interface ProspectsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  activeTab: ProspectsToolbarTab;
  onTabChange: (tab: ProspectsToolbarTab) => void;
  tabs: Array<{ id: ProspectsToolbarTab; label: string }>;
  tabCounts?: ProspectsToolbarStageCounts;
  tabAttention: ProspectsToolbarTabAttention;
  searchPlaceholder: string;
  filterActiveCount: number;
  sortActive: boolean;
  onOpenFilters: () => void;
  onOpenSort: () => void;
  disabled: boolean;
  className?: string;
}

export function ProspectsToolbar({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  tabs,
  tabCounts,
  tabAttention,
  searchPlaceholder,
  filterActiveCount,
  sortActive,
  onOpenFilters,
  onOpenSort,
  disabled,
  className,
}: ProspectsToolbarProps) {
  return (
    <div className={cn("@container", className)}>
      <nav className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 md:gap-y-2 @[760px]:grid-cols-[auto_minmax(0,1fr)_auto] @[760px]:gap-y-0">
        <div className="col-span-2 row-start-1 min-w-0 md:col-span-1 @[760px]:col-start-2 @[760px]:w-72 @[760px]:justify-self-end @[960px]:w-80">
          <SearchInput
            defaultValue={searchQuery}
            onQueryChange={onSearchChange}
            placeholder={searchPlaceholder}
            showExactMatch={false}
            disabled={disabled}
          />
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => onTabChange(v as ProspectsToolbarTab)}
          className="col-start-1 row-start-2 min-w-0 overflow-x-auto md:col-span-2 @[760px]:col-span-1 @[760px]:row-start-1"
        >
          <TabsList size="sm" className="h-9 max-w-full p-1">
            {tabs.map((tab) => {
              const count = tabCounts?.[tab.id];
              const hasCount = typeof count === "number" && count > 0;
              const hasAttention =
                hasCount && tabAttention[tab.id] && tab.id !== activeTab;

              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  size="sm"
                  disabled={disabled}
                  aria-label={[
                    tab.label,
                    hasCount ? `${count} total` : null,
                    hasAttention ? "updated" : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  className="h-7 gap-1.5 px-2.5 py-0 leading-none"
                >
                  <span className="leading-none">{tab.label}</span>
                  {hasCount ? (
                    <span
                      className={cn(
                        "text-muted-foreground inline-flex h-4 items-center gap-1 text-xs leading-none font-medium tabular-nums",
                        hasAttention &&
                          "animate-notification-bump text-foreground"
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="text-muted-foreground"
                      >
                        ·
                      </span>
                      <span className="font-mono leading-none tabular-nums">
                        {count.toLocaleString()}
                      </span>
                    </span>
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <div className="col-start-2 row-start-2 flex shrink-0 items-center gap-2 md:row-start-1 @[760px]:col-start-3">
          <IconButtonWithIndicator
            aria-label="Open filters"
            showIndicator={filterActiveCount > 0}
            onClick={onOpenFilters}
            disabled={disabled}
            type="button"
            size="xsIcon"
            className="shrink-0 md:h-9 md:w-9"
          >
            <FilterAltIcon className="fill-current" />
          </IconButtonWithIndicator>
          <IconButtonWithIndicator
            aria-label="Open sort"
            showIndicator={sortActive}
            onClick={onOpenSort}
            disabled={disabled}
            type="button"
            size="xsIcon"
            className="shrink-0 md:h-9 md:w-9"
          >
            <SwapVertIcon className="h-4 w-4 fill-current" />
          </IconButtonWithIndicator>
        </div>
      </nav>
    </div>
  );
}
