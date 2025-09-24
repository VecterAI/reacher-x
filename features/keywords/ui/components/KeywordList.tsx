// features/keywords/ui/components/KeywordList.tsx
"use client";

import { memo, useMemo, useCallback, useRef, useEffect } from "react";
import { SearchIcon } from "@/shared/ui/components/icons";
import { cn } from "@/shared/lib/utils/utils";
import {
  useHighlight,
  calculateTextSimilarity,
  HIGHLIGHT_PRESETS,
} from "@/shared/lib/utils/highlighting";

export interface KeywordItem {
  id: string;
  keyword: string;
  timestamp?: string;
  isPinned?: boolean;
  exactMatch?: boolean; // Whether this keyword was searched with exact phrase match
  metadata?: {
    rationale?: string;
    searchIntent?: string;
    confidence?: number;
    [key: string]: unknown;
  };
}

// Re-export the similarity function from the shared utility
export const getKeywordSimilarity = calculateTextSimilarity;

export function filterSimilarKeywords(
  keywords: KeywordItem[],
  query: string,
  threshold: number = 0.3,
  maxResults: number = 10
): KeywordItem[] {
  if (!query.trim()) return [];

  return keywords
    .map((keyword) => ({
      keyword,
      similarity: getKeywordSimilarity(query, keyword.keyword),
    }))
    .filter((item) => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults)
    .map((item) => item.keyword);
}

interface KeywordListProps {
  items: KeywordItem[];
  onKeywordClick?: (item: KeywordItem) => void;
  showTimestamp?: boolean;
  className?: string;
  emptyMessage?: string;
  itemClassName?: string;
  highlightQuery?: string;
  /** Accessible label for the keyword list */
  listLabel?: string;
  /** ID for the list container - useful for ARIA relationships */
  listId?: string;
  /** Current active item index for keyboard navigation */
  activeIndex?: number;
  /** Callback when active index changes */
  onActiveIndexChange?: (index: number) => void;
}

export const KeywordList = memo<KeywordListProps>(function KeywordList({
  items,
  onKeywordClick,
  showTimestamp = false,
  className,
  emptyMessage = "No keywords found",
  itemClassName,
  highlightQuery,
  listLabel = "Keyword suggestions",
  listId,
  activeIndex = -1,
  onActiveIndexChange,
}) {
  const listRef = useRef<HTMLUListElement>(null);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!onActiveIndexChange || items.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          const nextIndex =
            activeIndex < items.length - 1 ? activeIndex + 1 : 0;
          onActiveIndexChange(nextIndex);
          break;
        case "ArrowUp":
          e.preventDefault();
          const prevIndex =
            activeIndex > 0 ? activeIndex - 1 : items.length - 1;
          onActiveIndexChange(prevIndex);
          break;
        case "Enter":
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < items.length) {
            onKeywordClick?.(items[activeIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onActiveIndexChange(-1);
          break;
      }
    },
    [activeIndex, items, onActiveIndexChange, onKeywordClick]
  );

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeItem = listRef.current.children[activeIndex] as HTMLElement;
      if (activeItem) {
        activeItem.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [activeIndex]);

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "py-6 text-center text-sm text-muted-foreground",
          className
        )}
        role="status"
        aria-live="polite"
        id={listId}
      >
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={cn("space-y-1", className)}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label={listLabel}
    >
      <ul
        ref={listRef}
        className="space-y-1"
        role="listbox"
        aria-label={listLabel}
        id={listId}
        aria-activedescendant={
          activeIndex >= 0 ? `keyword-item-${items[activeIndex].id}` : undefined
        }
      >
        {items.map((item, index) => (
          <KeywordListItem
            key={item.id}
            item={item}
            onClick={onKeywordClick}
            showTimestamp={showTimestamp}
            className={itemClassName}
            highlightQuery={highlightQuery}
            isActive={index === activeIndex}
            index={index}
          />
        ))}
      </ul>
    </div>
  );
});

interface KeywordListItemProps {
  item: KeywordItem;
  onClick?: (item: KeywordItem) => void;
  showTimestamp?: boolean;
  className?: string;
  highlightQuery?: string;
  isActive?: boolean;
  index?: number;
}

const KeywordListItem = memo<KeywordListItemProps>(function KeywordListItem({
  item,
  onClick,
  showTimestamp,
  className,
  highlightQuery,
  isActive = false,
  index = 0,
}) {
  const itemRef = useRef<HTMLLIElement>(null);

  const handleClick = useCallback(() => {
    onClick?.(item);
  }, [onClick, item]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  // Use the shared highlighting utility
  const { highlightedText } = useHighlight(
    item.keyword,
    highlightQuery,
    HIGHLIGHT_PRESETS.KEYWORD
  );

  // Generate accessible description
  const accessibleDescription = useMemo(() => {
    let description = `Keyword: ${item.keyword}`;
    if (showTimestamp && item.timestamp) {
      description += `, searched ${item.timestamp}`;
    }
    if (isActive) {
      description += ", currently selected";
    }
    return description;
  }, [item.keyword, item.timestamp, showTimestamp, isActive]);

  return (
    <li
      ref={itemRef}
      role="option"
      aria-selected={isActive}
      aria-label={accessibleDescription}
      id={`keyword-item-${item.id}`}
      tabIndex={onClick ? 0 : -1}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        "focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1",
        onClick && [
          "cursor-pointer hover:bg-accent hover:text-accent-foreground",
          "focus-visible:bg-accent focus-visible:text-accent-foreground",
        ],
        isActive && "bg-accent text-accent-foreground",
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-index={index}
    >
      <SearchIcon
        className="fill-current"
        aria-hidden="true"
        role="img"
        aria-label="Search keyword"
      />
      <span className="flex-1 truncate" aria-hidden="true">
        {highlightedText}
      </span>
      {/* Indicator region */}
      {(item.isPinned ||
        item.exactMatch ||
        (showTimestamp && item.timestamp)) && (
        <span className="ml-auto flex items-center text-right text-xs text-muted-foreground">
          {item.isPinned && "𖥣 Pinned"}
          {item.exactMatch &&
            (showTimestamp ? "\u00A0\u00A0· Exact Phrase" : "· Exact Phrase")}
          {showTimestamp && item.timestamp && (
            <time
              dateTime={item.timestamp}
              aria-label={`searched ${item.timestamp}`}
            >
              &nbsp;&nbsp;· {item.timestamp}
            </time>
          )}
        </span>
      )}
    </li>
  );
});
