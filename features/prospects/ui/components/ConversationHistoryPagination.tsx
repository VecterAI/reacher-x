"use client";

import * as React from "react";
import { InfiniteScrollTrigger } from "@/shared/ui/components/InfiniteScrollTrigger";
import { useScrollAreaViewportRef } from "@/shared/ui/components/ScrollArea";

type ConversationHistoryPaginationProps = {
  conversationKey: string;
  messageCount: number;
  hasMore: boolean;
  isLoading: boolean;
  loadMoreError?: boolean;
  onLoadMore: () => void;
};

type PendingScrollAnchor = {
  scrollHeight: number;
  scrollTop: number;
};

/**
 * Keeps a chat on its latest messages while preserving the visible message
 * when an older provider page is prepended.
 */
function ConversationHistoryPagination({
  conversationKey,
  messageCount,
  hasMore,
  isLoading,
  loadMoreError = false,
  onLoadMore,
}: ConversationHistoryPaginationProps) {
  const viewportRef = useScrollAreaViewportRef();
  const initializedConversationRef = React.useRef<string | null>(null);
  const pendingAnchorRef = React.useRef<PendingScrollAnchor | null>(null);

  React.useLayoutEffect(() => {
    const viewport = viewportRef?.current;
    if (!viewport) return;

    if (initializedConversationRef.current !== conversationKey) {
      initializedConversationRef.current = conversationKey;
      pendingAnchorRef.current = null;

      if (messageCount > 0) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    } else if (pendingAnchorRef.current && !isLoading) {
      const pendingAnchor = pendingAnchorRef.current;
      viewport.scrollTop =
        pendingAnchor.scrollTop +
        (viewport.scrollHeight - pendingAnchor.scrollHeight);
      pendingAnchorRef.current = null;
    }
  }, [conversationKey, isLoading, messageCount, viewportRef]);

  const handleLoadMore = React.useCallback(() => {
    const viewport = viewportRef?.current;
    if (viewport) {
      pendingAnchorRef.current = {
        scrollHeight: viewport.scrollHeight,
        scrollTop: viewport.scrollTop,
      };
    }
    onLoadMore();
  }, [onLoadMore, viewportRef]);

  if (!hasMore && !isLoading && !loadMoreError) return null;

  return (
    <InfiniteScrollTrigger
      direction="start"
      preloadDistance={160}
      hasMore={hasMore}
      isLoading={isLoading}
      loadMoreError={loadMoreError}
      onLoadMore={handleLoadMore}
      resultCount={messageCount}
      showKeyboardFallback={false}
      loadingLabel="Loading earlier messages"
      loadMoreLabel="Load earlier messages"
      retryLabel="Retry loading earlier messages"
    />
  );
}

export { ConversationHistoryPagination };
