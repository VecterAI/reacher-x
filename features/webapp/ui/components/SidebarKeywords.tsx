"use client";
/**
 * SidebarKeywords Component
 *
 * Manages the keywords section of the sidebar, including keyword history and pinned keywords.
 * This component handles both expanded and collapsed states with appropriate UI adaptations.
 *
 * References:
 * - State Management in React: https://react.dev/learn/managing-state
 * - Conditional Rendering: https://react.dev/learn/conditional-rendering
 * - React Performance: https://react.dev/reference/react/memo
 */

import { useState, useMemo, useEffect } from "react";
import { Folder } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  useSidebar,
} from "@/shared/ui/components/Sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/components/Collapsible";
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
  TodayIcon,
  EventRepeatIcon,
  CalendarViewWeekIcon,
  CalendarClockIcon,
  KeepIcon,
  SearchActivityIcon,
  YoutubeSearchedForIcon,
  ChevronRightIcon,
} from "@/shared/ui/components/icons";
import { formatRelativeTime } from "@/shared/lib/utils/format";
import { useSidebarContext } from "@/features/webapp/contexts/SidebarContext";
import { KeywordItemComponent } from "./SidebarKeywordsShared";
import { KeywordItemWithRawTimestamp } from "@/features/search/hooks/useSearchHistory";
import {
  useHighlight,
  HIGHLIGHT_PRESETS,
} from "@/shared/lib/utils/highlighting";

// Tree Component for grouping keywords by time
interface TreeProps {
  name: string;
  items: KeywordItemWithRawTimestamp[];
  onPin?: (item: KeywordItemWithRawTimestamp) => void;
  onUnpin?: (id: string) => void;
  onDelete?: (id: string) => void;
  onSelect?: (keyword: string) => void;
  isActive: (item: KeywordItemWithRawTimestamp) => boolean;
}

function Tree({
  name,
  items,
  onPin,
  onUnpin,
  onDelete,
  onSelect,
  isActive,
}: TreeProps) {
  if (!items.length) {
    return null;
  }

  const totalCount = items.length;

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Today: TodayIcon,
    Yesterday: EventRepeatIcon,
    "Last week": CalendarViewWeekIcon,
    Older: CalendarClockIcon,
  };

  const Icon = iconMap[name] || Folder;

  return (
    <SidebarMenuItem>
      <Collapsible
        className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
        defaultOpen={name === "Today"}
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={name}>
            <ChevronRightIcon className="fill-sidebar-foreground transition-transform" />
            <Icon className="fill-sidebar-foreground" />
            {name}
            <SidebarMenuBadge className="font-mono text-muted-foreground">
              · {totalCount}
            </SidebarMenuBadge>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((item) => (
              <KeywordItemComponent
                key={item.id}
                keyword={item.keyword}
                id={item.id}
                isPinned={false}
                isActive={isActive(item)}
                timestamp={item.timestamp}
                rawTimestamp={item.rawTimestamp}
                onPin={onPin}
                onUnpin={onUnpin}
                onDelete={onDelete}
                onSelect={onSelect}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

// Collapsed Menu Button Component
interface CollapsedMenuButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
  items: KeywordItemWithRawTimestamp[];
  allItems?: KeywordItemWithRawTimestamp[]; // All items for searching
  onItemSelect?: (item: KeywordItemWithRawTimestamp) => void;
  commandTitle: string;
  commandHeading: string;
}

function CollapsedMenuButton({
  icon: Icon,
  tooltip,
  items,
  allItems,
  onItemSelect,
  commandTitle,
  commandHeading,
}: CollapsedMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Reset search query when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
    }
  }, [open]);

  // Determine which items to display based on search query
  const displayedItems = useMemo(() => {
    if (!searchQuery.trim()) {
      // Show provided items (recent/pinned) when not searching
      return items;
    }

    // Show all matching items when searching
    const query = searchQuery.toLowerCase();
    const searchableItems = allItems || items;
    return searchableItems.filter((item) =>
      item.keyword.toLowerCase().includes(query)
    );
  }, [searchQuery, items, allItems]);

  return (
    <>
      <SidebarMenuButton
        onClick={() => setOpen(true)}
        tooltip={tooltip}
        size="default"
        className="w-full justify-center"
      >
        <Icon className="fill-sidebar-foreground" />
      </SidebarMenuButton>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Search ${commandTitle.toLowerCase()}...`}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {displayedItems.length === 0 ? (
              <CommandEmpty>
                No {commandTitle.toLowerCase()} found.
              </CommandEmpty>
            ) : (
              <CommandGroup
                heading={searchQuery.trim() ? "Search results" : commandHeading}
              >
                {displayedItems.map((item) => (
                  <CommandKeywordItem
                    key={item.id}
                    item={item}
                    searchQuery={searchQuery}
                    onSelect={() => {
                      onItemSelect?.(item);
                      setOpen(false);
                    }}
                  />
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

// Separate component for command items with highlighting
interface CommandKeywordItemProps {
  item: KeywordItemWithRawTimestamp;
  searchQuery: string;
  onSelect: () => void;
}

function CommandKeywordItem({
  item,
  searchQuery,
  onSelect,
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
          {formatRelativeTime(new Date(item.rawTimestamp).toISOString())}
        </span>
      )}
    </CommandItem>
  );
}

// Main SidebarKeywords Component
export function SidebarKeywords() {
  const { state } = useSidebar();
  const {
    filteredGroupedHistory,
    pinnedKeywords,
    recentKeywords,
    allKeywords,
    handlePin,
    handleUnpin,
    handleDelete,
    handleKeywordSelect,
    handleKeywordItemSelect,
    pinnedCount,
    activeKeyword,
  } = useSidebarContext();

  const isCollapsed = state === "collapsed";

  // Get all keywords (including pinned) for search in the collapsed view
  // This ensures consistency with the expanded sidebar search behavior
  const allKeywordsForSearch = useMemo(() => {
    return allKeywords; // Include all keywords (both history and pinned)
  }, [allKeywords]);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Keywords tried.</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {/* Pinned Keywords */}
          {isCollapsed ? (
            pinnedCount > 0 && (
              <SidebarMenuItem>
                <CollapsedMenuButton
                  icon={KeepIcon}
                  tooltip="Pinned keywords"
                  items={pinnedKeywords.map(
                    (p) =>
                      ({
                        id: p.id,
                        keyword: p.keyword,
                        timestamp: new Date(
                          p.originalTimestamp || p.pinnedAt
                        ).toISOString(),
                        rawTimestamp: p.originalTimestamp || p.pinnedAt,
                        metadata: p.metadata,
                      }) as KeywordItemWithRawTimestamp
                  )}
                  allItems={pinnedKeywords.map(
                    (p) =>
                      ({
                        id: p.id,
                        keyword: p.keyword,
                        timestamp: new Date(
                          p.originalTimestamp || p.pinnedAt
                        ).toISOString(),
                        rawTimestamp: p.originalTimestamp || p.pinnedAt,
                        metadata: p.metadata,
                      }) as KeywordItemWithRawTimestamp
                  )}
                  onItemSelect={handleKeywordItemSelect}
                  commandTitle="Pinned Keywords"
                  commandHeading="Pinned keywords"
                />
              </SidebarMenuItem>
            )
          ) : pinnedCount > 0 ? (
            <Collapsible className="group/collapsible [&[data-state=open]>button>svg:last-child]:rotate-90">
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Pinned keywords">
                  <KeepIcon className="fill-sidebar-foreground" />
                  <span className="truncate">Pinned keywords</span>
                  <span className="ml-auto select-none font-mono text-xs font-medium text-muted-foreground">
                    · {pinnedCount}
                  </span>
                  <ChevronRightIcon className="fill-sidebar-foreground transition-transform" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {pinnedKeywords.map((item) => (
                    <KeywordItemComponent
                      key={item.id}
                      keyword={item.keyword}
                      id={item.id}
                      isPinned={true}
                      isActive={
                        item.keyword.toLowerCase() ===
                        activeKeyword.toLowerCase()
                      }
                      timestamp={new Date(
                        item.originalTimestamp || item.pinnedAt
                      ).toISOString()}
                      rawTimestamp={item.originalTimestamp || item.pinnedAt}
                      onPin={handlePin}
                      onUnpin={handleUnpin}
                      onDelete={handleDelete}
                      onSelect={handleKeywordSelect}
                    />
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          ) : null}

          {/* Keyword History */}
          {isCollapsed ? (
            <SidebarMenuItem>
              <CollapsedMenuButton
                icon={SearchActivityIcon}
                tooltip="Keyword history"
                items={recentKeywords}
                allItems={allKeywordsForSearch}
                onItemSelect={handleKeywordItemSelect}
                commandTitle="Keyword History"
                commandHeading="Recent keywords"
              />
            </SidebarMenuItem>
          ) : (
            <Collapsible className="group/collapsible [&[data-state=open]>button>svg:last-child]:rotate-90">
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Keyword history">
                  <SearchActivityIcon className="fill-sidebar-foreground" />
                  <span className="truncate">Keyword history</span>
                  <ChevronRightIcon className="ml-auto fill-sidebar-foreground transition-transform" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {Object.entries(filteredGroupedHistory).map(
                    ([group, items]) => (
                      <Tree
                        key={group}
                        name={group}
                        items={items}
                        onPin={handlePin}
                        onUnpin={handleUnpin}
                        onDelete={handleDelete}
                        onSelect={handleKeywordSelect}
                        isActive={(item) =>
                          item.keyword.toLowerCase() ===
                          activeKeyword.toLowerCase()
                        }
                      />
                    )
                  )}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
