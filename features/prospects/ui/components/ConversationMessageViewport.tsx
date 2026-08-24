"use client";

import * as React from "react";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from "@/shared/ui/components/MessageScroller";
import { Button } from "@/shared/ui/components/Button";
import { Badge } from "@/shared/ui/components/Badge";
import { Spinner } from "@/shared/ui/components/Spinner";
import { KeyboardArrowDownIcon } from "@/shared/ui/components/icons";
import { cn } from "@/shared/lib/utils";
import {
  INITIAL_CONVERSATION_HISTORY_PAGE_BUDGET,
  isConversationViewportScrollable,
  shouldRequestInitialConversationHistory,
  shouldRequestOlderConversationHistory,
} from "@/features/prospects/lib/conversationHistoryHelpers";

const INITIAL_HYDRATION_FALLBACK_MS = 5_000;

type ConversationMessageViewportProps = {
  conversationKey: string;
  messageCount: number;
  historyRequestKey?: string;
  hasMore: boolean;
  isLoadingOlder: boolean;
  loadOlderError?: boolean;
  onLoadOlder: () => void;
  scrollToLatestRequest?: number;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

function ConversationScrollController({
  request,
}: {
  request: number | undefined;
}) {
  const { scrollToEnd } = useMessageScroller();
  const previousRequestRef = React.useRef(request);

  React.useEffect(() => {
    if (request === undefined || previousRequestRef.current === request) {
      return;
    }

    previousRequestRef.current = request;
    const frame = window.requestAnimationFrame(() => {
      scrollToEnd({ behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [request, scrollToEnd]);

  return null;
}

/**
 * Shared DM history viewport. The shadcn scroller exclusively owns opening at
 * the latest message, resize following, and prepend anchoring. Initial pages
 * are committed behind one stable loading state; subsequent pages require a
 * genuine upward reader interaction.
 */
export function ConversationMessageViewport({
  conversationKey,
  ...props
}: ConversationMessageViewportProps) {
  return (
    <ConversationMessageViewportSession
      key={conversationKey}
      conversationKey={conversationKey}
      {...props}
    />
  );
}

function ConversationMessageViewportSession({
  conversationKey,
  messageCount,
  historyRequestKey,
  hasMore,
  isLoadingOlder,
  loadOlderError = false,
  onLoadOlder,
  scrollToLatestRequest,
  children,
  className,
  contentClassName,
}: ConversationMessageViewportProps) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const requestedHistoryKeyRef = React.useRef<string | null>(null);
  const initialRequestsStartedRef = React.useRef(0);
  const previousScrollTopRef = React.useRef<number | null>(null);
  const hasOlderHistoryIntentRef = React.useRef(false);
  const isPointerActiveRef = React.useRef(false);
  const [initialHydrationComplete, setInitialHydrationComplete] =
    React.useState(false);
  const [isViewportScrollable, setIsViewportScrollable] = React.useState(false);

  const requestOlderMessages = React.useCallback((): boolean => {
    if (
      !hasMore ||
      !historyRequestKey ||
      isLoadingOlder ||
      loadOlderError ||
      requestedHistoryKeyRef.current === historyRequestKey
    ) {
      return false;
    }
    requestedHistoryKeyRef.current = historyRequestKey;
    hasOlderHistoryIntentRef.current = false;
    onLoadOlder();
    return true;
  }, [hasMore, historyRequestKey, isLoadingOlder, loadOlderError, onLoadOlder]);

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const isScrollable = isConversationViewportScrollable({
      scrollHeight: viewport.scrollHeight,
      clientHeight: viewport.clientHeight,
    });
    setIsViewportScrollable((current) =>
      current === isScrollable ? current : isScrollable
    );
    previousScrollTopRef.current = viewport.scrollTop;

    if (initialHydrationComplete || isLoadingOlder) return;

    if (
      shouldRequestInitialConversationHistory({
        isScrollable,
        hasMore,
        historyRequestKey,
        isLoading: isLoadingOlder,
        hasError: loadOlderError,
        requestsStarted: initialRequestsStartedRef.current,
      })
    ) {
      const requested = requestOlderMessages();
      if (requested) {
        initialRequestsStartedRef.current += 1;
        return;
      }
    }

    setInitialHydrationComplete(true);
  }, [
    hasMore,
    historyRequestKey,
    initialHydrationComplete,
    isLoadingOlder,
    loadOlderError,
    messageCount,
    requestOlderMessages,
  ]);

  React.useEffect(() => {
    if (initialHydrationComplete) return;
    const timeoutId = window.setTimeout(
      () => setInitialHydrationComplete(true),
      INITIAL_HYDRATION_FALLBACK_MS
    );
    return () => window.clearTimeout(timeoutId);
  }, [initialHydrationComplete]);

  const requestOlderFromUserIntent = React.useCallback(
    (viewport: HTMLDivElement) => {
      if (
        shouldRequestOlderConversationHistory({
          hasUserIntent: hasOlderHistoryIntentRef.current,
          scrollTop: viewport.scrollTop,
          hasMore,
          historyRequestKey,
          isLoading: isLoadingOlder,
          hasError: loadOlderError,
        })
      ) {
        requestOlderMessages();
      }
    },
    [
      hasMore,
      historyRequestKey,
      isLoadingOlder,
      loadOlderError,
      requestOlderMessages,
    ]
  );

  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const viewport = event.currentTarget;
      const previousScrollTop = previousScrollTopRef.current;
      if (
        previousScrollTop !== null &&
        viewport.scrollTop < previousScrollTop - 1 &&
        isPointerActiveRef.current
      ) {
        hasOlderHistoryIntentRef.current = true;
      }
      previousScrollTopRef.current = viewport.scrollTop;
      requestOlderFromUserIntent(viewport);
    },
    [requestOlderFromUserIntent]
  );

  const handleWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (event.deltaY >= 0) return;
      hasOlderHistoryIntentRef.current = true;
      requestOlderFromUserIntent(event.currentTarget);
    },
    [requestOlderFromUserIntent]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!["ArrowUp", "Home", "PageUp"].includes(event.key)) return;
      hasOlderHistoryIntentRef.current = true;
      requestOlderFromUserIntent(event.currentTarget);
    },
    [requestOlderFromUserIntent]
  );

  const handleRetry = React.useCallback(() => {
    requestedHistoryKeyRef.current = null;
    onLoadOlder();
  }, [onLoadOlder]);

  const handleManualLoadOlder = React.useCallback(() => {
    requestedHistoryKeyRef.current = null;
    requestOlderMessages();
  }, [requestOlderMessages]);

  const isInitialHistoryLoading = !initialHydrationComplete;
  const showManualLoadOlder =
    initialHydrationComplete &&
    !isViewportScrollable &&
    initialRequestsStartedRef.current >=
      INITIAL_CONVERSATION_HISTORY_PAGE_BUDGET &&
    hasMore &&
    Boolean(historyRequestKey) &&
    !isLoadingOlder &&
    !loadOlderError;

  return (
    <MessageScrollerProvider
      key={conversationKey}
      autoScroll
      defaultScrollPosition="end"
    >
      <MessageScroller className={cn("relative min-h-0 flex-1", className)}>
        <ConversationScrollController request={scrollToLatestRequest} />
        <MessageScrollerViewport
          ref={viewportRef}
          preserveScrollOnPrepend
          aria-label="Conversation messages"
          tabIndex={0}
          onScroll={handleScroll}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
          onPointerDown={() => {
            isPointerActiveRef.current = true;
          }}
          onPointerUp={() => {
            isPointerActiveRef.current = false;
          }}
          onPointerCancel={() => {
            isPointerActiveRef.current = false;
          }}
          className="overflow-x-clip focus-visible:outline-hidden"
        >
          <MessageScrollerContent
            ref={contentRef}
            aria-hidden={isInitialHistoryLoading}
            className={cn(
              "gap-0 px-4 pt-4 pb-16",
              isInitialHistoryLoading && "invisible",
              contentClassName
            )}
          >
            {children}
          </MessageScrollerContent>
        </MessageScrollerViewport>

        {isInitialHistoryLoading ? (
          <div
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            role="status"
            aria-label="Loading conversation"
          >
            <Spinner variant="circle" className="size-5" />
          </div>
        ) : isLoadingOlder ? (
          <Badge
            variant="outline"
            className="bg-background/90 border-border pointer-events-none absolute top-2 left-1/2 z-20 -translate-x-1/2 gap-2 px-3 py-1.5 font-normal backdrop-blur"
            role="status"
            aria-live="polite"
            aria-label="Loading earlier messages"
          >
            <Spinner variant="circle" className="size-3.5" />
            Loading earlier messages
          </Badge>
        ) : loadOlderError ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="absolute top-2 left-1/2 z-20 -translate-x-1/2"
            onClick={handleRetry}
          >
            Retry earlier messages
          </Button>
        ) : showManualLoadOlder ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="absolute top-2 left-1/2 z-20 -translate-x-1/2"
            onClick={handleManualLoadOlder}
          >
            Load earlier messages
          </Button>
        ) : null}

        {isInitialHistoryLoading ? null : (
          <MessageScrollerButton
            variant="outline"
            aria-label="Scroll to latest message"
          >
            <KeyboardArrowDownIcon className="size-4 fill-current" />
            <span className="sr-only">Scroll to latest message</span>
          </MessageScrollerButton>
        )}
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
