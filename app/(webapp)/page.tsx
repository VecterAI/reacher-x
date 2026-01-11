// app/(webapp)/page.tsx
/* eslint-disable react-hooks/refs */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { Input } from "@/shared/ui/components/Input";
import { Button } from "@/shared/ui/components/Button";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/components/Tabs";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import {
  FilterAltIcon,
  SwapVertIcon,
  SearchIcon,
  FramePersonIcon,
} from "@/shared/ui/components/icons";
import {
  useProspectProfile,
  ProspectPanelRenderer,
  ProspectCard,
  ProspectCardSkeleton,
  usePanelStack,
} from "@/features/prospects";
import { cn } from "@/shared/lib/utils";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";

// ============================================================================
// Types
// ============================================================================

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
type SortOption = "match" | "recent" | "engagement";

// Pagination constants (matching RelevantActivityTab)
const PROSPECTS_PER_PAGE = 10;

const TABS: {
  id: TabType;
  label: string;
  status: Doc<"prospects">["status"][];
}[] = [
  { id: "new", label: "New", status: ["new"] },
  { id: "contacted", label: "Contacted", status: ["contacted"] },
  { id: "in_progress", label: "In progress", status: ["in_progress"] },
];

// ============================================================================
// Helpers
// ============================================================================

function getProspectText(prospect: Doc<"prospects">): string {
  const data = prospect.data as Record<string, unknown> | undefined;
  if (!data) return "";
  return String(data.text ?? data.full_text ?? data.content ?? "");
}

function getEngagement(prospect: Doc<"prospects">): number {
  const data = prospect.data as Record<string, unknown> | undefined;
  if (!data) return 0;
  if (prospect.platform === "twitter") {
    return (
      Number(data.favorite_count ?? 0) +
      Number(data.retweet_count ?? 0) +
      Number(data.reply_count ?? 0)
    );
  }
  const engagements = data.engagements as Record<string, unknown> | undefined;
  return (
    Number(engagements?.totalReactions ?? 0) +
    Number(engagements?.commentsCount ?? 0)
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function ProspectsPage() {
  const router = useRouter();
  const { openProspect, prospectId } = useProspectProfile();
  const isMobile = useIsMobile();

  // Clear panel stack on mount to ensure fresh state when navigating back to list
  const { clearStack } = usePanelStack();
  useEffect(() => {
    clearStack();
  }, [clearStack]);

  // Local state
  const [activeTab, setActiveTab] = useState<TabType>("new");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("match");

  // Pagination state for each tab
  const [newLimit, setNewLimit] = useState(PROSPECTS_PER_PAGE);
  const [contactedLimit, setContactedLimit] = useState(PROSPECTS_PER_PAGE);
  const [inProgressLimit, setInProgressLimit] = useState(PROSPECTS_PER_PAGE);

  // Track the limit we're loading for (to detect "load more" vs initial load)
  // When load more is clicked, this is set to the new limit value
  // When data arrives, compare with current limit to know if done
  const [loadingNewLimit, setLoadingNewLimit] = useState<number | null>(null);
  const [loadingContactedLimit, setLoadingContactedLimit] = useState<
    number | null
  >(null);
  const [loadingInProgressLimit, setLoadingInProgressLimit] = useState<
    number | null
  >(null);

  // Cache last successful results per tab so list/button doesn't disappear while loading more
  const cachedNewProspectsRef = useRef<Doc<"prospects">[]>([]);
  const cachedContactedProspectsRef = useRef<Doc<"prospects">[]>([]);
  const cachedInProgressProspectsRef = useRef<Doc<"prospects">[]>([]);
  const cachedNewHasMoreRef = useRef(false);
  const cachedContactedHasMoreRef = useRef(false);
  const cachedInProgressHasMoreRef = useRef(false);

  // Handle prospect card click: route to page on mobile, open panel on desktop
  const handleProspectClick = (id: Id<"prospects">) => {
    if (isMobile) {
      router.push(`/prospects/${id}`);
    } else {
      openProspect(id);
    }
  };

  // Queries
  const setupStatus = useQuery(api.workspaces.getWorkspaceSetupStatus) as
    | WorkspaceSetupStatus
    | undefined;

  const workspaceId =
    setupStatus?.status === "complete" ? setupStatus.workspace.id : null;

  // Parallel queries for each status (server-side filtering via index)
  const newProspectsData = useQuery(
    api.prospects.getWorkspaceProspects,
    workspaceId ? { workspaceId, status: "new", limit: newLimit } : "skip"
  );
  const contactedProspectsData = useQuery(
    api.prospects.getWorkspaceProspects,
    workspaceId
      ? { workspaceId, status: "contacted", limit: contactedLimit }
      : "skip"
  );
  const inProgressProspectsData = useQuery(
    api.prospects.getWorkspaceProspects,
    workspaceId
      ? { workspaceId, status: "in_progress", limit: inProgressLimit }
      : "skip"
  );

  // Update caches when data is available (no setState here)
  useEffect(() => {
    if (!newProspectsData) return;
    cachedNewProspectsRef.current =
      newProspectsData.prospects as Doc<"prospects">[];
    cachedNewHasMoreRef.current = newProspectsData.hasMore ?? false;
  }, [newProspectsData]);

  useEffect(() => {
    if (!contactedProspectsData) return;
    cachedContactedProspectsRef.current =
      contactedProspectsData.prospects as Doc<"prospects">[];
    cachedContactedHasMoreRef.current = contactedProspectsData.hasMore ?? false;
  }, [contactedProspectsData]);

  useEffect(() => {
    if (!inProgressProspectsData) return;
    cachedInProgressProspectsRef.current =
      inProgressProspectsData.prospects as Doc<"prospects">[];
    cachedInProgressHasMoreRef.current =
      inProgressProspectsData.hasMore ?? false;
  }, [inProgressProspectsData]);

  // Redirect to agent if setup incomplete
  useEffect(() => {
    if (!setupStatus) return;
    if (
      setupStatus.status === "no_workspace" ||
      setupStatus.status === "needs_icp"
    ) {
      router.replace("/agent");
    }
  }, [setupStatus, router]);

  // Get prospects for active tab
  const getProspectsForTab = (): Doc<"prospects">[] => {
    switch (activeTab) {
      case "new":
        return (newProspectsData?.prospects ??
          cachedNewProspectsRef.current) as Doc<"prospects">[];
      case "contacted":
        return (contactedProspectsData?.prospects ??
          cachedContactedProspectsRef.current) as Doc<"prospects">[];
      case "in_progress":
        return (inProgressProspectsData?.prospects ??
          cachedInProgressProspectsRef.current) as Doc<"prospects">[];
      default:
        return [];
    }
  };

  // Compute loading more state (true when we clicked load more AND data hasn't arrived yet)
  const isLoadingMoreNew =
    loadingNewLimit !== null && newProspectsData === undefined;
  const isLoadingMoreContacted =
    loadingContactedLimit !== null && contactedProspectsData === undefined;
  const isLoadingMoreInProgress =
    loadingInProgressLimit !== null && inProgressProspectsData === undefined;

  // Check if current tab is doing initial load (not a "load more" operation)
  const isCurrentTabInitialLoading = (): boolean => {
    if (!workspaceId) return false;
    switch (activeTab) {
      case "new":
        return (
          newProspectsData === undefined &&
          cachedNewProspectsRef.current.length === 0
        );
      case "contacted":
        return (
          contactedProspectsData === undefined &&
          cachedContactedProspectsRef.current.length === 0
        );
      case "in_progress":
        return (
          inProgressProspectsData === undefined &&
          cachedInProgressProspectsRef.current.length === 0
        );
      default:
        return false;
    }
  };

  // Check if current tab is loading more
  const isCurrentTabLoadingMore = (): boolean => {
    switch (activeTab) {
      case "new":
        return isLoadingMoreNew;
      case "contacted":
        return isLoadingMoreContacted;
      case "in_progress":
        return isLoadingMoreInProgress;
      default:
        return false;
    }
  };

  const isLoading =
    setupStatus === undefined ||
    setupStatus.status === "no_workspace" ||
    setupStatus.status === "needs_icp" ||
    isCurrentTabInitialLoading();

  const isLoadingMore = isCurrentTabLoadingMore();

  const hasOpenPanel = prospectId !== null;
  const tabProspects = getProspectsForTab();

  // Check if any tab has prospects (for empty state)
  const hasAnyProspects =
    (newProspectsData?.prospects ?? cachedNewProspectsRef.current).length > 0 ||
    (contactedProspectsData?.prospects ?? cachedContactedProspectsRef.current)
      .length > 0 ||
    (inProgressProspectsData?.prospects ?? cachedInProgressProspectsRef.current)
      .length > 0;

  // Check if current tab has more prospects to load
  const getCurrentTabHasMore = (): boolean => {
    switch (activeTab) {
      case "new":
        return newProspectsData?.hasMore ?? cachedNewHasMoreRef.current;
      case "contacted":
        return (
          contactedProspectsData?.hasMore ?? cachedContactedHasMoreRef.current
        );
      case "in_progress":
        return (
          inProgressProspectsData?.hasMore ?? cachedInProgressHasMoreRef.current
        );
      default:
        return false;
    }
  };

  const hasMore = getCurrentTabHasMore();

  // Handle "Load more" click - increase limit for current tab
  const handleLoadMore = () => {
    switch (activeTab) {
      case "new": {
        const newVal = newLimit + PROSPECTS_PER_PAGE;
        setLoadingNewLimit(newVal);
        setNewLimit(newVal);
        break;
      }
      case "contacted": {
        const newVal = contactedLimit + PROSPECTS_PER_PAGE;
        setLoadingContactedLimit(newVal);
        setContactedLimit(newVal);
        break;
      }
      case "in_progress": {
        const newVal = inProgressLimit + PROSPECTS_PER_PAGE;
        setLoadingInProgressLimit(newVal);
        setInProgressLimit(newVal);
        break;
      }
    }
  };

  // Filter by search query (status already filtered server-side)
  const filteredProspects = tabProspects.filter((p) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const keywords = p.matchedKeywords?.join(" ").toLowerCase() ?? "";
      const text = getProspectText(p).toLowerCase();
      if (!keywords.includes(query) && !text.includes(query)) return false;
    }
    return true;
  });

  const sortedProspects = [...filteredProspects].sort((a, b) => {
    if (sortBy === "match")
      return (b.qualificationScore ?? 0) - (a.qualificationScore ?? 0);
    if (sortBy === "recent") return b._creationTime - a._creationTime;
    return getEngagement(b) - getEngagement(a);
  });

  // Empty state (after loading) - show only if no prospects in any tab
  const showEmptyState = !isLoading && !hasAnyProspects;

  return (
    <div className="flex h-full min-h-0 w-full">
      {/* Left side: Prospects list */}
      <PageLayout
        className={cn(
          "h-full min-h-0 w-full overflow-hidden",
          hasOpenPanel && "hidden border-r md:block"
        )}
      >
        <PageHeader title="Prospects" className="px-4 py-2.5" />
        <PageContent className="flex h-full flex-col p-0">
          <ProspectsToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            className="px-4 pt-4"
          />

          <ScrollArea className="flex-1 px-4 pb-4">
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
                  <p className="font-medium">No prospects yet</p>
                  <p className="mt-1 text-sm">
                    Start prospecting to find your ideal customers
                  </p>
                </div>
              </div>
            ) : sortedProspects.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No prospects in this category
              </p>
            ) : (
              <div className="pb-4">
                <ul className="space-y-3">
                  {sortedProspects.map((prospect) => (
                    <li key={prospect._id}>
                      <ProspectCard
                        prospect={prospect}
                        highlightKeywords={prospect.matchedKeywords}
                        onClick={() => handleProspectClick(prospect._id)}
                      />
                    </li>
                  ))}
                </ul>

                {/* Load More Button */}
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
        </PageContent>
      </PageLayout>

      {/* Right side: Profile panel */}
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
  className?: string;
}

function ProspectsToolbar({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  className,
}: ProspectsToolbarProps) {
  return (
    <div className={className}>
      {/* Search */}
      <div className="relative">
        <SearchIcon className="fill-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
        <Input
          type="search"
          placeholder="Search prospects..."
          size="sm"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs + Filter/Sort */}
      <nav className="mt-3 flex items-center justify-between">
        <Tabs
          value={activeTab}
          onValueChange={(v) => onTabChange(v as TabType)}
        >
          <TabsList size="sm">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} size="sm">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="xs">
            <FilterAltIcon className="mr-1.5 h-4 w-4 fill-current" />
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
