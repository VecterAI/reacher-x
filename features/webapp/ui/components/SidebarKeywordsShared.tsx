"use client";
/**
 * Shared Keyword Components
 *
 * Reusable components for keyword functionality across the sidebar.
 * These components are extracted to avoid duplication and promote DRY principles.
 *
 * References:
 * - DRY Principle: https://en.wikipedia.org/wiki/Don%27t_repeat_yourself
 * - Component Reusability: https://react.dev/learn/your-first-component#defining-a-component
 */

import { memo, useCallback } from "react";
import {
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/shared/ui/components/Sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import {
  MoreHorizIcon,
  DeleteIcon,
  DoNotDisturbOnIcon,
  KeepIcon,
  SearchIcon,
} from "@/shared/ui/components/icons";
import {
  useHighlight,
  HIGHLIGHT_PRESETS,
} from "@/shared/lib/utils/highlighting";
import { formatRelativeTime } from "@/shared/lib/utils/format";
import React from "react";

// Keyword Item Component Props
export interface KeywordItemComponentProps {
  keyword: string;
  count?: number;
  id: string;
  isPinned?: boolean;
  isActive?: boolean;
  exactMatch?: boolean;
  timestamp?: string;
  rawTimestamp?: number;
  onTogglePin?: (id: string) => void;
  onDelete?: (id: string) => void;
  onSelect?: (keyword: string) => void;
  highlightQuery?: string;
}

/**
 * KeywordItemComponent - Renders a single keyword item with actions
 * Memoized for performance optimization
 */
export const KeywordItemComponent = memo<KeywordItemComponentProps>(
  function KeywordItemComponent({
    keyword,
    count,
    id,
    isPinned = false,
    isActive = false,
    exactMatch = false,
    timestamp,
    rawTimestamp,
    onTogglePin,
    onDelete,
    onSelect,
    highlightQuery,
  }) {
    const { highlightedText } = useHighlight(
      keyword,
      highlightQuery,
      HIGHLIGHT_PRESETS.KEYWORD
    );

    const handlePinToggle = useCallback(() => {
      onTogglePin?.(id);
    }, [onTogglePin, id]);

    const handleDelete = useCallback(() => {
      onDelete?.(id);
    }, [onDelete, id]);

    const handleSelect = useCallback(() => {
      onSelect?.(keyword);
    }, [onSelect, keyword]);

    // Create comprehensive tooltip content with timestamp and exact match info
    const tooltipContent = React.useMemo(() => {
      if (!keyword) return ""; // Safety check

      const metadata = [];

      if (isPinned) {
        metadata.push(
          <span key="pinned" className="text-muted-foreground">
            𖥣 Pinned
          </span>
        );
      }

      if (exactMatch) {
        metadata.push(
          <span key="exact" className="text-muted-foreground">
            {" "}
            · Exact Phrase
          </span>
        );
      }

      if (rawTimestamp || timestamp) {
        const timeValue = rawTimestamp
          ? (() => {
              try {
                return formatRelativeTime(new Date(rawTimestamp).toISOString());
              } catch (error) {
                console.warn("Error formatting timestamp:", error);
                return timestamp || "";
              }
            })()
          : timestamp;

        metadata.push(
          <time
            key="timestamp"
            className="text-muted-foreground"
            dateTime={
              rawTimestamp ? new Date(rawTimestamp).toISOString() : undefined
            }
          >
            {" "}
            · {timeValue}
          </time>
        );
      }

      return (
        <div className="flex items-center gap-2 text-sm">
          {keyword}
          {metadata.length > 0 && (
            <span className="text-xs text-muted-foreground">{metadata}</span>
          )}
        </div>
      );
    }, [keyword, isPinned, exactMatch, rawTimestamp, timestamp]);

    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={
            tooltipContent
              ? {
                  children: tooltipContent,
                  hidden: false, // Override the default hidden logic to always show tooltips
                }
              : undefined
          }
          onClick={handleSelect}
          className="cursor-pointer"
          variant={isActive ? "secondary" : "ghost"}
        >
          <SearchIcon className="fill-sidebar-foreground" />
          <span className="truncate text-sm">
            {highlightQuery ? highlightedText : keyword}
            {exactMatch && (
              <span
                className="ml-1 text-xs text-muted-foreground"
                title="Exact phrase match"
              >
                [exact]
              </span>
            )}
            {isPinned && (
              <span
                className="ml-1 text-xs text-muted-foreground"
                title="Pinned keyword"
              >
                [pinned]
              </span>
            )}
          </span>
          {count && (
            <SidebarMenuBadge className="ml-auto">{count}</SidebarMenuBadge>
          )}
        </SidebarMenuButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              showOnHover
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <MoreHorizIcon className="fill-sidebar-foreground" />
              <span className="sr-only">Open menu for {keyword}</span>
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right">
            <DropdownMenuItem onClick={handlePinToggle}>
              {isPinned ? (
                <>
                  <DoNotDisturbOnIcon className="fill-popover-foreground" />
                  Remove from &ldquo;Pinned&rdquo;
                </>
              ) : (
                <>
                  <KeepIcon className="fill-popover-foreground" />
                  Pin keyword
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete}>
              <DeleteIcon className="fill-popover-foreground" />
              Delete keyword
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }
);
