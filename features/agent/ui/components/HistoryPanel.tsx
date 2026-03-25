/**
 * HistoryPanel
 * Side panel for viewing and managing prospect-specific threads.
 * Uses server-side vector search for semantic message matching.
 * Follows ProspectProfilePanel pattern using PageLayout components.
 */
"use client";

import * as React from "react";
import { useAction, useMutation, usePaginatedQuery } from "convex/react";
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
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import { ThreadCard, type ThreadData } from "./ThreadCard";
import { ThreadCardSkeleton } from "./ThreadCardSkeleton";
import type { ThreadSearchResult } from "@/shared/types/search";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import { useConvexReady } from "@/shared/hooks/useConvexReady";

/** Extended thread data with first message from query */
interface ThreadWithMessage extends ThreadData {
  firstMessage?: string;
}

export interface HistoryPanelProps {
  prospectId: Id<"prospects">;
  currentThreadId?: string;
  onClose: () => void;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  /** When true, disables New (same as agent chat header for archived prospects). */
  prospectArchived?: boolean;
  className?: string;
}

export function HistoryPanel({
  prospectId,
  currentThreadId,
  onClose,
  onSelectThread,
  onNewThread,
  prospectArchived = false,
  className,
}: HistoryPanelProps) {
  const { entitySingular } = useActiveUseCaseLabels();
  const {
    isReady: isConvexReady,
    isLoading: isConvexReadyLoading,
    error: convexReadyError,
  } = useConvexReady();
  const [searchQuery, setSearchQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<
    ThreadSearchResult[]
  >([]);

  const threadsResult = usePaginatedQuery(
    api.chat.listProspectThreadsWithMessages,
    isConvexReady
      ? {
          prospectId,
        }
      : "skip",
    { initialNumItems: 20 }
  );

  // Vector search action
  const searchMessages = useAction(api.chat.searchProspectMessages);

  // Delete thread mutation
  const archiveThread = useMutation(api.chat.archiveThread);

  const handleDelete = async (threadId: string) => {
    if (!isConvexReady) return;
    await archiveThread({ threadId });
  };

  // Perform search when debounced query changes
  React.useEffect(() => {
    if (!isConvexReady || !debouncedQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    searchMessages({ prospectId, query: debouncedQuery, limit: 10 })
      .then((result) => {
        if (!cancelled) {
          // Cast thread to ThreadData since it comes from the same source
          setSearchResults(
            result.threads.map((t: ThreadSearchResult) => ({
              ...t,
              thread: t.thread as ThreadData,
            }))
          );
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("[HistoryPanel] Search error:", error);
          setSearchResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsSearching(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, isConvexReady, prospectId, searchMessages]);

  // Use search results when searching, otherwise show all threads
  const displayedThreads = React.useMemo((): ThreadWithMessage[] => {
    // If actively searching, only show search results (may be empty)
    if (debouncedQuery.trim()) {
      return searchResults.map((r) => r.thread as ThreadWithMessage);
    }
    // No search query - show all threads
    return threadsResult.results as ThreadWithMessage[];
  }, [debouncedQuery, searchResults, threadsResult.results]);

  // Get highlighted match preview for a thread if in search mode
  const getMatchPreview = (threadId: string): React.ReactNode | undefined => {
    if (!debouncedQuery.trim()) return undefined;
    const result = searchResults.find((r) => r.threadId === threadId);
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
  const showSearching = isSearching && searchQuery.trim();
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
      <PageLayout className="flex flex-col">
        <PageHeader
          title={`${entitySingular} thread history`}
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

          {/* Thread list */}
          <ScrollArea className="min-h-0 flex-1" viewportClassName="pb-8">
            {isLoading || showSearching ? (
              <div className="space-y-2">
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
                    firstMessage={thread.firstMessage}
                    matchPreview={getMatchPreview(thread._id)}
                    onSelect={() => onSelectThread(thread._id)}
                    onDelete={() => handleDelete(thread._id)}
                  />
                ))}

                {hasMoreThreads && (
                  <div className="px-4 pt-3 pb-4">
                    <Button
                      size="xs"
                      className="w-full"
                      onClick={() => threadsResult.loadMore(20)}
                      disabled={isLoadingMoreThreads}
                    >
                      {isLoadingMoreThreads ? (
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
    </aside>
  );
}
