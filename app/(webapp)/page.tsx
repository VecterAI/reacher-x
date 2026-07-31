// app/(webapp)/page.tsx
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  useConvex,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  useActiveUseCaseLabels,
  useConvexReady,
  usePreferredShellQueryArgs,
  useQueryWithStatus,
} from "@/shared/hooks";
import {
  DESKTOP_PANEL_BORDER_CLASS_NAME,
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { WorkspacePlanLimitAlert } from "@/features/billing/ui/components/WorkspacePlanLimitAlert";
import { Button } from "@/shared/ui/components/Button";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { InfiniteScrollTrigger } from "@/shared/ui/components/InfiniteScrollTrigger";
import { FramePersonIcon } from "@/shared/ui/components/icons";
import {
  PendingProspectsFeedBar,
  ProspectCard,
  ProspectCardSkeleton,
  ProspectListEmptyState,
  ProspectListFilterPanel,
  ProspectListSortPanel,
  ProspectWaitingState,
  ProspectPanelRenderer,
  ProspectsToolbar,
  type ProspectsToolbarStageCounts,
  type ProspectsToolbarTab,
  type ProspectsToolbarTabAttention,
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
  createDefaultProspectListFilters,
  getProspectListFilterArgs,
} from "@/features/prospects/lib/prospectListFilters";
import { getProspectPipelineEmptyStateCopy } from "@/features/prospects/lib/prospectEmptyStateCopy";
import { DEFAULT_PROSPECT_LIST_SORT } from "@/features/prospects/lib/prospectListSort";
import { shouldShowProspectFeedSkeleton } from "@/features/prospects/lib/prospectListResults";
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

type TabType = ProspectsToolbarTab;
type ProspectStageCounts = ProspectsToolbarStageCounts;
type TabAttentionState = ProspectsToolbarTabAttention;
type ProspectSummary = Doc<"prospectSummaries">;
type ProspectListFeedState = {
  hasSnapshot: boolean;
  pendingCount: number;
  pendingCountCapped: boolean;
  pendingPreview: Array<{
    prospectId: Id<"prospects">;
    displayName: string;
    avatarUrl?: string;
  }>;
};
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
const DESKTOP_SKELETON_COUNT = 3;
const DESKTOP_FEED_BAR_CLASS_NAME =
  "md:inline-flex md:w-auto md:max-w-full md:self-start md:border-0 md:bg-transparent md:p-0 md:[&>div:first-child]:flex-none md:[&>div:first-child]:min-w-0";

function createEmptyTabAttention(): TabAttentionState {
  return {
    new: false,
    contacted: false,
    in_progress: false,
  };
}

export default function ProspectsPage() {
  const router = useRouter();
  const convex = useConvex();
  const { entityPlural, pageLabels, routes, stageLabels } =
    useActiveUseCaseLabels();
  const { openProspect } = useProspectProfile();
  const { clearStack, currentPanel } = usePanelStack();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<TabType>("new");
  const [prefetchedBrowseScopeKey, setPrefetchedBrowseScopeKey] = useState<
    string | null
  >(null);
  const [stageCountBaseline, setStageCountBaseline] =
    useState<StageCountBaseline>({
      scopeKey: null,
      counts: {},
    });
  const [stageCountsState, setStageCountsState] = useState<{
    scopeKey: string | null;
    value: ProspectStageCounts | undefined;
    resolved: boolean;
  }>({
    scopeKey: null,
    value: undefined,
    resolved: false,
  });
  const [feedStateState, setFeedStateState] = useState<{
    scopeKey: string | null;
    value: ProspectListFeedState | undefined;
  }>({
    scopeKey: null,
    value: undefined,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const trimmedSearchQuery = searchQuery.trim();
  const browseMode = trimmedSearchQuery === "";
  const visibilityMode = "ready_only" as const;
  const entitiesLower = entityPlural.toLowerCase();
  const preferredShellQueryArgs = usePreferredShellQueryArgs();
  const { isLoading: isConvexReadyLoading, isReady: isConvexReady } =
    useConvexReady();

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
    isConvexReady ? preferredShellQueryArgs : "skip"
  );
  const setupStatus = setupStatusQuery.data as WorkspaceSetupStatus | undefined;
  const shellStateQuery = useQueryWithStatus(
    api.shell.getAppShellState,
    isConvexReady ? preferredShellQueryArgs : "skip"
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
  const browseScopeKey = useMemo(
    () =>
      [
        workspaceId,
        browseMode ? "browse" : "search",
        visibilityMode,
        appliedSort,
        appliedFilterArgs.fitScoreMin,
        appliedFilterArgs.fitScoreMax,
        appliedFilterArgs.platform ?? "all",
        appliedFilterArgs.prospectType ?? "both",
        appliedFilterArgs.createdAfterMs ?? "none",
        appliedFilterArgs.createdBeforeMs ?? "none",
      ].join("|"),
    [
      workspaceId,
      browseMode,
      visibilityMode,
      appliedSort,
      appliedFilterArgs.fitScoreMin,
      appliedFilterArgs.fitScoreMax,
      appliedFilterArgs.platform,
      appliedFilterArgs.prospectType,
      appliedFilterArgs.createdAfterMs,
      appliedFilterArgs.createdBeforeMs,
    ]
  );
  const enabledTabs = useMemo(
    () => ({
      new: activeTab === "new" || prefetchedBrowseScopeKey === browseScopeKey,
      contacted:
        activeTab === "contacted" ||
        prefetchedBrowseScopeKey === browseScopeKey,
      in_progress:
        activeTab === "in_progress" ||
        prefetchedBrowseScopeKey === browseScopeKey,
    }),
    [activeTab, browseScopeKey, prefetchedBrowseScopeKey]
  );
  const stageCounts =
    stageCountsState.scopeKey === stageCountScopeKey
      ? stageCountsState.value
      : undefined;
  const stageCountsPending =
    workspaceId !== null &&
    fitScoreRange !== null &&
    (stageCountsState.scopeKey !== stageCountScopeKey ||
      !stageCountsState.resolved);

  useEffect(() => {
    let cancelled = false;

    if (!workspaceId || !fitScoreRange) {
      return;
    }

    void convex
      .query(api.prospectSummaries.getWorkspaceProspectStageCounts, {
        workspaceId,
        fitScoreMin: appliedFilterArgs.fitScoreMin,
        fitScoreMax: appliedFilterArgs.fitScoreMax,
        platform: appliedFilterArgs.platform,
        prospectType: appliedFilterArgs.prospectType,
        createdAfterMs: appliedFilterArgs.createdAfterMs,
        createdBeforeMs: appliedFilterArgs.createdBeforeMs,
        visibilityMode,
        searchQuery: trimmedSearchQuery || undefined,
      })
      .then((counts) => {
        if (!cancelled) {
          setStageCountsState({
            scopeKey: stageCountScopeKey,
            value: counts as ProspectStageCounts,
            resolved: true,
          });
        }
      })
      .catch((error) => {
        console.warn(
          "[ProspectsPage] Failed to load stage counts",
          {
            workspaceId: String(workspaceId),
          },
          error
        );
        if (!cancelled) {
          setStageCountsState({
            scopeKey: stageCountScopeKey,
            value: undefined,
            resolved: true,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    convex,
    workspaceId,
    fitScoreRange,
    appliedFilterArgs.fitScoreMin,
    appliedFilterArgs.fitScoreMax,
    appliedFilterArgs.platform,
    appliedFilterArgs.prospectType,
    appliedFilterArgs.createdAfterMs,
    appliedFilterArgs.createdBeforeMs,
    visibilityMode,
    stageCountScopeKey,
    trimmedSearchQuery,
  ]);

  const tabAttention = useMemo<TabAttentionState>(() => {
    if (!stageCounts) {
      return createEmptyTabAttention();
    }

    const baselineCounts =
      stageCountBaseline.scopeKey === stageCountScopeKey
        ? stageCountBaseline.counts
        : stageCounts;

    return {
      new:
        activeTab !== "new" &&
        stageCounts.new > (baselineCounts.new ?? stageCounts.new),
      contacted:
        activeTab !== "contacted" &&
        stageCounts.contacted >
          (baselineCounts.contacted ?? stageCounts.contacted),
      in_progress:
        activeTab !== "in_progress" &&
        stageCounts.in_progress >
          (baselineCounts.in_progress ?? stageCounts.in_progress),
    };
  }, [activeTab, stageCountBaseline, stageCountScopeKey, stageCounts]);

  const handleTabChange = useCallback(
    (tab: TabType) => {
      if (stageCounts) {
        setStageCountBaseline((current) => {
          const baselineCounts =
            current.scopeKey === stageCountScopeKey ? current.counts : {};

          return {
            scopeKey: stageCountScopeKey,
            counts: {
              ...baselineCounts,
              [activeTab]: stageCounts[activeTab],
              [tab]: stageCounts[tab],
            },
          };
        });
      }

      setActiveTab(tab);
    },
    [activeTab, stageCountScopeKey, stageCounts]
  );

  const newProspectsQuery = usePaginatedQuery(
    api.prospectListFeed.listStableWorkspaceProspectSummaries,
    enabledTabs.new && workspaceId && fitScoreRange && browseMode
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
    enabledTabs.contacted && workspaceId && fitScoreRange && browseMode
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
    enabledTabs.in_progress && workspaceId && fitScoreRange && browseMode
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
  const feedStateScopeKey = useMemo(
    () => [browseScopeKey, activeTabStatus].join("|"),
    [activeTabStatus, browseScopeKey]
  );
  const feedState =
    feedStateState.scopeKey === feedStateScopeKey
      ? feedStateState.value
      : undefined;
  const onboardingProgress = useQuery(
    api.prospects.getOnboardingProgress,
    workspaceId ? { workspaceId } : "skip"
  );
  const workspaceSystemStatus = shellStateQuery.data?.workspaceSystemStatus;

  const syncProspectListFeedSnapshot = useMutation(
    api.prospectListFeed.syncProspectListFeedSnapshot
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
  const refreshFeedState = useCallback(async () => {
    if (!workspaceId || !fitScoreRange || !browseMode) {
      return;
    }

    try {
      const nextFeedState = await convex.query(
        api.prospectListFeed.getProspectListFeedState,
        {
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
      );

      setFeedStateState({
        scopeKey: feedStateScopeKey,
        value: nextFeedState as ProspectListFeedState,
      });
    } catch (error) {
      console.warn(
        "[ProspectsPage] Failed to load feed state",
        {
          status: activeTabStatus,
          workspaceId: String(workspaceId),
        },
        error
      );
      setFeedStateState({
        scopeKey: feedStateScopeKey,
        value: undefined,
      });
    }
  }, [
    convex,
    workspaceId,
    fitScoreRange,
    browseMode,
    activeTabStatus,
    appliedSort,
    appliedFilterArgs.fitScoreMin,
    appliedFilterArgs.fitScoreMax,
    appliedFilterArgs.platform,
    appliedFilterArgs.prospectType,
    appliedFilterArgs.createdAfterMs,
    appliedFilterArgs.createdBeforeMs,
    visibilityMode,
    feedStateScopeKey,
  ]);

  useEffect(() => {
    if (!browseMode || !workspaceId || !fitScoreRange) {
      return;
    }

    if (currentTabStatus === "LoadingFirstPage") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPrefetchedBrowseScopeKey((current) =>
        current === browseScopeKey ? current : browseScopeKey
      );
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    browseMode,
    browseScopeKey,
    currentTabStatus,
    fitScoreRange,
    workspaceId,
  ]);

  useEffect(() => {
    if (!workspaceId || !fitScoreRange || !browseMode) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshFeedState();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [browseMode, fitScoreRange, refreshFeedState, workspaceId]);

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
    paginationResultCount,
    prospectIdsForMap,
    isSearchLoading,
    hasMore,
    loadMore,
    isLoadingMore: searchLoadingMore,
    loadMoreError,
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
    onBrowseLoadMore: browseLoadMore,
  });

  const openedMapQuery = useQuery(
    api.prospectListFeed.getProspectOpenedMap,
    workspaceId && prospectIdsForMap.length > 0
      ? { workspaceId, prospectIds: prospectIdsForMap }
      : "skip"
  );

  useEffect(() => {
    let cancelled = false;

    if (!browseMode) return;
    if (!workspaceId || !fitScoreRange) return;
    if (feedState === undefined) return;
    if (feedState.hasSnapshot) return;
    if (tabProspects.length === 0) {
      return;
    }

    void syncProspectListFeedSnapshot({
      workspaceId,
      status: activeTabStatus,
      visibilityMode,
      platform: appliedFilterArgs.platform,
      prospectType: appliedFilterArgs.prospectType,
      fitScoreMin: appliedFilterArgs.fitScoreMin,
      fitScoreMax: appliedFilterArgs.fitScoreMax,
      createdAfterMs: appliedFilterArgs.createdAfterMs,
      createdBeforeMs: appliedFilterArgs.createdBeforeMs,
    })
      .then(() => (!cancelled ? refreshFeedState() : undefined))
      .catch((error) => {
        console.warn(
          "[ProspectsPage] Failed to sync feed snapshot",
          {
            status: activeTabStatus,
            workspaceId: String(workspaceId),
          },
          error
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeTabStatus,
    appliedFilterArgs.createdAfterMs,
    appliedFilterArgs.createdBeforeMs,
    appliedFilterArgs.fitScoreMax,
    appliedFilterArgs.fitScoreMin,
    appliedFilterArgs.platform,
    appliedFilterArgs.prospectType,
    browseMode,
    feedState,
    fitScoreRange,
    syncProspectListFeedSnapshot,
    tabProspects.length,
    visibilityMode,
    workspaceId,
    refreshFeedState,
  ]);

  const handleMergePending = () => {
    if (!workspaceId || !fitScoreRange) return;
    startMergeTransition(() => {
      void mergePendingProspects({
        workspaceId,
        status: activeTabStatus,
        visibilityMode,
        platform: appliedFilterArgs.platform,
        prospectType: appliedFilterArgs.prospectType,
        fitScoreMin: appliedFilterArgs.fitScoreMin,
        fitScoreMax: appliedFilterArgs.fitScoreMax,
        createdAfterMs: appliedFilterArgs.createdAfterMs,
        createdBeforeMs: appliedFilterArgs.createdBeforeMs,
      })
        .then(() => refreshFeedState())
        .catch((error) => {
          console.warn(
            "[ProspectsPage] Failed to merge pending prospects",
            {
              status: activeTabStatus,
              workspaceId: String(workspaceId),
            },
            error
          );
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
  const listContentLoading = shouldShowProspectFeedSkeleton({
    browseMode,
    firstPageLoading: listFirstPageLoading,
    countsPending: stageCountsPending,
    expectedResultCount: stageCounts?.[activeTab],
    displayedResultCount: displayProspects.length,
  });
  const isWorkspaceReady = setupStatus?.status === "complete";

  const isLoading =
    isConvexReadyLoading ||
    setupStatusQuery.isPending ||
    !isWorkspaceReady ||
    (workspaceId !== null && listContentLoading);
  const isLoadingMore = browseMode
    ? currentTabStatus === "LoadingMore"
    : searchLoadingMore;
  const showLoadMore = hasMore;
  const hasOpenPanel = currentPanel !== null;
  const showFilterAsPrimaryPanel = isFilterPanelOpen;
  const showSortAsPrimaryPanel = isSortPanelOpen;
  const showProspectPanel =
    hasOpenPanel && !showFilterAsPrimaryPanel && !showSortAsPrimaryPanel;
  const hideMainContentOnMobile =
    isMobile &&
    (showProspectPanel || showFilterAsPrimaryPanel || showSortAsPrimaryPanel);
  const showEmptyState =
    isWorkspaceReady &&
    browseMode &&
    !isLoading &&
    displayProspects.length === 0;
  const showWaitingState =
    showEmptyState &&
    setupStatus?.status === "complete" &&
    onboardingProgress !== null &&
    onboardingProgress !== undefined &&
    onboardingProgress.actionableReadyCount === 0 &&
    workspaceSystemStatus !== null &&
    workspaceSystemStatus !== undefined &&
    (workspaceSystemStatus.mode === "running" ||
      workspaceSystemStatus.mode === "degraded");

  useEffect(() => {
    if (!showWaitingState) return;

    if (isFilterPanelOpen) {
      closeFilterPanel();
    }
    if (isSortPanelOpen) {
      closeSortPanel();
    }
  }, [
    closeFilterPanel,
    closeSortPanel,
    isFilterPanelOpen,
    isSortPanelOpen,
    showWaitingState,
  ]);

  const showSearchNoMatch =
    isWorkspaceReady &&
    !browseMode &&
    !isSearchLoading &&
    displayProspects.length === 0;
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
          "flex h-full min-h-0 w-full max-w-none flex-1 basis-0 flex-col overflow-hidden border-none",
          hideMainContentOnMobile && "hidden md:flex"
        )}
      >
        <PageHeader title={pageLabels.entities} />
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
                  disabled={showWaitingState}
                  className="px-4 pt-4"
                />

                <div className="flex flex-col gap-4 px-4 pt-4 pb-4">
                  {!showWaitingState &&
                  ((showPendingBar && feedState) ||
                    (showAgentStatusBar &&
                      onboardingProgress &&
                      workspaceSystemStatus)) ? (
                    <div className="flex w-full flex-col gap-4 md:max-w-lg">
                      {showPendingBar && feedState ? (
                        <PendingProspectsFeedBar
                          pendingCount={feedState.pendingCount}
                          pendingCountCapped={feedState.pendingCountCapped}
                          preview={feedState.pendingPreview}
                          entityPluralLower={entitiesLower}
                          onMerge={handleMergePending}
                          disabled={isMergePending}
                          className={DESKTOP_FEED_BAR_CLASS_NAME}
                        />
                      ) : null}
                      {showAgentStatusBar &&
                      onboardingProgress &&
                      workspaceSystemStatus ? (
                        <WorkspaceSystemStatusFeedBar
                          status={workspaceSystemStatus}
                          progress={onboardingProgress}
                          className={DESKTOP_FEED_BAR_CLASS_NAME}
                        />
                      ) : null}
                    </div>
                  ) : null}

                  {isLoading ? (
                    <div
                      className={cn(
                        "grid gap-3 pb-8",
                        "grid-cols-1",
                        "md:[grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))]"
                      )}
                    >
                      {Array.from({ length: DESKTOP_SKELETON_COUNT }).map(
                        (_, index) => (
                          <ProspectCardSkeleton key={index} />
                        )
                      )}
                    </div>
                  ) : showWaitingState && onboardingProgress ? (
                    <ProspectWaitingState
                      entityPlural={entityPlural}
                      onViewAnalytics={() => router.push(routes.analyticsHref)}
                    />
                  ) : showEmptyState ? (
                    <ProspectListEmptyState
                      title={emptyStateCopy.title}
                      description={emptyStateCopy.description}
                      icon={
                        <FramePersonIcon className="fill-muted-foreground size-12" />
                      }
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
                      <ul
                        aria-busy={isLoadingMore}
                        className={cn(
                          "grid min-w-0 gap-3",
                          "grid-cols-1",
                          "md:[grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))]"
                        )}
                      >
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

                      <InfiniteScrollTrigger
                        hasMore={showLoadMore}
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
        status={activeTabStatus}
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
