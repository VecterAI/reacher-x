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

export function PainSolutionGrid({
  painPoints,
  onPainClick,
  className,
}: PainSolutionGridProps) {
  const [showAll, setShowAll] = React.useState(false);

  if (!painPoints || painPoints.length === 0) {
    return null;
  }

  const visiblePains = showAll
    ? painPoints
    : painPoints.slice(0, DEFAULT_VISIBLE_COUNT);
  const hasMore = painPoints.length > DEFAULT_VISIBLE_COUNT;

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
        {visiblePains.map((item, index) => (
          <div key={index} className="grid grid-cols-2 gap-4">
            {/* Pain point (clickable) with orange bar */}
            <button
              type="button"
              onClick={() => onPainClick?.(item, index)}
              className="group relative pl-3 text-left"
            >
              <span
                className="absolute top-0 left-0 h-full w-1 bg-orange-300 dark:bg-orange-700"
                aria-hidden="true"
              />
              <span className="line-clamp-2 text-sm group-hover:underline">
                {item.pain}
              </span>
            </button>

            {/* Solution with lime bar */}
            <div className="relative pl-3">
              {item.solution && (
                <span
                  className="absolute top-0 left-0 h-full w-1 bg-lime-300 dark:bg-lime-700"
                  aria-hidden="true"
                />
              )}
              <span className="text-muted-foreground line-clamp-2 text-sm">
                {item.solution || "-"}
              </span>
            </div>
          </div>
        ))}
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
