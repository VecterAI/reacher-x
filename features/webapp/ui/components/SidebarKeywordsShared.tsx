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
  YoutubeSearchedForIcon,
} from "@/shared/ui/components/icons";
import {
  useHighlight,
  HIGHLIGHT_PRESETS,
} from "@/shared/lib/utils/highlighting";

// Keyword Item Component Props
export interface KeywordItemComponentProps {
  keyword: string;
  count?: number;
  id: string;
  isPinned?: boolean;
  timestamp?: string;
  onPin?: (id: string, keyword: string) => void;
  onUnpin?: (id: string) => void;
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
    onPin,
    onUnpin,
    onDelete,
    onSelect,
    highlightQuery,
  }) {
    const { highlightedText } = useHighlight(
      keyword,
      highlightQuery,
      HIGHLIGHT_PRESETS.KEYWORD
    );

    const handlePin = useCallback(() => {
      if (isPinned) {
        onUnpin?.(id);
      } else {
        onPin?.(id, keyword);
      }
    }, [isPinned, onUnpin, onPin, id, keyword]);

    const handleDelete = useCallback(() => {
      onDelete?.(id);
    }, [onDelete, id]);

    const handleSelect = useCallback(() => {
      onSelect?.(keyword);
    }, [onSelect, keyword]);

    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={keyword}
          onClick={handleSelect}
          className="cursor-pointer"
        >
          <YoutubeSearchedForIcon className="fill-sidebar-foreground" />
          <span className="truncate text-sm">
            {highlightQuery ? highlightedText : keyword}
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
            <DropdownMenuItem onClick={handlePin}>
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
