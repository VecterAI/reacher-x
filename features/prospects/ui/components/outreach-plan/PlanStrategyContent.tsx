"use client";

import * as React from "react";
import { cn, parseText } from "@/shared/lib/utils";

type StrategyParagraphBlock = {
  type: "paragraph";
  content: string;
};

type StrategyListBlock = {
  type: "unordered-list" | "ordered-list";
  items: string[];
};

type StrategyBlock = StrategyParagraphBlock | StrategyListBlock;

const STRATEGY_TOGGLE_THRESHOLD = 120;

function normalizeStrategyText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseStrategyBlocks(value: string): StrategyBlock[] {
  const normalized = normalizeStrategyText(value);
  if (!normalized) return [];

  const blocks: StrategyBlock[] = [];
  const sections = normalized.split(/\n\s*\n/);

  for (const section of sections) {
    const lines = section
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) continue;

    const unorderedItems = lines
      .map((line) => line.match(/^[-*•]\s+(.+)$/)?.[1]?.trim() ?? null)
      .filter((item): item is string => Boolean(item));
    if (unorderedItems.length === lines.length) {
      blocks.push({ type: "unordered-list", items: unorderedItems });
      continue;
    }

    const orderedItems = lines
      .map((line) => line.match(/^\d+\.\s+(.+)$/)?.[1]?.trim() ?? null)
      .filter((item): item is string => Boolean(item));
    if (orderedItems.length === lines.length) {
      blocks.push({ type: "ordered-list", items: orderedItems });
      continue;
    }

    blocks.push({
      type: "paragraph",
      content: lines.join("\n"),
    });
  }

  return blocks;
}

export function shouldEnableStrategyExpansion(value: string): boolean {
  return getStrategyPreviewText(value).length > STRATEGY_TOGGLE_THRESHOLD;
}

export function getStrategyPreviewText(value: string): string {
  const blocks = parseStrategyBlocks(value);

  return blocks
    .map((block) => {
      if (block.type === "paragraph") {
        return block.content.replace(/\s+/g, " ").trim();
      }

      return block.items
        .map((item, index) =>
          block.type === "ordered-list" ? `${index + 1}. ${item}` : item
        )
        .join(" • ");
    })
    .filter(Boolean)
    .join(" ");
}

export interface PlanStrategyContentProps {
  rationale: string;
  collapsed?: boolean;
  clampLines?: number | null;
  className?: string;
}

export function PlanStrategyContent({
  rationale,
  collapsed = false,
  clampLines = null,
  className,
}: PlanStrategyContentProps) {
  const blocks = React.useMemo(
    () => parseStrategyBlocks(rationale),
    [rationale]
  );
  const previewText = React.useMemo(
    () => getStrategyPreviewText(rationale),
    [rationale]
  );
  const shouldClamp =
    collapsed &&
    clampLines !== null &&
    shouldEnableStrategyExpansion(rationale);

  if (!blocks.length) {
    return null;
  }

  if (shouldClamp) {
    return (
      <p
        className={cn(
          "[&_a]:text-muted-foreground text-sm leading-relaxed text-pretty wrap-break-word [&_a]:hover:underline",
          clampLines === 2 && "line-clamp-2",
          clampLines === 3 && "line-clamp-3",
          clampLines === 4 && "line-clamp-4",
          className
        )}
      >
        {parseText(previewText)}
      </p>
    );
  }

  return (
    <div className={cn("space-y-3 text-sm text-pretty", className)}>
      {blocks.map((block, index) => {
        if (block.type === "paragraph") {
          return (
            <p
              key={`paragraph-${index}`}
              className="[&_a]:text-muted-foreground leading-relaxed wrap-break-word whitespace-pre-line [&_a]:hover:underline"
            >
              {parseText(block.content)}
            </p>
          );
        }

        const ListTag = block.type === "ordered-list" ? "ol" : "ul";
        return (
          <ListTag
            key={`list-${index}`}
            className={cn(
              "marker:text-muted-foreground ml-4 space-y-1.5 leading-relaxed wrap-break-word",
              block.type === "ordered-list" ? "list-decimal" : "list-disc"
            )}
          >
            {block.items.map((item, itemIndex) => (
              <li key={`item-${itemIndex}`} className="pl-1">
                {parseText(item)}
              </li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}
