// app/(webapp)/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePaginatedQuery } from "convex/react";
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
  ProspectCard,
  ProspectCardSkeleton,
  ProspectPanelRenderer,
  usePanelStack,
  useProspectProfile,
} from "@/features/prospects";
import { matchesProspectSearch } from "@/features/prospects/lib/matchesProspectSearch";
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
      };
    };

type TabType = "new" | "contacted" | "in_progress";
type ProspectSummary = Doc<"prospectSummaries">;
type PaginationStatus =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted";

const PROSPECTS_PER_PAGE = 10;

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

  const newProspectsQuery = usePaginatedQuery(
    api.prospectSummaries.listWorkspaceProspectSummaries,
    workspaceId ? { workspaceId, status: "new", qualifiedOnly: true } : "skip",
    { initialNumItems: PROSPECTS_PER_PAGE }
  );
  const contactedProspectsQuery = usePaginatedQuery(
    api.prospectSummaries.listWorkspaceProspectSummaries,
    workspaceId
      ? { workspaceId, status: "contacted", qualifiedOnly: true }
      : "skip",
    { initialNumItems: PROSPECTS_PER_PAGE }
  );
  const inProgressProspectsQuery = usePaginatedQuery(
    api.prospectSummaries.listWorkspaceProspectSummaries,
    workspaceId
      ? { workspaceId, status: "in_progress", qualifiedOnly: true }
      : "skip",
    { initialNumItems: PROSPECTS_PER_PAGE }
  );

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

  const filteredProspects = useMemo(
    () =>
      tabProspects.filter((prospect) =>
        matchesProspectSearch(prospect, searchQuery)
      ),
    [searchQuery, tabProspects]
  );

  const isLoading =
    setupStatusQuery.isPending ||
    setupStatus?.status === "no_workspace" ||
    setupStatus?.status === "needs_icp" ||
    (workspaceId !== null && currentTabStatus === "LoadingFirstPage");
  const isLoadingMore = currentTabStatus === "LoadingMore";
  const hasMore =
    currentTabStatus === "CanLoadMore" || currentTabStatus === "LoadingMore";
  const hasOpenPanel = prospectId !== null;
  const hasAnyProspects =
    newProspectsQuery.results.length > 0 ||
    contactedProspectsQuery.results.length > 0 ||
    inProgressProspectsQuery.results.length > 0;
  const showEmptyState = !isLoading && !hasAnyProspects;

  const handleLoadMore = () => {
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
    }
  };

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

              <ScrollArea className="min-w-0 flex-1 px-4 pb-4">
                {isLoading ? (
                  <div className="space-y-3 pb-4">
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
                ) : filteredProspects.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    No {entitiesLower} in{" "}
                    {tabs
                      .find((tab) => tab.id === activeTab)
                      ?.label.toLowerCase() ?? "this stage"}
                  </p>
                ) : (
                  <div className="min-w-0 pb-4">
                    <ul className="min-w-0 space-y-3">
                      {filteredProspects.map((prospect) => (
                        <li key={prospect._id} className="min-w-0">
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
                      <div className="pt-2 pb-4">
                        <Button
                          size="xs"
                          className="w-full"
                          onClick={handleLoadMore}
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
