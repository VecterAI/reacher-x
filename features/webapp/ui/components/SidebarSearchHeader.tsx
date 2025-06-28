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

import { useState } from "react";
import { Button } from "@/shared/ui/components/Button";
import {
  SidebarHeader,
  SidebarInput,
  SidebarMenuButton,
  useSidebar,
} from "@/shared/ui/components/Sidebar";
import {
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

export function SidebarSearchHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { state } = useSidebar();
  const {
    searchQuery,
    setSearchQuery,
    handleNewKeyword,
    recentKeywords,
    handleKeywordSelect,
  } = useSidebarContext();

  const isCollapsed = state === "collapsed";

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
          <CommandInput placeholder="Search keywords..." />
          <CommandList>
            <CommandEmpty>No keywords found.</CommandEmpty>
            <CommandGroup heading="Recent keywords">
              {recentKeywords.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => {
                    handleKeywordSelect(item.keyword);
                    setSearchOpen(false);
                  }}
                >
                  <YoutubeSearchedForIcon className="fill-current" />
                  <span>{item.keyword}</span>
                  {item.timestamp && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
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
        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 fill-sidebar-foreground" />
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
