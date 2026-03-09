// app/(webapp)/converts/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useQueryWithStatus } from "@/shared/hooks";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { Input } from "@/shared/ui/components/Input";
import { Button } from "@/shared/ui/components/Button";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import {
  ProspectCard,
  ProspectCardSkeleton,
  ProspectPanelRenderer,
  useProspectProfile,
} from "@/features/prospects";
import { cn } from "@/shared/lib/utils";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import { AccountBoxIcon, SearchIcon } from "@/shared/ui/components/icons";

type ProspectSummary = Doc<"prospectSummaries">;
type PaginationStatus =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted";

const PROSPECTS_PER_PAGE = 10;

function matchesProspectSearch(
  prospect: ProspectSummary,
  searchQuery: string
): boolean {
  if (!searchQuery.trim()) {
    return true;
  }

  const query = searchQuery.toLowerCase();
  const searchableText = [
    prospect.displayName,
    prospect.title,
    prospect.briefIntro,
    prospect.profileUrl,
    prospect.twitterUsername,
    prospect.linkedInUsername,
    ...(prospect.matchedKeywords ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(query);
}

export default function ConvertsPage() {
  const router = useRouter();
  const { openProspect, prospectId } = useProspectProfile();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");

  const handleProspectClick = (id: Id<"prospects">) => {
    if (isMobile) {
      router.push(`/prospects/${id}`);
      return;
    }
    openProspect(id);
  };

  const setupStatusQuery = useQueryWithStatus(
    api.workspaces.getWorkspaceSetupStatus
  );
  const setupStatus = setupStatusQuery.data;
  const workspaceId =
    setupStatus?.status === "complete" ? setupStatus.workspace.id : null;

  const prospectsQuery = usePaginatedQuery(
    api.prospectSummaries.listWorkspaceProspectSummaries,
    workspaceId ? { workspaceId, status: "converted" } : "skip",
    { initialNumItems: PROSPECTS_PER_PAGE }
  );

  const convertedProspects = prospectsQuery.results as ProspectSummary[];
  const filteredProspects = useMemo(
    () =>
      convertedProspects.filter((prospect) =>
        matchesProspectSearch(prospect, searchQuery)
      ),
    [convertedProspects, searchQuery]
  );

  const status = prospectsQuery.status as PaginationStatus;
  const isLoading =
    setupStatusQuery.isPending ||
    (workspaceId !== null && status === "LoadingFirstPage");
  const isLoadingMore = status === "LoadingMore";
  const hasMore = status === "CanLoadMore" || status === "LoadingMore";
  const hasOpenPanel = prospectId !== null;
  const showEmptyState = !isLoading && convertedProspects.length === 0;

  return (
    <div className="flex h-full min-h-0 w-full">
      <PageLayout
        className={cn(
          "h-full min-h-0 w-full overflow-hidden",
          hasOpenPanel && "hidden border-r md:block"
        )}
      >
        <PageHeader title="Converts" onBack={() => router.back()} />
        <PageContent className="flex h-full flex-col p-0">
          {setupStatusQuery.isError ? (
            <div className="px-4 pt-4">
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm font-medium">Could not load converts</p>
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
                <div className="relative">
                  <SearchIcon className="fill-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
                  <Input
                    type="search"
                    placeholder="Search converts..."
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
                      <AccountBoxIcon className="fill-muted-foreground mx-auto mb-3 size-12" />
                      <p className="font-medium">No converts yet</p>
                      <p className="mt-1 text-sm">
                        Prospects you convert will appear here
                      </p>
                    </div>
                  </div>
                ) : filteredProspects.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    No converts match your search
                  </p>
                ) : (
                  <div className="pb-4">
                    <ul className="space-y-3">
                      {filteredProspects.map((prospect) => (
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
                      <div className="pt-2 pb-4">
                        <Button
                          size="xs"
                          className="w-full"
                          onClick={() =>
                            prospectsQuery.loadMore(PROSPECTS_PER_PAGE)
                          }
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
