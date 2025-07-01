"use client";
/**
 * SidebarSearchHeader Component
 *
 * Handles the search functionality in the sidebar header.
 * Adapts its UI based on the sidebar's collapsed/expanded state.
 *
 * References:
 * - Responsive Design Patterns: https://web.dev/responsive-web-design-basics/
 * - Accessibility in React: https://react.dev/reference/react-dom/components/common#accessibility-attributes
 */

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/shared/ui/components/Button";
import {
  SidebarHeader,
  SidebarInput,
  SidebarMenuButton,
  useSidebar,
} from "@/shared/ui/components/Sidebar";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/components/Command";
import {
  AddIcon,
  SearchIcon,
  YoutubeSearchedForIcon,
} from "@/shared/ui/components/icons";
import { useSidebarContext } from "@/features/webapp/contexts/SidebarContext";
import { formatRelativeTime } from "@/shared/lib/utils/format";
import {
  useHighlight,
  HIGHLIGHT_PRESETS,
} from "@/shared/lib/utils/highlighting";

export function SidebarSearchHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [commandSearchQuery, setCommandSearchQuery] = useState("");
  const { state } = useSidebar();
  const {
    searchQuery,
    setSearchQuery,
    handleNewKeyword,
    recentKeywords,
    allKeywords,
    handleKeywordSelect,
  } = useSidebarContext();

  const isCollapsed = state === "collapsed";

  // Reset search query when dialog closes
  useEffect(() => {
    if (!searchOpen) {
      setCommandSearchQuery("");
    }
  }, [searchOpen]);

  // Filter keywords based on search query in the command dialog
  const displayedKeywords = useMemo(() => {
    if (!commandSearchQuery.trim()) {
      // Show only recent keywords when not searching
      return recentKeywords;
    }

    // Show all matching keywords when searching
    const query = commandSearchQuery.toLowerCase();
    return allKeywords.filter((item) =>
      item.keyword.toLowerCase().includes(query)
    );
  }, [commandSearchQuery, recentKeywords, allKeywords]);

  // Collapsed view with icon buttons
  if (isCollapsed) {
    return (
      <SidebarHeader>
        <SidebarMenuButton
          onClick={handleNewKeyword}
          tooltip="New keyword"
          size="default"
          variant="secondary"
          className="w-full justify-center"
        >
          <AddIcon className="fill-sidebar-foreground" />
        </SidebarMenuButton>

        <SidebarMenuButton
          onClick={() => setSearchOpen(true)}
          tooltip="Search keywords"
          size="default"
          className="w-full justify-center"
        >
          <SearchIcon className="fill-sidebar-foreground" />
        </SidebarMenuButton>

        <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search keywords..."
              value={commandSearchQuery}
              onValueChange={setCommandSearchQuery}
            />
            <CommandList>
              {displayedKeywords.length === 0 ? (
                <CommandEmpty>No keywords found.</CommandEmpty>
              ) : (
                <CommandGroup
                  heading={
                    commandSearchQuery.trim()
                      ? "Search results"
                      : "Recent keywords"
                  }
                >
                  {displayedKeywords.map((item) => (
                    <CommandKeywordItem
                      key={item.id}
                      item={item}
                      searchQuery={commandSearchQuery}
                      onSelect={() => {
                        handleKeywordSelect(item.keyword);
                        setSearchOpen(false);
                      }}
                      isPinned={item.isPinned ?? false}
                    />
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </CommandDialog>
      </SidebarHeader>
    );
  }

  // Expanded view with full search input
  return (
    <SidebarHeader>
      <Button
        onClick={handleNewKeyword}
        aria-label="Create new keyword"
        className="w-full"
        variant="secondary"
        size="sm"
      >
        <AddIcon className="fill-primary" />
        New keyword
      </Button>
      <div className="relative">
        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 fill-muted-foreground" />
        <SidebarInput
          type="text"
          placeholder="Search keywords..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 pl-8"
          aria-label="Search keywords"
        />
      </div>
    </SidebarHeader>
  );
}

// Separate component for command items with highlighting
interface CommandKeywordItemProps {
  item: {
    id: string;
    keyword: string;
    rawTimestamp?: number;
  };
  searchQuery: string;
  onSelect: () => void;
  isPinned: boolean;
}

function CommandKeywordItem({
  item,
  searchQuery,
  onSelect,
  isPinned,
}: CommandKeywordItemProps) {
  const { highlightedText } = useHighlight(
    item.keyword,
    searchQuery,
    HIGHLIGHT_PRESETS.KEYWORD
  );

  return (
    <CommandItem value={item.keyword} onSelect={onSelect}>
      <YoutubeSearchedForIcon className="fill-current" />
      <span className="flex-1">{highlightedText}</span>
      {item.rawTimestamp && (
        <span className="ml-auto text-xs text-muted-foreground">
          {isPinned && <span className="mr-1">𖥣 Pinned</span>} ·{" "}
          {formatRelativeTime(new Date(item.rawTimestamp).toISOString())}
        </span>
      )}
    </CommandItem>
  );
}
