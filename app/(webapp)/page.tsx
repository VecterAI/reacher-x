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
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useActiveUseCaseLabels, useQueryWithStatus } from "@/shared/hooks";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { SearchInput } from "@/features/search/ui/components/SearchInput";
import { Button } from "@/shared/ui/components/Button";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/components/Tabs";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import {
  FilterAltIcon,
  SwapVertIcon,
  FramePersonIcon,
} from "@/shared/ui/components/icons";
import {
  PendingProspectsFeedBar,
  ProspectCard,
  ProspectCardSkeleton,
  ProspectPanelRenderer,
  usePanelStack,
  useProspectProfile,
} from "@/features/prospects";
import {
  PROSPECTS_PER_PAGE,
  useProspectListSearch,
} from "@/features/prospects/hooks/useProspectListSearch";
import { cn } from "@/shared/lib/utils";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";

type WorkspaceSetupStatus =
  | { status: "unauthenticated" }
  | { status: "no_user" }
  | { status: "no_workspace" }
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
type PaginationStatus =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted";

const TAB_DEFINITIONS: {
  id: TabType;
  status: ProspectSummary["status"];
}[] = [
  { id: "new", status: "new" },
  { id: "contacted", status: "contacted" },
  { id: "in_progress", status: "in_progress" },
];

export default function ProspectsPage() {
  const router = useRouter();
  const { entityPlural, pageLabels, routes, stageLabels } =
    useActiveUseCaseLabels();
  const { openProspect, prospectId } = useProspectProfile();
  const { clearStack } = usePanelStack();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<TabType>("new");
  const [searchQuery, setSearchQuery] = useState("");
  const browseMode = searchQuery.trim() === "";
  const [canGoBack, setCanGoBack] = useState(false);
  const entitiesLower = entityPlural.toLowerCase();

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateCanGoBack = () => {
      setCanGoBack(window.history.length > 1);
    };

    updateCanGoBack();
    window.addEventListener("popstate", updateCanGoBack);

    return () => {
      window.removeEventListener("popstate", updateCanGoBack);
    };
  }, []);

  const handleProspectClick = (id: Id<"prospects">) => {
    if (isMobile) {
      router.push(routes.detailHref(id));
      return;
    }
    openProspect(id);
  };

  const setupStatusQuery = useQueryWithStatus(
    api.workspaces.getWorkspaceSetupStatus
  );
  const setupStatus = setupStatusQuery.data as WorkspaceSetupStatus | undefined;
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

  const newProspectsQuery = usePaginatedQuery(
    api.prospectListFeed.listStableWorkspaceProspectSummaries,
    workspaceId && fitScoreRange && browseMode
      ? {
          workspaceId,
          status: "new",
          fitScoreMin: fitScoreRange.fitScoreMin,
          fitScoreMax: fitScoreRange.fitScoreMax,
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
          fitScoreMin: fitScoreRange.fitScoreMin,
          fitScoreMax: fitScoreRange.fitScoreMax,
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
          fitScoreMin: fitScoreRange.fitScoreMin,
          fitScoreMax: fitScoreRange.fitScoreMax,
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
          fitScoreMin: fitScoreRange.fitScoreMin,
          fitScoreMax: fitScoreRange.fitScoreMax,
        }
      : "skip"
  );

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
      setupStatus.status === "no_workspace" ||
      setupStatus.status === "needs_icp"
    ) {
      router.replace("/agent/setup");
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
    fitScoreMin: fitScoreRange?.fitScoreMin,
    fitScoreMax: fitScoreRange?.fitScoreMax,
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
      fitScoreMin: fitScoreRange.fitScoreMin,
      fitScoreMax: fitScoreRange.fitScoreMax,
      firstProspectId: activeTabFirstProspectId,
    });
  }, [
    browseMode,
    workspaceId,
    fitScoreRange,
    feedState,
    feedState?.hasAnchor,
    activeTabFirstProspectId,
    activeTabStatus,
    ensureProspectListAnchor,
  ]);

  const handleMergePending = () => {
    if (!workspaceId || !fitScoreRange) return;
    startMergeTransition(() => {
      void mergePendingProspects({
        workspaceId,
        status: activeTabStatus,
        fitScoreMin: fitScoreRange.fitScoreMin,
        fitScoreMax: fitScoreRange.fitScoreMax,
      });
    });
  };

  const showPendingBar =
    browseMode &&
    feedState !== undefined &&
    feedState.pendingCount > 0 &&
    workspaceId !== null &&
    fitScoreRange !== null;

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
  const hasAnyProspects =
    newProspectsQuery.results.length > 0 ||
    contactedProspectsQuery.results.length > 0 ||
    inProgressProspectsQuery.results.length > 0;
  const showEmptyState = browseMode && !isLoading && !hasAnyProspects;
  const showSearchNoMatch =
    !browseMode && !isSearchLoading && displayProspects.length === 0;

  return (
    <div className="flex h-full min-h-0 w-full">
      <PageLayout
        className={cn(
          "h-full min-h-0 w-full overflow-hidden",
          hasOpenPanel && "hidden border-r md:block"
        )}
      >
        <PageHeader
          title={pageLabels.entities}
          onBack={() => router.back()}
          backDisabled={!canGoBack}
        />
        <PageContent className="flex h-full min-w-0 flex-col p-0">
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
                onTabChange={setActiveTab}
                tabs={tabs}
                searchPlaceholder={`Search ${entitiesLower}...`}
                className="px-4 pt-4"
              />

              <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
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

                <ScrollArea className="min-w-0 flex-1">
                  {isLoading ? (
                    <div className="space-y-3 pb-8">
                      <ProspectCardSkeleton />
                      <ProspectCardSkeleton />
                      <ProspectCardSkeleton />
                    </div>
                  ) : showEmptyState ? (
                    <div className="flex h-full items-center justify-center py-16">
                      <div className="text-muted-foreground text-center">
                        <FramePersonIcon className="fill-muted-foreground mx-auto mb-3 size-12" />
                        <p className="font-medium">No {entitiesLower} yet</p>
                        <p className="mt-1 text-sm">
                          Start searching to find your ideal {entitiesLower}
                        </p>
                      </div>
                    </div>
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
                              unread={
                                openedMapQuery !== undefined &&
                                !openedMapQuery[prospect.prospectId]
                              }
                              onClick={() =>
                                handleProspectClick(prospect.prospectId)
                              }
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
                </ScrollArea>
              </div>
            </>
          )}
        </PageContent>
      </PageLayout>

      {hasOpenPanel && <ProspectPanelRenderer />}
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
  searchPlaceholder: string;
  className?: string;
}

function ProspectsToolbar({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  tabs,
  searchPlaceholder,
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
      <nav className="mt-3 flex items-center justify-between">
        <Tabs
          value={activeTab}
          onValueChange={(v) => onTabChange(v as TabType)}
        >
          <TabsList size="sm">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} size="sm">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs">
            <FilterAltIcon className="fill-current" />
            Filter
          </Button>
          <Button variant="outline" size="xsIcon">
            <SwapVertIcon className="h-4 w-4 fill-current" />
          </Button>
        </div>
      </nav>
    </div>
  );
}
