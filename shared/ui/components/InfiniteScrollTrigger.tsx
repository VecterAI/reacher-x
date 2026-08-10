"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui/components/Button";
import { useScrollAreaViewportRef } from "@/shared/ui/components/ScrollArea";
import { Spinner } from "@/shared/ui/components/Spinner";
import { cn } from "@/shared/lib/utils";

const DEFAULT_PRELOAD_DISTANCE = 600;

type InfiniteScrollTriggerProps = {
  hasMore: boolean;
  isLoading: boolean;
  loadMoreError?: boolean;
  onLoadMore: () => void;
  resultCount: number;
  className?: string;
  preloadDistance?: number;
  direction?: "start" | "end";
  loadingLabel?: string;
  loadMoreLabel?: string;
  retryLabel?: string;
  /** Keep the normal path fully automatic; errors still expose retry UI. */
  showKeyboardFallback?: boolean;
};

/**
 * Loads the next page shortly before this sentinel reaches its ScrollArea
 * viewport. Outside a ScrollArea, it observes the browser viewport instead.
 */
function InfiniteScrollTrigger({
  hasMore,
  isLoading,
  loadMoreError = false,
  onLoadMore,
  resultCount,
  className,
  preloadDistance = DEFAULT_PRELOAD_DISTANCE,
  direction = "end",
  loadingLabel = "Loading more results",
  loadMoreLabel = "Load more results",
  retryLabel = "Retry loading more",
  showKeyboardFallback = true,
}: InfiniteScrollTriggerProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollAreaViewportRef = useScrollAreaViewportRef();
  const onLoadMoreRef = useRef(onLoadMore);
  const [observerUnavailable, setObserverUnavailable] = useState(false);

  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    if (!hasMore || isLoading || loadMoreError) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    if (typeof IntersectionObserver === "undefined") {
      setObserverUnavailable(true);
      return;
    }

    let requested = false;
    let animationFrame: number | null = null;
    const root = scrollAreaViewportRef?.current ?? null;
    const requestMore = () => {
      if (requested) return;
      requested = true;
      onLoadMoreRef.current();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        requestMore();
      },
      {
        root,
        rootMargin:
          direction === "start"
            ? `${preloadDistance}px 0px 0px 0px`
            : `0px 0px ${preloadDistance}px 0px`,
        threshold: 0,
      }
    );

    const checkScrollDistance = () => {
      if (animationFrame !== null) return;

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        const remainingDistance =
          direction === "start"
            ? root
              ? root.scrollTop
              : window.scrollY
            : root
              ? root.scrollHeight - root.scrollTop - root.clientHeight
              : document.documentElement.scrollHeight -
                window.scrollY -
                window.innerHeight;

        if (remainingDistance <= preloadDistance) {
          requestMore();
        }
      });
    };
    const scrollTarget: EventTarget = root ?? window;

    observer.observe(sentinel);
    scrollTarget.addEventListener("scroll", checkScrollDistance, {
      passive: true,
    });
    checkScrollDistance();

    return () => {
      observer.disconnect();
      scrollTarget.removeEventListener("scroll", checkScrollDistance);
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [
    hasMore,
    isLoading,
    loadMoreError,
    direction,
    preloadDistance,
    resultCount,
    scrollAreaViewportRef,
  ]);

  const showVisibleFallback = loadMoreError || observerUnavailable;

  return (
    <div
      ref={sentinelRef}
      data-slot="infinite-scroll-trigger"
      data-state={
        loadMoreError
          ? "error"
          : isLoading
            ? "loading"
            : hasMore
              ? "ready"
              : "exhausted"
      }
      className={cn(
        "relative h-px w-full",
        (isLoading || showVisibleFallback) && "h-auto pt-2",
        className
      )}
    >
      {isLoading ? (
        <div
          role="status"
          aria-live="polite"
          aria-label={loadingLabel}
          className="flex justify-center py-2"
        >
          <Spinner variant="circle" className="size-5" />
        </div>
      ) : showVisibleFallback ? (
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="w-full"
          onClick={onLoadMore}
        >
          {loadMoreError ? retryLabel : loadMoreLabel}
        </Button>
      ) : hasMore && showKeyboardFallback ? (
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="sr-only focus:not-sr-only focus:absolute focus:inset-x-0 focus:top-2 focus:z-20 focus:w-full"
          onClick={onLoadMore}
        >
          {loadMoreLabel}
        </Button>
      ) : null}
    </div>
  );
}

export { InfiniteScrollTrigger };
