// app/(webapp)/page.tsx
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  useActiveUseCaseLabels,
  usePreferredShellQueryArgs,
  useQueryWithStatus,
} from "@/shared/hooks";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { WorkspacePlanLimitAlert } from "@/features/billing/ui/components/WorkspacePlanLimitAlert";
import { SearchInput } from "@/features/search/ui/components/SearchInput";
import { Button } from "@/shared/ui/components/Button";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/components/Tabs";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import {
  FilterAltIcon,
  SwapVertIcon,
  FramePersonIcon,
} from "@/shared/ui/components/icons";
import { IconButtonWithIndicator } from "@/shared/ui/components/IconButtonWithIndicator";
import {
  PendingProspectsFeedBar,
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
import { useCanGoBack } from "@/shared/ui/hooks/useCanGoBack";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import {
  createDefaultProspectListFilters,
  getProspectListFilterArgs,
} from "@/features/prospects/lib/prospectListFilters";
import { getProspectPipelineEmptyStateCopy } from "@/features/prospects/lib/prospectEmptyStateCopy";
import { DEFAULT_PROSPECT_LIST_SORT } from "@/features/prospects/lib/prospectListSort";
import { WorkspaceSystemStatusFeedBar } from "@/features/webapp/ui/components/WorkspaceSystemStatusFeedBar";
import { buildSetupHref } from "@/shared/lib/urls/setupHref";

type WorkspaceSetupStatus =
  | { status: "unauthenticated" }
  | { status: "no_user" }
  | { status: "no_workspace" }
  | {
      status: "setup_in_progress";
      session: {
        id: Id<"workspaceSetupSessions">;
        threadId: string;
        status: string;
      };
      workspace: {
        id: Id<"workspaces">;
        name: string;
        description: string;
        hasDescription: boolean;
      } | null;
    }
  | {
      status: "needs_icp";
      workspace: {
        id: Id<"workspaces">;
        name: string;
        description: string;
        hasDescription: boolean;
      };
    }
  | {
      status: "complete";
      workspace: {
        id: Id<"workspaces">;
        name: string;
        description: string;
        fitScoreMin: number;
        fitScoreMax: number;
      };
    };

type TabType = "new" | "contacted" | "in_progress";
type ProspectSummary = Doc<"prospectSummaries">;
type ProspectStageCounts = Record<TabType, number>;
type TabAttentionState = Record<TabType, boolean>;
type StageCountBaseline = {
  scopeKey: string | null;
  counts: Partial<ProspectStageCounts>;
};
type PaginationStatus =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted";

const TAB_DEFINITIONS: {
  id: TabType;
  status: TabType;
}[] = [
  { id: "new", status: "new" },
  { id: "contacted", status: "contacted" },
  { id: "in_progress", status: "in_progress" },
];

function createEmptyTabAttention(): TabAttentionState {
  return {
    new: false,
    contacted: false,
    in_progress: false,
  };
}

export default function ProspectsPage() {
  const router = useRouter();
  const { entityPlural, pageLabels, routes, stageLabels } =
    useActiveUseCaseLabels();
  const { openProspect, prospectId } = useProspectProfile();
  const { clearStack } = usePanelStack();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<TabType>("new");
  const stageCountBaselineRef = useRef<StageCountBaseline>({
    scopeKey: null,
    counts: {},
  });
  const [searchQuery, setSearchQuery] = useState("");
  const trimmedSearchQuery = searchQuery.trim();
  const browseMode = trimmedSearchQuery === "";
  const visibilityMode = "ready_only" as const;
  const canGoBack = useCanGoBack();
  const entitiesLower = entityPlural.toLowerCase();
  const preferredShellQueryArgs = usePreferredShellQueryArgs();

  const tabs = useMemo(
    () =>
      TAB_DEFINITIONS.map((tab) => ({
        ...tab,
        label: stageLabels[tab.status],
      })),
    [stageLabels]
  );

  useEffect(() => {
    clearStack();
  }, [clearStack]);

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
  const setupStatus = setupStatusQuery.data as WorkspaceSetupStatus | undefined;
  const shellStateQuery = useQueryWithStatus(
    api.shell.getAppShellState,
    preferredShellQueryArgs
  );
  const workspaceId =
    setupStatus?.status === "complete" ? setupStatus.workspace.id : null;
  const setupFitScoreMin =
    setupStatus?.status === "complete"
      ? setupStatus.workspace.fitScoreMin
      : undefined;
  const setupFitScoreMax =
    setupStatus?.status === "complete"
      ? setupStatus.workspace.fitScoreMax
      : undefined;

  const fitScoreRange = useMemo(() => {
    if (setupFitScoreMin === undefined || setupFitScoreMax === undefined) {
      return null;
    }
    return {
      fitScoreMin: setupFitScoreMin,
      fitScoreMax: setupFitScoreMax,
    };
  }, [setupFitScoreMin, setupFitScoreMax]);
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
  const stageCounts = useQuery(
    api.prospectSummaries.getWorkspaceProspectStageCounts,
    workspaceId && fitScoreRange
      ? {
          workspaceId,
          fitScoreMin: appliedFilterArgs.fitScoreMin,
          fitScoreMax: appliedFilterArgs.fitScoreMax,
          platform: appliedFilterArgs.platform,
          prospectType: appliedFilterArgs.prospectType,
          createdAfterMs: appliedFilterArgs.createdAfterMs,
          createdBeforeMs: appliedFilterArgs.createdBeforeMs,
          visibilityMode,
          searchQuery: trimmedSearchQuery || undefined,
        }
      : "skip"
  ) as ProspectStageCounts | undefined;
  const stageCountScopeKey = useMemo(
    () =>
      [
        workspaceId,
        visibilityMode,
        appliedFilterArgs.fitScoreMin,
        appliedFilterArgs.fitScoreMax,
        appliedFilterArgs.platform ?? "all",
        appliedFilterArgs.prospectType ?? "both",
        appliedFilterArgs.createdAfterMs ?? "none",
        appliedFilterArgs.createdBeforeMs ?? "none",
        trimmedSearchQuery,
      ].join("|"),
    [
      workspaceId,
      visibilityMode,
      appliedFilterArgs.fitScoreMin,
      appliedFilterArgs.fitScoreMax,
      appliedFilterArgs.platform,
      appliedFilterArgs.prospectType,
      appliedFilterArgs.createdAfterMs,
      appliedFilterArgs.createdBeforeMs,
      trimmedSearchQuery,
    ]
  );

  const tabAttention = useMemo<TabAttentionState>(() => {
    if (!stageCounts) {
      return createEmptyTabAttention();
    }

    const baseline = stageCountBaselineRef.current;
    if (baseline.scopeKey !== stageCountScopeKey) {
      baseline.scopeKey = stageCountScopeKey;
      baseline.counts = { ...stageCounts };
      return createEmptyTabAttention();
    }

    return {
      new:
        activeTab !== "new" &&
        stageCounts.new > (baseline.counts.new ?? stageCounts.new),
      contacted:
        activeTab !== "contacted" &&
        stageCounts.contacted >
          (baseline.counts.contacted ?? stageCounts.contacted),
      in_progress:
        activeTab !== "in_progress" &&
        stageCounts.in_progress >
          (baseline.counts.in_progress ?? stageCounts.in_progress),
    };
  }, [
    activeTab,
    stageCountScopeKey,
    stageCounts,
  ]);

  const handleTabChange = useCallback(
    (tab: TabType) => {
      if (stageCounts) {
        const baseline = stageCountBaselineRef.current;
        const baselineCounts =
          baseline.scopeKey === stageCountScopeKey ? baseline.counts : {};

        stageCountBaselineRef.current = {
          scopeKey: stageCountScopeKey,
          counts: {
            ...baselineCounts,
            [activeTab]: stageCounts[activeTab],
            [tab]: stageCounts[tab],
          },
        };
      }

      setActiveTab(tab);
    },
    [activeTab, stageCountScopeKey, stageCounts]
  );

  const newProspectsQuery = usePaginatedQuery(
    api.prospectListFeed.listStableWorkspaceProspectSummaries,
    workspaceId && fitScoreRange && browseMode
      ? {
          workspaceId,
          status: "new",
          sortBy: appliedSort,
          fitScoreMin: appliedFilterArgs.fitScoreMin,
          fitScoreMax: appliedFilterArgs.fitScoreMax,
          platform: appliedFilterArgs.platform,
          prospectType: appliedFilterArgs.prospectType,
          createdAfterMs: appliedFilterArgs.createdAfterMs,
          createdBeforeMs: appliedFilterArgs.createdBeforeMs,
          visibilityMode,
        }
      : "skip",
    { initialNumItems: PROSPECTS_PER_PAGE }
  );
  const contactedProspectsQuery = usePaginatedQuery(
    api.prospectListFeed.listStableWorkspaceProspectSummaries,
    workspaceId && fitScoreRange && browseMode
      ? {
          workspaceId,
          status: "contacted",
          sortBy: appliedSort,
          fitScoreMin: appliedFilterArgs.fitScoreMin,
          fitScoreMax: appliedFilterArgs.fitScoreMax,
          platform: appliedFilterArgs.platform,
          prospectType: appliedFilterArgs.prospectType,
          createdAfterMs: appliedFilterArgs.createdAfterMs,
          createdBeforeMs: appliedFilterArgs.createdBeforeMs,
          visibilityMode,
        }
      : "skip",
    { initialNumItems: PROSPECTS_PER_PAGE }
  );
  const inProgressProspectsQuery = usePaginatedQuery(
    api.prospectListFeed.listStableWorkspaceProspectSummaries,
    workspaceId && fitScoreRange && browseMode
      ? {
          workspaceId,
          status: "in_progress",
          sortBy: appliedSort,
          fitScoreMin: appliedFilterArgs.fitScoreMin,
          fitScoreMax: appliedFilterArgs.fitScoreMax,
          platform: appliedFilterArgs.platform,
          prospectType: appliedFilterArgs.prospectType,
          createdAfterMs: appliedFilterArgs.createdAfterMs,
          createdBeforeMs: appliedFilterArgs.createdBeforeMs,
          visibilityMode,
        }
      : "skip",
    { initialNumItems: PROSPECTS_PER_PAGE }
  );

  const activeTabStatus = useMemo(
    () => TAB_DEFINITIONS.find((t) => t.id === activeTab)!.status,
    [activeTab]
  );

  const feedState = useQuery(
    api.prospectListFeed.getProspectListFeedState,
    workspaceId && fitScoreRange && browseMode
      ? {
          workspaceId,
          status: activeTabStatus,
          sortBy: appliedSort,
          fitScoreMin: appliedFilterArgs.fitScoreMin,
          fitScoreMax: appliedFilterArgs.fitScoreMax,
          platform: appliedFilterArgs.platform,
          prospectType: appliedFilterArgs.prospectType,
          createdAfterMs: appliedFilterArgs.createdAfterMs,
          createdBeforeMs: appliedFilterArgs.createdBeforeMs,
          visibilityMode,
        }
      : "skip"
  );
  const onboardingProgress = useQuery(
    api.prospects.getOnboardingProgress,
    workspaceId ? { workspaceId } : "skip"
  );
  const workspaceSystemStatus = shellStateQuery.data?.workspaceSystemStatus;

  const ensureProspectListAnchor = useMutation(
    api.prospectListFeed.ensureProspectListAnchor
  );
  const mergePendingProspects = useMutation(
    api.prospectListFeed.mergePendingProspects
  );
  const [isMergePending, startMergeTransition] = useTransition();

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
  }, [setupStatus, router]);

  const tabProspects = useMemo(() => {
    switch (activeTab) {
      case "new":
        return newProspectsQuery.results as ProspectSummary[];
      case "contacted":
        return contactedProspectsQuery.results as ProspectSummary[];
      case "in_progress":
        return inProgressProspectsQuery.results as ProspectSummary[];
      default:
        return [];
    }
  }, [
    activeTab,
    contactedProspectsQuery.results,
    inProgressProspectsQuery.results,
    newProspectsQuery.results,
  ]);

  const currentTabStatus = useMemo<PaginationStatus>(() => {
    switch (activeTab) {
      case "new":
        return newProspectsQuery.status as PaginationStatus;
      case "contacted":
        return contactedProspectsQuery.status as PaginationStatus;
      case "in_progress":
        return inProgressProspectsQuery.status as PaginationStatus;
      default:
        return "Exhausted";
    }
  }, [
    activeTab,
    contactedProspectsQuery.status,
    inProgressProspectsQuery.status,
    newProspectsQuery.status,
  ]);

  const browseLoadMore = useCallback(() => {
    switch (activeTab) {
      case "new":
        newProspectsQuery.loadMore(PROSPECTS_PER_PAGE);
        break;
      case "contacted":
        contactedProspectsQuery.loadMore(PROSPECTS_PER_PAGE);
        break;
      case "in_progress":
        inProgressProspectsQuery.loadMore(PROSPECTS_PER_PAGE);
        break;
      default:
        break;
    }
  }, [
    activeTab,
    newProspectsQuery,
    contactedProspectsQuery,
    inProgressProspectsQuery,
  ]);

  const {
    displayProspects,
    prospectIdsForMap,
    isSearchLoading,
    hasMore,
    loadMore,
    isLoadingMore: searchLoadingMore,
  } = useProspectListSearch({
    workspaceId,
    status: activeTabStatus,
    visibilityMode,
    platform: appliedFilterArgs.platform,
    prospectType: appliedFilterArgs.prospectType,
    fitScoreMin: appliedFilterArgs.fitScoreMin,
    fitScoreMax: appliedFilterArgs.fitScoreMax,
    createdAfterMs: appliedFilterArgs.createdAfterMs,
    createdBeforeMs: appliedFilterArgs.createdBeforeMs,
    searchQuery,
    browseResults: tabProspects,
    browseStatus: currentTabStatus,
    browseLoadMore,
  });

  const openedMapQuery = useQuery(
    api.prospectListFeed.getProspectOpenedMap,
    workspaceId && prospectIdsForMap.length > 0
      ? { workspaceId, prospectIds: prospectIdsForMap }
      : "skip"
  );

  const activeTabFirstProspectId = useMemo(() => {
    const list = tabProspects as ProspectSummary[];
    return list[0]?.prospectId;
  }, [tabProspects]);

  useEffect(() => {
    if (!browseMode) return;
    if (!workspaceId || !fitScoreRange) return;
    if (feedState === undefined) return;
    if (feedState.hasAnchor) return;
    if (!activeTabFirstProspectId) return;
    void ensureProspectListAnchor({
      workspaceId,
      status: activeTabStatus,
      visibilityMode,
      platform: appliedFilterArgs.platform,
      prospectType: appliedFilterArgs.prospectType,
      fitScoreMin: appliedFilterArgs.fitScoreMin,
      fitScoreMax: appliedFilterArgs.fitScoreMax,
      createdAfterMs: appliedFilterArgs.createdAfterMs,
      createdBeforeMs: appliedFilterArgs.createdBeforeMs,
      firstProspectId: activeTabFirstProspectId,
      sortBy: appliedSort,
    });
  }, [
    browseMode,
    workspaceId,
    fitScoreRange,
    feedState,
    feedState?.hasAnchor,
    activeTabFirstProspectId,
    activeTabStatus,
    appliedSort,
    appliedFilterArgs.createdAfterMs,
    appliedFilterArgs.createdBeforeMs,
    appliedFilterArgs.fitScoreMax,
    appliedFilterArgs.fitScoreMin,
    appliedFilterArgs.platform,
    appliedFilterArgs.prospectType,
    visibilityMode,
    ensureProspectListAnchor,
  ]);

  const handleMergePending = () => {
    if (!workspaceId || !fitScoreRange) return;
    startMergeTransition(() => {
      void mergePendingProspects({
        workspaceId,
        status: activeTabStatus,
        sortBy: appliedSort,
        visibilityMode,
        platform: appliedFilterArgs.platform,
        prospectType: appliedFilterArgs.prospectType,
        fitScoreMin: appliedFilterArgs.fitScoreMin,
        fitScoreMax: appliedFilterArgs.fitScoreMax,
        createdAfterMs: appliedFilterArgs.createdAfterMs,
        createdBeforeMs: appliedFilterArgs.createdBeforeMs,
      });
    });
  };

  const showPendingBar =
    browseMode &&
    feedState !== undefined &&
    feedState.pendingCount > 0 &&
    workspaceId !== null &&
    fitScoreRange !== null;
  const showAgentStatusBar =
    browseMode &&
    !showPendingBar &&
    workspaceSystemStatus !== null &&
    workspaceSystemStatus !== undefined &&
    onboardingProgress !== undefined &&
    (workspaceSystemStatus.mode === "running" ||
      workspaceSystemStatus.mode === "degraded" ||
      workspaceSystemStatus.mode === "paused");

  const listFirstPageLoading = browseMode
    ? currentTabStatus === "LoadingFirstPage"
    : isSearchLoading;

  const isLoading =
    setupStatusQuery.isPending ||
    setupStatus?.status === "no_workspace" ||
    setupStatus?.status === "needs_icp" ||
    (workspaceId !== null && listFirstPageLoading);
  const isLoadingMore = browseMode
    ? currentTabStatus === "LoadingMore"
    : searchLoadingMore;
  const showLoadMore = hasMore;
  const hasOpenPanel = prospectId !== null;
  const showFilterAsPrimaryPanel = isFilterPanelOpen;
  const showSortAsPrimaryPanel = isSortPanelOpen;
  const showProspectPanel =
    hasOpenPanel && !showFilterAsPrimaryPanel && !showSortAsPrimaryPanel;
  const showEmptyState =
    browseMode && !isLoading && displayProspects.length === 0;
  const showSearchNoMatch =
    !browseMode && !isSearchLoading && displayProspects.length === 0;
  const emptyStateCopy = useMemo(
    () =>
      getProspectPipelineEmptyStateCopy({
        entityPlural,
        stageLabels,
        stage: activeTabStatus,
      }),
    [activeTabStatus, entityPlural, stageLabels]
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 md:flex-row md:items-stretch">
      <PageLayout
        className={cn(
          "flex h-full min-h-0 w-full flex-col overflow-hidden",
          (showProspectPanel ||
            showFilterAsPrimaryPanel ||
            showSortAsPrimaryPanel) &&
            "hidden border-r md:flex md:min-w-0 md:flex-1 md:basis-0"
        )}
      >
        <PageHeader
          title={pageLabels.entities}
          onBack={() => router.back()}
          backDisabled={!canGoBack}
        />
        <PageContent className="flex min-h-0 min-w-0 flex-1 flex-col p-0">
          <ScrollArea className="min-w-0 flex-1">
            <WorkspacePlanLimitAlert className="mx-4 mt-4" />
            {setupStatusQuery.isError ? (
              <div className="px-4 pt-4">
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-sm font-medium">
                    Could not load {entitiesLower}
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
                <ProspectsToolbar
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  activeTab={activeTab}
                  onTabChange={handleTabChange}
                  tabs={tabs}
                  tabCounts={stageCounts}
                  tabAttention={tabAttention}
                  searchPlaceholder={`Search ${entitiesLower}...`}
                  filterActiveCount={activeFilterCount}
                  sortActive={isSortActive}
                  onOpenFilters={openFilterPanelWithState}
                  onOpenSort={openSortPanel}
                  className="px-4 pt-4"
                />

                <div className="flex flex-col gap-4 px-4 pt-4 pb-4">
                  {showPendingBar && feedState ? (
                    <PendingProspectsFeedBar
                      pendingCount={feedState.pendingCount}
                      pendingCountCapped={feedState.pendingCountCapped}
                      preview={feedState.pendingPreview}
                      entityPluralLower={entitiesLower}
                      onMerge={handleMergePending}
                      disabled={isMergePending}
                    />
                  ) : null}
                  {showAgentStatusBar &&
                  onboardingProgress &&
                  workspaceSystemStatus ? (
                    <WorkspaceSystemStatusFeedBar
                      status={workspaceSystemStatus}
                      progress={onboardingProgress}
                    />
                  ) : null}

                  {isLoading ? (
                    <div className="space-y-3 pb-8">
                      <ProspectCardSkeleton />
                      <ProspectCardSkeleton />
                      <ProspectCardSkeleton />
                    </div>
                  ) : showEmptyState ? (
                    <ProspectListEmptyState
                      title={emptyStateCopy.title}
                      description={emptyStateCopy.description}
                      icon={<FramePersonIcon className="size-6 fill-current" />}
                    />
                  ) : showSearchNoMatch ? (
                    <p className="text-muted-foreground py-8 text-center text-sm">
                      No {entitiesLower} in{" "}
                      {tabs
                        .find((tab) => tab.id === activeTab)
                        ?.label.toLowerCase() ?? "this stage"}{" "}
                      match your search
                    </p>
                  ) : (
                    <div className="min-w-0 pb-8">
                      <ul className="min-w-0 space-y-3">
                        {displayProspects.map((prospect) => (
                          <li key={prospect._id} className="min-w-0">
                            <ProspectCard
                              prospect={prospect}
                              highlightKeywords={prospect.matchedKeywords}
                              mode="default"
                              showMenu
                              unread={
                                "prospectId" in prospect &&
                                openedMapQuery !== undefined &&
                                !openedMapQuery[prospect.prospectId]
                              }
                              onClick={() => {
                                if ("prospectId" in prospect) {
                                  handleProspectClick(prospect.prospectId);
                                }
                              }}
                            />
                          </li>
                        ))}
                      </ul>

                      {showLoadMore && (
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
                </div>
              </>
            )}
          </ScrollArea>
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
        status={activeTabStatus}
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

// ============================================================================
// Toolbar Component
// ============================================================================

interface ProspectsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  tabs: Array<{ id: TabType; label: string }>;
  tabCounts?: ProspectStageCounts;
  tabAttention: TabAttentionState;
  searchPlaceholder: string;
  filterActiveCount: number;
  sortActive: boolean;
  onOpenFilters: () => void;
  onOpenSort: () => void;
  className?: string;
}

function ProspectsToolbar({
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
  className,
}: ProspectsToolbarProps) {
  return (
    <div className={className}>
      <SearchInput
        defaultValue={searchQuery}
        onQueryChange={onSearchChange}
        placeholder={searchPlaceholder}
        showExactMatch={false}
      />

      {/* Tabs + Filter/Sort */}
      <nav className="mt-3 flex min-w-0 items-center justify-between gap-2">
        <Tabs
          value={activeTab}
          onValueChange={(v) => onTabChange(v as TabType)}
          className="min-w-0"
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
                        "inline-flex h-4 items-center gap-1 text-xs font-medium leading-none tabular-nums text-muted-foreground",
                        hasAttention &&
                          "animate-notification-bump text-foreground"
                      )}
                    >
                      <span aria-hidden="true" className="text-muted-foreground">
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

        <div className="flex items-center gap-1">
          <IconButtonWithIndicator
            aria-label="Open filters"
            showIndicator={filterActiveCount > 0}
            onClick={onOpenFilters}
            type="button"
          >
            <FilterAltIcon className="fill-current" />
          </IconButtonWithIndicator>
          <IconButtonWithIndicator
            aria-label="Open sort"
            showIndicator={sortActive}
            onClick={onOpenSort}
            type="button"
          >
            <SwapVertIcon className="h-4 w-4 fill-current" />
          </IconButtonWithIndicator>
        </div>
      </nav>
    </div>
  );
}
