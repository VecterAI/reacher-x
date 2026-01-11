// app/(webapp)/archives/page.tsx
/* eslint-disable react-hooks/refs */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { Input } from "@/shared/ui/components/Input";
import { Button } from "@/shared/ui/components/Button";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";

// Pagination constants (matching RelevantActivityTab)
const PROSPECTS_PER_PAGE = 10;
import {
  useProspectProfile,
  ProspectPanelRenderer,
  ProspectCard,
  ProspectCardSkeleton,
} from "@/features/prospects";
import { cn } from "@/shared/lib/utils";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import { ArchiveIcon, SearchIcon } from "@/shared/ui/components/icons";

export default function ArchivesPage() {
  const router = useRouter();
  const { openProspect, prospectId } = useProspectProfile();
  const isMobile = useIsMobile();

  // Local state
  const [searchQuery, setSearchQuery] = useState("");
  const [limit, setLimit] = useState(PROSPECTS_PER_PAGE);

  // Track the limit we're loading for (to detect "load more" vs initial load)
  const [loadingLimit, setLoadingLimit] = useState<number | null>(null);

  // Cache last successful page result so list doesn't disappear while loading more
  const cachedProspectsRef = useRef<Doc<"prospects">[]>([]);
  const cachedHasMoreRef = useRef(false);

  // Handle prospect card click: route to page on mobile, open panel on desktop
  const handleProspectClick = (id: Id<"prospects">) => {
    if (isMobile) {
      router.push(`/prospects/${id}`);
    } else {
      openProspect(id);
    }
  };

  // Get workspace setup status
  const setupStatus = useQuery(api.workspaces.getWorkspaceSetupStatus);
  const workspaceId =
    setupStatus?.status === "complete" ? setupStatus.workspace.id : null;

  // Query for archived prospects only (server-side filtering via index)
  const prospectsData = useQuery(
    api.prospects.getWorkspaceProspects,
    workspaceId ? { workspaceId, status: "archived", limit } : "skip"
  );

  // Compute loading more state (true when we clicked load more AND data hasn't arrived yet)
  const isLoadingMore = loadingLimit !== null && prospectsData === undefined;

  // Update cache when data is available (no setState here)
  useEffect(() => {
    if (!prospectsData) return;
    cachedProspectsRef.current = prospectsData.prospects as Doc<"prospects">[];
    cachedHasMoreRef.current = prospectsData.hasMore ?? false;
  }, [prospectsData]);

  // Only show skeletons on initial load (not a "load more" operation)
  const isLoading =
    setupStatus === undefined ||
    (workspaceId &&
      prospectsData === undefined &&
      cachedProspectsRef.current.length === 0);

  const hasOpenPanel = prospectId !== null;

  // Get prospects data (fallback to cache while loading more)
  const archivedProspects = (prospectsData?.prospects ??
    cachedProspectsRef.current) as Doc<"prospects">[];
  const hasMore = prospectsData?.hasMore ?? cachedHasMoreRef.current;

  // Handle "Load more" click
  const handleLoadMore = () => {
    const newLimit = limit + PROSPECTS_PER_PAGE;
    setLoadingLimit(newLimit);
    setLimit(newLimit);
  };

  // Search filter
  const filteredProspects = archivedProspects.filter((p) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const keywords = p.matchedKeywords?.join(" ").toLowerCase() ?? "";
    const data = p.data as Record<string, unknown> | undefined;
    const text = String(
      data?.text ?? data?.full_text ?? data?.content ?? ""
    ).toLowerCase();
    return keywords.includes(query) || text.includes(query);
  });

  const showEmptyState = !isLoading && archivedProspects.length === 0;

  return (
    <div className="flex h-full min-h-0 w-full">
      {/* Left side: Archives list */}
      <PageLayout
        className={cn(
          "h-full min-h-0 w-full overflow-hidden",
          hasOpenPanel && "hidden border-r md:block"
        )}
      >
        <PageHeader title="Archives" onBack={() => router.back()} />
        <PageContent className="flex h-full flex-col p-0">
          {/* Search */}
          <div className="mb-0 px-4 pt-4">
            <div className="relative">
              <SearchIcon className="fill-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
              <Input
                type="search"
                placeholder="Search archives..."
                size="sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1 px-4 pt-4 pb-4">
            {isLoading ? (
              <div className="space-y-3 pb-4">
                <ProspectCardSkeleton />
                <ProspectCardSkeleton />
                <ProspectCardSkeleton />
              </div>
            ) : showEmptyState ? (
              <div className="flex h-full items-center justify-center py-16">
                <div className="text-muted-foreground text-center">
                  <ArchiveIcon className="fill-muted-foreground mx-auto mb-3 size-12" />
                  <p className="font-medium">No archived prospects</p>
                  <p className="mt-1 text-sm">
                    Archived prospects will appear here
                  </p>
                </div>
              </div>
            ) : filteredProspects.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No archived prospects match your search
              </p>
            ) : (
              <div className="pb-4">
                <ul className="space-y-3">
                  {filteredProspects.map((prospect) => (
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
