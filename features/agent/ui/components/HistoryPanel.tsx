/**
 * HistoryPanel
 * Side panel for viewing and managing prospect-specific threads.
 * Uses server-side vector search for semantic message matching.
 * Follows ProspectProfilePanel pattern using PageLayout components.
 */
"use client";

import * as React from "react";
import { useAction, useMutation, usePaginatedQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn, highlightText, HIGHLIGHT_PRESETS } from "@/shared/lib/utils";
import { useDebouncedValue } from "@/shared/lib/utils/useDebouncedValue";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Input } from "@/shared/ui/components/Input";
import { Button } from "@/shared/ui/components/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/components/Tooltip";
import { SearchIcon, AddIcon } from "@/shared/ui/components/icons";
import { InfiniteScrollTrigger } from "@/shared/ui/components/InfiniteScrollTrigger";
import { ThreadCard, type ThreadData } from "./ThreadCard";
import { ThreadCardSkeleton } from "./ThreadCardSkeleton";
import { WorkspacePlanLimitAlert } from "@/features/billing/ui/components/WorkspacePlanLimitAlert";
import type { ThreadSearchResult } from "@/shared/types/search";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import { useConvexReady } from "@/shared/hooks/useConvexReady";
import { logger } from "@/shared/lib/logger";

/** Extended thread data with first message from query */
interface ThreadWithMessage extends ThreadData {
  firstMessage?: string;
}

interface SearchState {
  query: string;
  results: ThreadSearchResult[];
}

const historyPanelLogger = logger.withScope("HistoryPanel");

function dedupeThreadsById<T extends ThreadWithMessage>(threads: T[]): T[] {
  const seenThreadIds = new Set<string>();
  return threads.filter((thread) => {
    if (seenThreadIds.has(thread._id)) {
      return false;
    }

    seenThreadIds.add(thread._id);
    return true;
  });
}

export interface HistoryPanelProps {
  scope:
    | {
        kind: "prospect";
        prospectId: Id<"prospects">;
        prospectArchived?: boolean;
      }
    | {
        kind: "workspace";
        workspaceId: Id<"workspaces">;
      };
  currentThreadId?: string;
  onClose: () => void;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  onDeleteCurrentThread?: () => void;
  className?: string;
  layoutClassName?: string;
}

export function HistoryPanel({
  scope,
  currentThreadId,
  onClose,
  onSelectThread,
  onNewThread,
  onDeleteCurrentThread,
  className,
  layoutClassName,
}: HistoryPanelProps) {
  const { entitySingular } = useActiveUseCaseLabels();
  const {
    isReady: isConvexReady,
    isLoading: isConvexReadyLoading,
    error: convexReadyError,
  } = useConvexReady();
  const [searchQuery, setSearchQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const [searchState, setSearchState] = React.useState<SearchState>({
    query: "",
    results: [],
  });
  const [deletingThreadId, setDeletingThreadId] = React.useState<string | null>(
    null
  );
  const prospectArchived =
    scope.kind === "prospect" ? (scope.prospectArchived ?? false) : false;
  const activeProspectId =
    scope.kind === "prospect" ? scope.prospectId : undefined;
  const activeWorkspaceId =
    scope.kind === "workspace" ? scope.workspaceId : undefined;

  const prospectThreadsResult = usePaginatedQuery(
    api.chat.listProspectThreadsWithMessages,
    isConvexReady && scope.kind === "prospect"
      ? {
          prospectId: scope.prospectId,
        }
      : "skip",
    { initialNumItems: 20 }
  );
  const workspaceThreadsResult = usePaginatedQuery(
    api.chat.listWorkspaceThreadsWithMessages,
    isConvexReady && scope.kind === "workspace"
      ? {
          workspaceId: scope.workspaceId,
        }
      : "skip",
    { initialNumItems: 20 }
  );
  const threadsResult =
    scope.kind === "prospect" ? prospectThreadsResult : workspaceThreadsResult;

  // Vector search action
  const searchProspectMessages = useAction(api.chat.searchProspectMessages);
  const searchWorkspaceMessages = useAction(api.chat.searchWorkspaceMessages);

  // Delete thread mutation
  const deleteThread = useMutation(api.chat.deleteThread);

  const handleDelete = async (threadId: string) => {
    if (!isConvexReady) {
      toast.error("Thread history is still loading", {
        description: "Please try again in a moment.",
      });
      return;
    }

    setDeletingThreadId(threadId);

    const deletePromise = deleteThread({ threadId }).then(() => {
      if (threadId === currentThreadId) {
        onDeleteCurrentThread?.();
      }

      setSearchState((current) => ({
        ...current,
        results: current.results.filter(
          (result) => result.threadId !== threadId
        ),
      }));
    });

    toast.promise(deletePromise, {
      loading: "Deleting thread...",
      success: "Thread deleted",
      error: "Failed to delete thread",
    });

    try {
      await deletePromise;
    } finally {
      setDeletingThreadId((current) => (current === threadId ? null : current));
    }
  };

  // Perform search when debounced query changes
  React.useEffect(() => {
    if (!isConvexReady || !debouncedQuery.trim()) {
      return;
    }

    let cancelled = false;

    const runSearch =
      scope.kind === "prospect"
        ? searchProspectMessages({
            prospectId: activeProspectId!,
            query: debouncedQuery,
            limit: 10,
          })
        : searchWorkspaceMessages({
            workspaceId: activeWorkspaceId,
            query: debouncedQuery,
            limit: 10,
          });

    runSearch
      .then((result) => {
        if (!cancelled) {
          // Cast thread to ThreadData since it comes from the same source
          setSearchState({
            query: debouncedQuery,
            results: result.threads.map((t: ThreadSearchResult) => ({
              ...t,
              thread: t.thread as ThreadData,
            })),
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          historyPanelLogger.error("Search error", error);
          setSearchState({
            query: debouncedQuery,
            results: [],
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    debouncedQuery,
    isConvexReady,
    scope.kind,
    activeProspectId,
    activeWorkspaceId,
    searchProspectMessages,
    searchWorkspaceMessages,
  ]);

  // Use search results when searching, otherwise show all threads
  const displayedThreads = React.useMemo((): ThreadWithMessage[] => {
    // If actively searching, only show search results (may be empty)
    if (debouncedQuery.trim()) {
      return dedupeThreadsById(
        searchState.results.map((r) => r.thread as ThreadWithMessage)
      );
    }
    // No search query - show all threads
    return dedupeThreadsById(threadsResult.results as ThreadWithMessage[]);
  }, [debouncedQuery, searchState.results, threadsResult.results]);

  // Get highlighted match preview for a thread if in search mode
  const getMatchPreview = (threadId: string): React.ReactNode | undefined => {
    if (!debouncedQuery.trim()) return undefined;
    const result = searchState.results.find((r) => r.threadId === threadId);
    if (!result?.matchPreview) return undefined;

    // Use shared highlighting utility
    return highlightText(
      result.matchPreview,
      debouncedQuery,
      HIGHLIGHT_PRESETS.SUBTLE
    ).highlightedText;
  };

  const isLoading =
    isConvexReadyLoading ||
    (isConvexReady && threadsResult.status === "LoadingFirstPage");
  const showSearching =
    Boolean(debouncedQuery.trim()) &&
    isConvexReady &&
    searchState.query !== debouncedQuery;
  const hasMoreThreads =
    !debouncedQuery.trim() &&
    (threadsResult.status === "CanLoadMore" ||
      threadsResult.status === "LoadingMore");
  const isLoadingMoreThreads = threadsResult.status === "LoadingMore";

  return (
    <aside
      className={cn(
        "flex h-full w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout className={cn("flex flex-col", layoutClassName)}>
        <PageHeader
          title={
            scope.kind === "prospect"
              ? `${entitySingular} thread history`
              : "Workspace agent history"
          }
          onBack={onClose}
          actions={
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="xs"
                      onClick={onNewThread}
                      variant="ghost"
                      disabled={prospectArchived}
                    >
                      <AddIcon className="fill-current" />
                      New
                    </Button>
                  </span>
                </TooltipTrigger>
                {prospectArchived && (
                  <TooltipContent>
                    Unarchive this profile to start a new thread
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          }
        />
        <PageContent className="flex min-h-0 flex-1 flex-col">
          {/* Thread list */}
          <ScrollArea className="min-h-0 flex-1" viewportClassName="pb-8">
            <WorkspacePlanLimitAlert className="mx-4 mt-4" />

            {/* Search */}
            <div className="mt-4 mb-0 px-4">
              <div className="relative">
                <SearchIcon className="fill-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  placeholder="Search threads..."
                  size="sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {isLoading || showSearching ? (
              <div
                aria-busy="true"
                aria-live="polite"
                aria-label="Loading thread history"
              >
                {[1, 2, 3].map((i) => (
                  <ThreadCardSkeleton key={i} />
                ))}
              </div>
            ) : convexReadyError ? (
              <div className="px-4 py-8 text-center text-sm">
                <p className="font-medium">Could not load thread history</p>
                <p className="text-muted-foreground mt-1">
                  {convexReadyError.message || "Please try again."}
                </p>
              </div>
            ) : displayedThreads.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {searchQuery.trim() ? "No matching threads" : "No threads yet"}
              </p>
            ) : (
              <div>
                {displayedThreads.map((thread) => (
                  <ThreadCard
                    key={thread._id}
                    thread={thread as ThreadData}
                    isActive={thread._id === currentThreadId}
                    isDeleting={thread._id === deletingThreadId}
                    firstMessage={thread.firstMessage}
                    matchPreview={getMatchPreview(thread._id)}
                    onSelect={() => onSelectThread(thread._id)}
                    onDelete={() => handleDelete(thread._id)}
                  />
                ))}

                <InfiniteScrollTrigger
                  hasMore={hasMoreThreads}
                  isLoading={isLoadingMoreThreads}
                  onLoadMore={() => threadsResult.loadMore(20)}
                  resultCount={displayedThreads.length}
                  className="mx-4 pt-3 pb-4"
                  loadingLabel="Loading more thread history"
                  loadMoreLabel="Load more thread history"
                  retryLabel="Retry loading thread history"
                />
              </div>
            )}
          </ScrollArea>
        </PageContent>
      </PageLayout>
    </aside>
  );
}
