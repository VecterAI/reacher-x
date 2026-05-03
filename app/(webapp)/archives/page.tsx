// app/(webapp)/archives/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  useActiveUseCaseLabels,
  usePreferredShellQueryArgs,
  useQueryWithStatus,
} from "@/shared/hooks";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { SearchInput } from "@/features/search/ui/components/SearchInput";
import { Button } from "@/shared/ui/components/Button";
import { IconButtonWithIndicator } from "@/shared/ui/components/IconButtonWithIndicator";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import {
  ProspectCard,
  ProspectCardSkeleton,
  ProspectListFilterPanel,
  ProspectListSortPanel,
  ProspectPanelRenderer,
  useProspectProfile,
} from "@/features/prospects";
import {
  PROSPECTS_PER_PAGE,
  useProspectListSearch,
} from "@/features/prospects/hooks/useProspectListSearch";
import { useProspectListFilters } from "@/features/prospects/hooks/useProspectListFilters";
import { useProspectListSort } from "@/features/prospects/hooks/useProspectListSort";
import { cn } from "@/shared/lib/utils";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import {
  ArchiveIcon,
  FilterAltIcon,
  SwapVertIcon,
} from "@/shared/ui/components/icons";
import {
  createDefaultProspectListFilters,
  getProspectListFilterArgs,
} from "@/features/prospects/lib/prospectListFilters";
import { DEFAULT_PROSPECT_LIST_SORT } from "@/features/prospects/lib/prospectListSort";

type ProspectSummary = Doc<"prospectSummaries">;
type PaginationStatus =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted";

export default function ArchivesPage() {
  const router = useRouter();
  const { entityPlural, pageLabels, routes } = useActiveUseCaseLabels();
  const { openProspect, prospectId } = useProspectProfile();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const browseMode = searchQuery.trim() === "";
  const entitiesLower = entityPlural.toLowerCase();
  const preferredShellQueryArgs = usePreferredShellQueryArgs();

  const handleProspectClick = (id: Id<"prospects">) => {
    if (isMobile) {
      router.push(routes.detailHref(id));
      return;
    }
    openProspect(id);
  };

  const setupStatusQuery = useQueryWithStatus(
    api.workspaces.getWorkspaceSetupStatus,
    preferredShellQueryArgs
  );
  const setupStatus = setupStatusQuery.data;
  const workspaceId =
    setupStatus?.status === "complete" ? setupStatus.workspace.id : null;
  const fitScoreRange =
    setupStatus?.status === "complete"
      ? {
          fitScoreMin: setupStatus.workspace.fitScoreMin,
          fitScoreMax: setupStatus.workspace.fitScoreMax,
        }
      : null;
  const defaultFilters = useMemo(
    () =>
      createDefaultProspectListFilters([
        fitScoreRange?.fitScoreMin ?? 70,
        fitScoreRange?.fitScoreMax ?? 100,
      ]),
    [fitScoreRange?.fitScoreMax, fitScoreRange?.fitScoreMin]
  );
  const {
    appliedFilters,
    draftFilters,
    setDraftFilters,
    isOpen: isFilterPanelOpen,
    open: openFilterPanel,
    close: closeFilterPanel,
    apply: applyFilters,
    reset: resetFilters,
    canApply: canApplyFilters,
    canReset: canResetFilters,
    activeFilterCount,
  } = useProspectListFilters(defaultFilters);
  const {
    appliedSort,
    draftSort,
    setDraftSort,
    isOpen: isSortPanelOpen,
    open: openSortPanelRaw,
    close: closeSortPanel,
    apply: applySort,
    reset: resetSort,
    canApply: canApplySort,
    canReset: canResetSort,
    isActive: isSortActive,
  } = useProspectListSort(DEFAULT_PROSPECT_LIST_SORT);
  const openFilterPanelWithState = () => {
    closeSortPanel();
    openFilterPanel();
  };
  const openSortPanel = () => {
    closeFilterPanel();
    openSortPanelRaw();
  };
  const appliedFilterArgs = useMemo(
    () => getProspectListFilterArgs(appliedFilters),
    [appliedFilters]
  );

  const prospectsQuery = usePaginatedQuery(
    api.prospectSummaries.listWorkspaceProspectSummaries,
    workspaceId && fitScoreRange && browseMode
      ? {
          workspaceId,
          status: "archived",
          sortBy: appliedSort,
          platform: appliedFilterArgs.platform,
          prospectType: appliedFilterArgs.prospectType,
          fitScoreMin: appliedFilterArgs.fitScoreMin,
          fitScoreMax: appliedFilterArgs.fitScoreMax,
          createdAfterMs: appliedFilterArgs.createdAfterMs,
          createdBeforeMs: appliedFilterArgs.createdBeforeMs,
        }
      : "skip",
    { initialNumItems: PROSPECTS_PER_PAGE }
  );

  const archivedProspects = prospectsQuery.results as ProspectSummary[];
  const browseStatus = prospectsQuery.status as PaginationStatus;

  const {
    displayProspects,
    isSearchLoading,
    hasMore,
    loadMore,
    isLoadingMore: searchLoadingMore,
  } = useProspectListSearch({
    workspaceId,
    status: "archived",
    platform: appliedFilterArgs.platform,
    prospectType: appliedFilterArgs.prospectType,
    fitScoreMin: appliedFilterArgs.fitScoreMin,
    fitScoreMax: appliedFilterArgs.fitScoreMax,
    createdAfterMs: appliedFilterArgs.createdAfterMs,
    createdBeforeMs: appliedFilterArgs.createdBeforeMs,
    searchQuery,
    browseResults: archivedProspects,
    browseStatus,
    browseLoadMore: () => prospectsQuery.loadMore(PROSPECTS_PER_PAGE),
  });

  const listFirstPageLoading = browseMode
    ? browseStatus === "LoadingFirstPage"
    : isSearchLoading;

  const isLoading =
    setupStatusQuery.isPending ||
    (workspaceId !== null && listFirstPageLoading);
  const isLoadingMore = browseMode
    ? browseStatus === "LoadingMore"
    : searchLoadingMore;
  const hasOpenPanel = prospectId !== null;
  const showFilterAsPrimaryPanel = isFilterPanelOpen;
  const showSortAsPrimaryPanel = isSortPanelOpen;
  const showProspectPanel =
    hasOpenPanel && !showFilterAsPrimaryPanel && !showSortAsPrimaryPanel;
  const showEmptyState =
    browseMode && !isLoading && archivedProspects.length === 0;
  const showSearchNoMatch =
    !browseMode && !isSearchLoading && displayProspects.length === 0;

  return (
    <div className="flex h-full min-h-0 w-full">
      <PageLayout
        className={cn(
          "h-full min-h-0 w-full overflow-hidden",
          (showProspectPanel ||
            showFilterAsPrimaryPanel ||
            showSortAsPrimaryPanel) &&
            "hidden border-r md:block"
        )}
      >
        <PageHeader title={pageLabels.archives} onBack={() => router.back()} />
        <PageContent className="flex h-full flex-col p-0">
          {setupStatusQuery.isError ? (
            <div className="px-4 pt-4">
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm font-medium">Could not load archives</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {setupStatusQuery.error.message || "Please try again."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => router.refresh()}
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-0 px-4 pt-4">
                <SearchInput
                  defaultValue={searchQuery}
                  onQueryChange={setSearchQuery}
                  placeholder={`Search archived ${entitiesLower}...`}
                  showExactMatch={false}
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <IconButtonWithIndicator
                    aria-label="Open filters"
                    showIndicator={activeFilterCount > 0}
                    onClick={openFilterPanelWithState}
                    type="button"
                    size="xs"
                    className="w-full justify-center gap-1.5"
                  >
                    <FilterAltIcon className="fill-current" />
                    <span>Filter</span>
                  </IconButtonWithIndicator>
                  <IconButtonWithIndicator
                    aria-label="Open sort"
                    showIndicator={isSortActive}
                    onClick={openSortPanel}
                    type="button"
                    size="xs"
                    className="w-full justify-center gap-1.5"
                  >
                    <SwapVertIcon className="h-4 w-4 fill-current" />
                    <span>Sort</span>
                  </IconButtonWithIndicator>
                </div>
              </div>

              <ScrollArea className="flex-1 px-4 pt-4 pb-4">
                {isLoading ? (
                  <div className="space-y-3 pb-8">
                    <ProspectCardSkeleton />
                    <ProspectCardSkeleton />
                    <ProspectCardSkeleton />
                  </div>
                ) : showEmptyState ? (
                  <div className="flex h-full items-center justify-center py-16">
                    <div className="text-muted-foreground text-center">
                      <ArchiveIcon className="fill-muted-foreground mx-auto mb-3 size-12" />
                      <p className="font-medium">No archived {entitiesLower}</p>
                      <p className="mt-1 text-sm">
                        Archived {entitiesLower} will appear here
                      </p>
                    </div>
                  </div>
                ) : showSearchNoMatch ? (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    No archived {entitiesLower} match your search
                  </p>
                ) : (
                  <div className="pb-8">
                    <ul className="space-y-3">
                      {displayProspects.map((prospect) => (
                        <li key={prospect._id}>
                          <ProspectCard
                            prospect={prospect}
                            highlightKeywords={prospect.matchedKeywords}
                            onClick={() =>
                              handleProspectClick(prospect.prospectId)
                            }
                          />
                        </li>
                      ))}
                    </ul>

                    {hasMore && (
                      <div className="pt-2">
                        <Button
                          size="xs"
                          className="w-full"
                          onClick={loadMore}
                          disabled={isLoadingMore}
                        >
                          {isLoadingMore ? (
                            <AsciiSpinnerText text="Loading" />
                          ) : (
                            "Load more"
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </PageContent>
      </PageLayout>

      {showProspectPanel && <ProspectPanelRenderer />}

      <ProspectListFilterPanel
        open={isFilterPanelOpen}
        onClose={closeFilterPanel}
        onApply={applyFilters}
        onReset={resetFilters}
        canApply={canApplyFilters}
        canReset={canResetFilters}
        workspaceId={workspaceId}
        status="archived"
        defaultFilters={defaultFilters}
        draftFilters={draftFilters}
        onDraftFiltersChange={setDraftFilters}
      />
      <ProspectListSortPanel
        open={isSortPanelOpen}
        onClose={closeSortPanel}
        onApply={applySort}
        onReset={resetSort}
        canApply={canApplySort}
        canReset={canResetSort}
        draftSort={draftSort}
        onDraftSortChange={setDraftSort}
      />
    </div>
  );
}
