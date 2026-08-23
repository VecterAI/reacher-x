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
import { Spinner } from "@/shared/ui/components/Spinner";
import { KeyboardArrowDownIcon } from "@/shared/ui/components/icons";
import { cn } from "@/shared/lib/utils";

const HISTORY_PRELOAD_DISTANCE_PX = 160;

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
 * the latest message, user-intent tracking, resize following, and prepend
 * anchoring. An observer on the first real message only requests the next page.
 */
export function ConversationMessageViewport({
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

  React.useEffect(() => {
    requestedHistoryKeyRef.current = null;
  }, [conversationKey]);

  const requestOlderMessages = React.useCallback(() => {
    if (
      !hasMore ||
      !historyRequestKey ||
      isLoadingOlder ||
      loadOlderError ||
      requestedHistoryKeyRef.current === historyRequestKey
    ) {
      return;
    }
    requestedHistoryKeyRef.current = historyRequestKey;
    onLoadOlder();
  }, [hasMore, historyRequestKey, isLoadingOlder, loadOlderError, onLoadOlder]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content || !hasMore || !historyRequestKey) return;

    const firstMessage = content.querySelector<HTMLElement>(
      ":scope > [data-message-id]"
    );
    if (!firstMessage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          requestOlderMessages();
        }
      },
      {
        root: viewport,
        rootMargin: `${HISTORY_PRELOAD_DISTANCE_PX}px 0px 0px`,
      }
    );
    observer.observe(firstMessage);
    return () => observer.disconnect();
  }, [hasMore, historyRequestKey, messageCount, requestOlderMessages]);

  const handleRetry = React.useCallback(() => {
    requestedHistoryKeyRef.current = null;
    onLoadOlder();
  }, [onLoadOlder]);

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
          className="overflow-x-clip"
        >
          <MessageScrollerContent
            ref={contentRef}
            className={cn("gap-0 px-4 pt-4 pb-16", contentClassName)}
          >
            {children}
          </MessageScrollerContent>
        </MessageScrollerViewport>

        {isLoadingOlder ? (
          <div
            className="bg-background/90 border-border pointer-events-none absolute top-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-sm backdrop-blur"
            role="status"
            aria-label="Loading earlier messages"
          >
            <Spinner variant="circle" className="size-3.5" />
            Loading earlier messages
          </div>
        ) : loadOlderError ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="absolute top-2 left-1/2 z-20 -translate-x-1/2 shadow-sm"
            onClick={handleRetry}
          >
            Retry earlier messages
          </Button>
        ) : null}

        <MessageScrollerButton
          variant="outline"
          className="shadow-sm"
          aria-label="Scroll to latest message"
        >
          <KeyboardArrowDownIcon className="size-4 fill-current" />
          <span className="sr-only">Scroll to latest message</span>
        </MessageScrollerButton>
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
