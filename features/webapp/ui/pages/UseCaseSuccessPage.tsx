"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  useActiveUseCaseLabels,
  useConvexReady,
  usePreferredShellQueryArgs,
  useQueryWithStatus,
  useWorkspace,
} from "@/shared/hooks";
import {
  DESKTOP_PANEL_BORDER_CLASS_NAME,
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { SearchInput } from "@/features/search/ui/components/SearchInput";
import { Button } from "@/shared/ui/components/Button";
import { IconButtonWithIndicator } from "@/shared/ui/components/IconButtonWithIndicator";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { InfiniteScrollTrigger } from "@/shared/ui/components/InfiniteScrollTrigger";
import {
  ProspectCard,
  ProspectCardSkeleton,
  ProspectListEmptyState,
  ProspectListFilterPanel,
  ProspectListSortPanel,
  ProspectPanelRenderer,
  usePanelStack,
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
  AccountBoxIcon,
  FilterAltIcon,
  SwapVertIcon,
} from "@/shared/ui/components/icons";
import {
  createDefaultProspectListFilters,
  getProspectListFilterArgs,
} from "@/features/prospects/lib/prospectListFilters";
import { getProspectSuccessEmptyStateCopy } from "@/features/prospects/lib/prospectEmptyStateCopy";
import { DEFAULT_PROSPECT_LIST_SORT } from "@/features/prospects/lib/prospectListSort";
import { buildSetupHref } from "@/shared/lib/urls/setupHref";

type ProspectSummary = Doc<"prospectSummaries">;
type PaginationStatus =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted";

interface UseCaseSuccessPageProps {
  slug: string;
}

export function UseCaseSuccessPage({ slug }: UseCaseSuccessPageProps) {
  const router = useRouter();
  const { entityPlural, pageLabels, routes, stageLabels } =
    useActiveUseCaseLabels();
  const { isLoading: isWorkspaceLoading } = useWorkspace();
  const { openProspect } = useProspectProfile();
  const { currentPanel } = usePanelStack();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const browseMode = searchQuery.trim() === "";
  const successLabelLower = pageLabels.converts.toLowerCase();
  const successEmptyStateCopy = useMemo(
    () =>
      getProspectSuccessEmptyStateCopy({
        entityPlural,
        successLabel: pageLabels.converts,
        stageLabels,
      }),
    [entityPlural, pageLabels.converts, stageLabels]
  );
  const isCanonicalRoute = slug === routes.successSlug;
  const preferredShellQueryArgs = usePreferredShellQueryArgs();
  const { isLoading: isConvexReadyLoading, isReady: isConvexReady } =
    useConvexReady();

  useEffect(() => {
    if (!isWorkspaceLoading && !isCanonicalRoute) {
      router.replace(routes.successHref);
    }
  }, [isCanonicalRoute, isWorkspaceLoading, router, routes.successHref]);

  const handleProspectClick = (id: Id<"prospects">) => {
    if (isMobile) {
      router.push(routes.detailHref(id));
      return;
    }
    openProspect(id);
  };

  const setupStatusQuery = useQueryWithStatus(
    api.workspaces.getWorkspaceSetupStatus,
    isConvexReady ? preferredShellQueryArgs : "skip"
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

  useEffect(() => {
    if (!setupStatus) return;
    if (
      setupStatus.status === "setup_in_progress" ||
      setupStatus.status === "no_workspace" ||
      setupStatus.status === "needs_icp"
    ) {
      router.replace(
        setupStatus.status === "setup_in_progress"
          ? buildSetupHref(setupStatus.session.threadId)
          : "/agent/setup"
      );
    }
  }, [router, setupStatus]);
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
    workspaceId && browseMode
      ? {
          workspaceId,
          status: "converted",
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

  const convertedProspects = prospectsQuery.results as ProspectSummary[];
  const browseStatus = prospectsQuery.status as PaginationStatus;

  const {
    displayProspects,
    paginationResultCount,
    isSearchLoading,
    hasMore,
    loadMore,
    isLoadingMore: searchLoadingMore,
    loadMoreError,
  } = useProspectListSearch({
    workspaceId,
    status: "converted",
    platform: appliedFilterArgs.platform,
    prospectType: appliedFilterArgs.prospectType,
    fitScoreMin: appliedFilterArgs.fitScoreMin,
    fitScoreMax: appliedFilterArgs.fitScoreMax,
    createdAfterMs: appliedFilterArgs.createdAfterMs,
    createdBeforeMs: appliedFilterArgs.createdBeforeMs,
    searchQuery,
    browseResults: convertedProspects,
    browseStatus,
    onBrowseLoadMore: () => prospectsQuery.loadMore(PROSPECTS_PER_PAGE),
  });

  const listFirstPageLoading = browseMode
    ? browseStatus === "LoadingFirstPage"
    : isSearchLoading;
  const isWorkspaceReady = setupStatus?.status === "complete";

  const isLoading =
    isConvexReadyLoading ||
    setupStatusQuery.isPending ||
    !isWorkspaceReady ||
    (workspaceId !== null && listFirstPageLoading);
  const isLoadingMore = browseMode
    ? browseStatus === "LoadingMore"
    : searchLoadingMore;
  const hasOpenPanel = currentPanel !== null;
  const showFilterAsPrimaryPanel = isFilterPanelOpen;
  const showSortAsPrimaryPanel = isSortPanelOpen;
  const showProspectPanel =
    hasOpenPanel && !showFilterAsPrimaryPanel && !showSortAsPrimaryPanel;
  const showEmptyState =
    isWorkspaceReady &&
    browseMode &&
    !isLoading &&
    convertedProspects.length === 0;
  const showSearchNoMatch =
    isWorkspaceReady &&
    !browseMode &&
    !isSearchLoading &&
    displayProspects.length === 0;

  if (!isWorkspaceLoading && !isCanonicalRoute) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 md:flex-row md:items-stretch">
      <PageLayout
        className={cn(
          "flex h-full min-h-0 w-full max-w-none flex-1 basis-0 flex-col overflow-hidden border-none",
          isMobile &&
            (showProspectPanel ||
              showFilterAsPrimaryPanel ||
              showSortAsPrimaryPanel) &&
            "hidden md:flex"
        )}
      >
        <PageHeader title={pageLabels.converts} />
        <PageContent className="flex min-h-0 flex-1 flex-col p-0">
          <ScrollArea className="min-w-0 flex-1">
            {setupStatusQuery.isError ? (
              <div className="px-4 pt-4">
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-sm font-medium">
                    Could not load {successLabelLower}
                  </p>
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
                  <div className="md:hidden">
                    <SearchInput
                      defaultValue={searchQuery}
                      onQueryChange={setSearchQuery}
                      placeholder={`Search ${successLabelLower}...`}
                      showExactMatch={false}
                    />
                  </div>
                  <div className="hidden items-center justify-between gap-3 md:flex">
                    <div className="w-72 lg:w-80">
                      <SearchInput
                        defaultValue={searchQuery}
                        onQueryChange={setSearchQuery}
                        placeholder={`Search ${successLabelLower}...`}
                        showExactMatch={false}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <IconButtonWithIndicator
                        aria-label="Open filters"
                        showIndicator={activeFilterCount > 0}
                        onClick={openFilterPanelWithState}
                        type="button"
                        className="h-9 w-9"
                      >
                        <FilterAltIcon className="fill-current" />
                      </IconButtonWithIndicator>
                      <IconButtonWithIndicator
                        aria-label="Open sort"
                        showIndicator={isSortActive}
                        onClick={openSortPanel}
                        type="button"
                        className="h-9 w-9"
                      >
                        <SwapVertIcon className="h-4 w-4 fill-current" />
                      </IconButtonWithIndicator>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 md:hidden">
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

                <div className="px-4 pt-4 pb-4">
                  {isLoading ? (
                    <div
                      className={cn(
                        "grid gap-3 pb-8",
                        "grid-cols-1",
                        "md:[grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))]"
                      )}
                    >
                      <ProspectCardSkeleton />
                      <ProspectCardSkeleton />
                      <ProspectCardSkeleton />
                    </div>
                  ) : showEmptyState ? (
                    <ProspectListEmptyState
                      title={successEmptyStateCopy.title}
                      description={successEmptyStateCopy.description}
                      icon={
                        <AccountBoxIcon className="fill-muted-foreground size-12" />
                      }
                    />
                  ) : showSearchNoMatch ? (
                    <p className="text-muted-foreground py-8 text-center text-sm">
                      No {successLabelLower} match your search
                    </p>
                  ) : (
                    <div className="pb-8">
                      <ul
                        aria-busy={isLoadingMore}
                        className={cn(
                          "grid gap-3",
                          "grid-cols-1",
                          "md:[grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))]"
                        )}
                      >
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

                      <InfiniteScrollTrigger
                        hasMore={hasMore}
                        isLoading={isLoadingMore}
                        loadMoreError={loadMoreError}
                        onLoadMore={loadMore}
                        resultCount={paginationResultCount}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </ScrollArea>
        </PageContent>
      </PageLayout>

      {showProspectPanel && (
        <ProspectPanelRenderer className={DESKTOP_PANEL_BORDER_CLASS_NAME} />
      )}

      <ProspectListFilterPanel
        open={isFilterPanelOpen}
        onClose={closeFilterPanel}
        onApply={applyFilters}
        onReset={resetFilters}
        canApply={canApplyFilters}
        canReset={canResetFilters}
        workspaceId={workspaceId}
        status="converted"
        defaultFilters={defaultFilters}
        draftFilters={draftFilters}
        onDraftFiltersChange={setDraftFilters}
        className={DESKTOP_PANEL_BORDER_CLASS_NAME}
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
        className={DESKTOP_PANEL_BORDER_CLASS_NAME}
      />
    </div>
  );
}
