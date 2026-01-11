/**
 * HistoryPanel
 * Side panel for viewing and managing prospect-specific threads.
 * Uses server-side vector search for semantic message matching.
 * Follows ProspectProfilePanel pattern using PageLayout components.
 */
"use client";

import * as React from "react";
import { useQuery, useMutation, useAction } from "convex/react";
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
import { SearchIcon, AddIcon } from "@/shared/ui/components/icons";
import { ThreadCard, type ThreadData } from "./ThreadCard";
import { ThreadCardSkeleton } from "./ThreadCardSkeleton";
import type { ThreadSearchResult } from "@/shared/types/search";

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
  className?: string;
}

export function HistoryPanel({
  prospectId,
  currentThreadId,
  onClose,
  onSelectThread,
  onNewThread,
  className,
}: HistoryPanelProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<
    ThreadSearchResult[]
  >([]);

  // Fetch all prospect threads with first messages (base list)
  const threadsResult = useQuery(api.chat.listProspectThreadsWithMessages, {
    prospectId,
    paginationOpts: { numItems: 50, cursor: null },
  });

  // Vector search action
  const searchMessages = useAction(api.chat.searchProspectMessages);

  // Delete thread mutation
  const archiveThread = useMutation(api.chat.archiveThread);

  const handleDelete = async (threadId: string) => {
    await archiveThread({ threadId });
  };

  // Perform search when debounced query changes
  React.useEffect(() => {
    if (!debouncedQuery.trim()) {
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
            result.threads.map((t) => ({
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
  }, [debouncedQuery, prospectId, searchMessages]);

  // Use search results when searching, otherwise show all threads
  const threads = threadsResult?.page;
  const displayedThreads = React.useMemo((): ThreadWithMessage[] => {
    // If actively searching, only show search results (may be empty)
    if (debouncedQuery.trim()) {
      return searchResults.map((r) => r.thread as ThreadWithMessage);
    }
    // No search query - show all threads
    return (threads ?? []) as ThreadWithMessage[];
  }, [threads, debouncedQuery, searchResults]);

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

  const isLoading = threadsResult === undefined;
  const showSearching = isSearching && searchQuery.trim();

  return (
    <aside
      className={cn(
        "flex h-full w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout>
        <PageHeader
          title="Prospect thread history"
          onBack={onClose}
          actions={
            <Button size="xs" onClick={onNewThread} variant="ghost">
              <AddIcon className="fill-current" />
              New
            </Button>
          }
        />
        <PageContent>
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
          <ScrollArea className="h-[calc(100dvh-10rem)]">
            {isLoading || showSearching ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <ThreadCardSkeleton key={i} />
                ))}
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
              </div>
            )}
          </ScrollArea>
        </PageContent>
      </PageLayout>
    </aside>
  );
}
