/**
 * PainSolutionGrid
 * Two-column grid showing pain points and matched solutions.
 * Pain points are clickable to view evidence posts.
 */
"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";

export interface PainPoint {
  pain: string;
  solution?: string;
  evidencePosts?: unknown[];
}

export interface PainSolutionGridProps {
  /** List of pain points with solutions */
  painPoints: PainPoint[];
  /** Handler when a pain point is clicked (opens evidence panel) */
  onPainClick?: (painPoint: PainPoint, index: number) => void;
  /** Additional className */
  className?: string;
}

const DEFAULT_VISIBLE_COUNT = 2;

function useExpandableClamp(text: string, expanded: boolean) {
  const textRef = React.useRef<HTMLSpanElement | null>(null);
  const [canExpand, setCanExpand] = React.useState(false);

  React.useEffect(() => {
    const node = textRef.current;
    if (!node || expanded) {
      return;
    }

    const measure = () => {
      const currentNode = textRef.current;
      if (!currentNode) {
        return;
      }

      setCanExpand(currentNode.scrollHeight > currentNode.clientHeight + 1);
    };

    measure();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => measure())
        : null;
    resizeObserver?.observe(node);
    window.addEventListener("resize", measure);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [expanded, text]);

  return {
    canExpand,
    textRef,
  };
}

function ExpandableClampText({
  text,
  expanded,
  onToggle,
  className,
  textButtonClassName,
  onTextClick,
}: {
  text: string;
  expanded: boolean;
  onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  textButtonClassName?: string;
  onTextClick?: () => void;
}) {
  const { canExpand, textRef } = useExpandableClamp(text, expanded);
  const textContent = (
    <span ref={textRef} className={cn(className, !expanded && "line-clamp-2")}>
      {text}
    </span>
  );

  return (
    <>
      {onTextClick ? (
        <button
          type="button"
          onClick={onTextClick}
          className={cn("group block w-full text-left", textButtonClassName)}
        >
          {textContent}
        </button>
      ) : (
        textContent
      )}
      {canExpand || expanded ? (
        <Button
          variant="link"
          size="xs"
          className="mt-1 h-auto px-0 text-xs"
          onClick={onToggle}
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      ) : null}
    </>
  );
}

export function PainSolutionGrid({
  painPoints,
  onPainClick,
  className,
}: PainSolutionGridProps) {
  const [showAll, setShowAll] = React.useState(false);
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(
    () => new Set()
  );

  if (!painPoints || painPoints.length === 0) {
    return null;
  }

  const visiblePains = showAll
    ? painPoints
    : painPoints.slice(0, DEFAULT_VISIBLE_COUNT);
  const hasMore = painPoints.length > DEFAULT_VISIBLE_COUNT;
  const toggleExpandedItem = (key: string) => {
    setExpandedItems((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="grid grid-cols-2 gap-4 text-sm font-medium">
        {/* Pain points header with orange bar */}
        <div className="relative pl-3">
          <span
            className="absolute top-0 left-0 h-full w-1 bg-orange-500"
            aria-hidden="true"
          />
          Pain points
        </div>
        {/* Solutions header with lime bar */}
        <div className="relative pl-3">
          <span
            className="absolute top-0 left-0 h-full w-1 bg-lime-500"
            aria-hidden="true"
          />
          Solutions
        </div>
      </div>

      {/* Pain/Solution rows */}
      <div className="space-y-2">
        {visiblePains.map((item, index) => {
          const hasEvidencePosts = (item.evidencePosts?.length ?? 0) > 0;
          const painKey = `pain-${index}`;
          const solutionKey = `solution-${index}`;
          const painExpanded = expandedItems.has(painKey);
          const solutionExpanded = expandedItems.has(solutionKey);

          return (
            <div
              key={`${item.pain}-${item.solution ?? "no-solution"}`}
              className="grid grid-cols-2 gap-4"
            >
              {/* Pain point (clickable) with orange bar */}
              <div className="relative pl-3">
                <span
                  className="absolute top-0 left-0 h-full w-1 bg-orange-300 dark:bg-orange-700"
                  aria-hidden="true"
                />
                <ExpandableClampText
                  text={item.pain}
                  expanded={painExpanded}
                  onToggle={(event) => {
                    event.stopPropagation();
                    toggleExpandedItem(painKey);
                  }}
                  onTextClick={
                    hasEvidencePosts && onPainClick
                      ? () => onPainClick(item, index)
                      : undefined
                  }
                  className={cn(
                    "text-sm whitespace-pre-line",
                    hasEvidencePosts && onPainClick && "group-hover:underline"
                  )}
                />
              </div>

              {/* Solution with lime bar */}
              <div className="relative pl-3">
                {item.solution && (
                  <span
                    className="absolute top-0 left-0 h-full w-1 bg-lime-300 dark:bg-lime-700"
                    aria-hidden="true"
                  />
                )}
                {item.solution ? (
                  <ExpandableClampText
                    text={item.solution}
                    expanded={solutionExpanded}
                    onToggle={() => toggleExpandedItem(solutionKey)}
                    className="text-muted-foreground text-sm whitespace-pre-line"
                  />
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more/less toggle */}
      {hasMore && (
        <Button
          variant="outline"
          size="xs"
          onClick={() => setShowAll((prev) => !prev)}
          className="w-full"
        >
          {showAll ? "Show less" : "Show more"}
        </Button>
      )}
    </div>
  );
}
