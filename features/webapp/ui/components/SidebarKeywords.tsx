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
  isPinnedItems?: boolean;
}

function Tree({
  name,
  items,
  onPin,
  onUnpin,
  onDelete,
  onSelect,
  isActive,
  isPinnedItems = false,
}: TreeProps) {
  if (!items.length) {
    return null;
  }

  const totalCount = items.length;

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Pinned: KeepIcon,
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
        defaultOpen={name === "Today" || name === "Pinned"}
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
                isPinned={isPinnedItems}
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
  recentItems: KeywordItemWithRawTimestamp[];
  allItems: KeywordItemWithRawTimestamp[];
  pinnedKeywords: string[]; // Set of pinned keyword strings for identification
  onItemSelect?: (item: KeywordItemWithRawTimestamp) => void;
  commandTitle: string;
}

function CollapsedMenuButton({
  icon: Icon,
  tooltip,
  recentItems,
  allItems,
  pinnedKeywords,
  onItemSelect,
  commandTitle,
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
      // Show only the 5 most recent keywords when not searching
      return recentItems.slice(0, 5);
    }

    // Show all matching items when searching
    const query = searchQuery.toLowerCase();
    return allItems.filter((item) =>
      item.keyword.toLowerCase().includes(query)
    );
  }, [searchQuery, recentItems, allItems]);

  // Create heading based on search state
  const heading = useMemo(() => {
    if (searchQuery.trim()) {
      return `Similar to "${searchQuery}" ↴`;
    }
    return "Recent ↴";
  }, [searchQuery]);

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
              <CommandGroup heading={heading}>
                {displayedItems.map((item) => (
                  <CommandKeywordItem
                    key={item.id}
                    item={item}
                    searchQuery={searchQuery}
                    isPinned={pinnedKeywords.includes(item.keyword)}
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
  isPinned: boolean;
  onSelect: () => void;
}

function CommandKeywordItem({
  item,
  searchQuery,
  isPinned,
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
          {isPinned && <span className="mr-1">𖥣 Pinned</span>} ·{" "}
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

  // Create a set of pinned keyword strings for easy lookup
  const pinnedKeywordStrings = useMemo(() => {
    return pinnedKeywords.map((p) => p.keyword);
  }, [pinnedKeywords]);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Keywords tried.</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {isCollapsed ? (
            <SidebarMenuItem>
              <CollapsedMenuButton
                icon={SearchActivityIcon}
                tooltip="Keyword history"
                recentItems={recentKeywords}
                allItems={allKeywords}
                pinnedKeywords={pinnedKeywordStrings}
                onItemSelect={handleKeywordItemSelect}
                commandTitle="Keyword History"
              />
            </SidebarMenuItem>
          ) : (
            <Collapsible
              className="group/collapsible [&[data-state=open]>button>svg:last-child]:rotate-90"
              defaultOpen
            >
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Keyword history">
                  <SearchActivityIcon className="fill-sidebar-foreground" />
                  <span className="truncate">Keyword history</span>
                  {allKeywords.length > 0 && (
                    <span className="absolute right-[39px] ml-auto select-none font-mono text-xs font-medium text-muted-foreground">
                      · {allKeywords.length}
                    </span>
                  )}
                  <ChevronRightIcon className="ml-auto fill-sidebar-foreground transition-transform" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {/* Pinned Keywords Group */}
                  {pinnedCount > 0 && (
                    <Tree
                      name="Pinned"
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
                      onPin={handlePin}
                      onUnpin={handleUnpin}
                      onDelete={handleDelete}
                      onSelect={handleKeywordSelect}
                      isActive={(item) =>
                        item.keyword.toLowerCase() ===
                        activeKeyword.toLowerCase()
                      }
                      isPinnedItems={true}
                    />
                  )}

                  {/* Time-based History Groups */}
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
