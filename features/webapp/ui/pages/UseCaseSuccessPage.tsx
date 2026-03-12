"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  useActiveUseCaseLabels,
  useQueryWithStatus,
  useWorkspace,
} from "@/shared/hooks";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { SearchInput } from "@/features/search/ui/components/SearchInput";
import { Button } from "@/shared/ui/components/Button";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import {
  ProspectCard,
  ProspectCardSkeleton,
  ProspectPanelRenderer,
  useProspectProfile,
} from "@/features/prospects";
import { matchesProspectSearch } from "@/features/prospects/lib/matchesProspectSearch";
import { cn } from "@/shared/lib/utils";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import { AccountBoxIcon } from "@/shared/ui/components/icons";

type ProspectSummary = Doc<"prospectSummaries">;
type PaginationStatus =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted";

const PROSPECTS_PER_PAGE = 10;

interface UseCaseSuccessPageProps {
  slug: string;
}

export function UseCaseSuccessPage({ slug }: UseCaseSuccessPageProps) {
  const router = useRouter();
  const { entitySingular, pageLabels, routes } = useActiveUseCaseLabels();
  const { isLoading: isWorkspaceLoading } = useWorkspace();
  const { openProspect, prospectId } = useProspectProfile();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const entitySingularLower = entitySingular.toLowerCase();
  const successLabelLower = pageLabels.converts.toLowerCase();
  const successEmptyDescription = `When a ${entitySingularLower} reaches ${successLabelLower}, it will appear here.`;
  const isCanonicalRoute = slug === routes.successSlug;

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

  if (!isWorkspaceLoading && !isCanonicalRoute) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 w-full">
      <PageLayout
        className={cn(
          "h-full min-h-0 w-full overflow-hidden",
          hasOpenPanel && "hidden border-r md:block"
        )}
      >
        <PageHeader title={pageLabels.converts} onBack={() => router.back()} />
        <PageContent className="flex h-full flex-col p-0">
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
                <SearchInput
                  defaultValue={searchQuery}
                  onQueryChange={setSearchQuery}
                  placeholder={`Search ${successLabelLower}...`}
                  showExactMatch={false}
                />
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
                      <p className="font-medium">No {successLabelLower} yet</p>
                      <p className="mt-1 text-sm">{successEmptyDescription}</p>
                    </div>
                  </div>
                ) : filteredProspects.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    No {successLabelLower} match your search
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
