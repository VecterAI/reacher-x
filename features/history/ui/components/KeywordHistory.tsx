"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Folder } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarFooter,
  SidebarContent,
  useSidebar,
} from "@/shared/ui/components/Sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/components/Collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/components/Command";
import {
  MoreHorizIcon,
  TodayIcon,
  EventRepeatIcon,
  CalendarViewWeekIcon,
  CalendarClockIcon,
  DeleteIcon,
  DoNotDisturbOnIcon,
  KeepIcon,
  SearchActivityIcon,
  YoutubeSearchedForIcon,
  ChevronRightIcon,
  SettingsIcon,
  GroupIcon,
  QuickPhrasesIcon,
  ManageAccountsIcon,
  AddIcon,
  SearchIcon,
  DeveloperGuideIcon,
  FilledFolderIcon,
} from "@/shared/ui/components/icons";
import { Button } from "@/shared/ui/components/Button";

// Import our new utilities
import { useSearchHistory } from "@/features/search/hooks/useSearchHistory";
import {
  getPinnedKeywords,
  pinKeyword,
  unpinKeywordById,
  type PinnedKeyword,
} from "@/shared/lib/utils/pinnedKeywords";
import {
  useHighlight,
  HIGHLIGHT_PRESETS,
} from "@/shared/lib/utils/highlighting";
import type { KeywordItem } from "@/features/keywords/ui/components/KeywordList";

// Custom debounce hook for performance optimization
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Utility to group keywords by time period
function groupKeywordsByTime(
  keywords: KeywordItem[]
): Record<string, KeywordItem[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const groups: Record<string, KeywordItem[]> = {
    Today: [],
    Yesterday: [],
    "Last week": [],
    Older: [],
  };

  keywords.forEach((item) => {
    if (!item.timestamp) {
      groups.Older.push(item);
      return;
    }

    const itemDate = new Date(item.timestamp);

    if (itemDate >= today) {
      groups.Today.push(item);
    } else if (itemDate >= yesterday) {
      groups.Yesterday.push(item);
    } else if (itemDate >= lastWeek) {
      groups["Last week"].push(item);
    } else {
      groups.Older.push(item);
    }
  });

  // Remove empty groups
  Object.keys(groups).forEach((key) => {
    if (groups[key].length === 0) {
      delete groups[key];
    }
  });

  return groups;
}

interface KeywordItemComponentProps {
  keyword: string;
  count?: number;
  id: string;
  isPinned?: boolean;
  showTimestamp?: boolean;
  timestamp?: string;
  onPin?: (id: string, keyword: string) => void;
  onUnpin?: (id: string) => void;
  onDelete?: (id: string) => void;
  onSelect?: (keyword: string) => void;
  highlightQuery?: string;
}

function KeywordItemComponent({
  keyword,
  count,
  id,
  isPinned = false,
  showTimestamp = false,
  timestamp,
  onPin,
  onUnpin,
  onDelete,
  onSelect,
  highlightQuery,
}: KeywordItemComponentProps) {
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
                Remove from "Pinned"
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

interface SearchHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewKeyword: () => void;
  isCollapsed: boolean;
}

function SearchHeader({
  searchQuery,
  onSearchChange,
  onNewKeyword,
  isCollapsed,
}: SearchHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { history } = useSearchHistory();

  // Get recent keywords for command menu
  const recentKeywords = useMemo(() => {
    return history.slice(0, 5);
  }, [history]);

  if (isCollapsed) {
    return (
      <SidebarHeader>
        <SidebarMenuButton
          onClick={onNewKeyword}
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
                    console.log("Selected keyword:", item.keyword);
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

  return (
    <SidebarHeader>
      <Button
        onClick={onNewKeyword}
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
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 pl-8"
          aria-label="Search keywords"
        />
      </div>
    </SidebarHeader>
  );
}

interface CollapsedMenuButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
  items: KeywordItem[];
  onItemSelect?: (item: KeywordItem) => void;
  commandTitle: string;
  commandHeading: string;
}

function CollapsedMenuButton({
  icon: Icon,
  tooltip,
  items,
  onItemSelect,
  commandTitle,
  commandHeading,
}: CollapsedMenuButtonProps) {
  const [open, setOpen] = useState(false);

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
        <CommandInput placeholder={`Search ${commandTitle.toLowerCase()}...`} />
        <CommandList>
          <CommandEmpty>No {commandTitle.toLowerCase()} found.</CommandEmpty>
          <CommandGroup heading={commandHeading}>
            {items.map((item) => (
              <CommandItem
                key={item.id}
                onSelect={() => {
                  onItemSelect?.(item);
                  setOpen(false);
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
    </>
  );
}

export function KeywordHistory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedKeywords, setPinnedKeywords] = useState<PinnedKeyword[]>([]);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const { state } = useSidebar();

  // Get search history
  const { history, addToHistory } = useSearchHistory();

  const isCollapsed = state === "collapsed";

  // Load pinned keywords
  useEffect(() => {
    setPinnedKeywords(getPinnedKeywords());
  }, []);

  // Convert search history to grouped format
  const groupedHistory = useMemo(() => {
    return groupKeywordsByTime(history);
  }, [history]);

  // Flatten all keywords for searching
  const allKeywords = useMemo(() => {
    const keywords: (KeywordItem & { isPinned: boolean; source: string })[] =
      [];

    // Add pinned keywords
    pinnedKeywords.forEach((item) => {
      keywords.push({
        id: item.id,
        keyword: item.keyword,
        timestamp: new Date(item.pinnedAt).toISOString(),
        metadata: item.metadata,
        isPinned: true,
        source: "pinned",
      });
    });

    // Add history keywords
    Object.entries(groupedHistory).forEach(([group, items]) => {
      items.forEach((item) => {
        keywords.push({ ...item, isPinned: false, source: group });
      });
    });

    return keywords;
  }, [pinnedKeywords, groupedHistory]);

  // Filter keywords based on search query with highlighting
  const filteredKeywords = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return [];
    }

    const query = debouncedSearchQuery.toLowerCase();
    return allKeywords.filter((item) =>
      item.keyword.toLowerCase().includes(query)
    );
  }, [debouncedSearchQuery, allKeywords]);

  // Get recent keywords for collapsed menu
  const recentKeywords = useMemo(() => {
    return history.slice(0, 5);
  }, [history]);

  const handlePin = useCallback((id: string, keyword: string) => {
    const success = pinKeyword(keyword, "manual");
    if (success) {
      setPinnedKeywords(getPinnedKeywords());
      console.log("Pinned keyword:", keyword);
    }
  }, []);

  const handleUnpin = useCallback((id: string) => {
    const success = unpinKeywordById(id);
    if (success) {
      setPinnedKeywords(getPinnedKeywords());
      console.log("Unpinned keyword:", id);
    }
  }, []);

  const handleDelete = useCallback((id: string) => {
    // TODO: Implement delete from search history
    console.log("Delete keyword:", id);
  }, []);

  const handleNewKeyword = useCallback(() => {
    // TODO: Implement new keyword creation flow
    console.log("Create new keyword");
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleKeywordSelect = useCallback((keyword: string) => {
    // TODO: Navigate to search results page with this keyword
    console.log("Selected keyword:", keyword);
  }, []);

  const handleKeywordItemSelect = useCallback(
    (item: KeywordItem) => {
      handleKeywordSelect(item.keyword);
    },
    [handleKeywordSelect]
  );

  const pinnedCount = pinnedKeywords.length;
  const isSearching = debouncedSearchQuery.trim().length > 0;

  return (
    <>
      <SearchHeader
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onNewKeyword={handleNewKeyword}
        isCollapsed={isCollapsed}
      />

      <SidebarContent>
        {isSearching && !isCollapsed ? (
          // Search results (only when expanded)
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredKeywords.length > 0 ? (
                  filteredKeywords.map((item) => (
                    <KeywordItemComponent
                      key={item.id}
                      keyword={item.keyword}
                      id={item.id}
                      isPinned={item.isPinned}
                      showTimestamp={!!item.timestamp}
                      timestamp={item.timestamp}
                      onPin={handlePin}
                      onUnpin={handleUnpin}
                      onDelete={handleDelete}
                      onSelect={handleKeywordSelect}
                      highlightQuery={debouncedSearchQuery}
                    />
                  ))
                ) : (
                  <SidebarMenuItem>
                    <SidebarMenuButton disabled>
                      <span className="text-sidebar-foreground/60">
                        No keywords found for &ldquo;{debouncedSearchQuery}
                        &rdquo;
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          // Normal sidebar content
          <>
            {/* Navigation Section */}
            <SidebarGroup>
              <SidebarGroupLabel>Navigation.</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Replies">
                      <QuickPhrasesIcon className="fill-sidebar-foreground" />
                      <span className="truncate">Replies</span>
                      <SidebarMenuBadge>2</SidebarMenuBadge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Customers">
                      <GroupIcon className="fill-sidebar-foreground" />
                      <span className="truncate">Customers</span>
                      <SidebarMenuBadge>2</SidebarMenuBadge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <Collapsible className="group/collapsible [&[data-state=open]>button>svg:last-child]:rotate-90">
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Settings">
                          <SettingsIcon className="fill-sidebar-foreground" />
                          <span className="truncate">Settings</span>
                          <ChevronRightIcon className="ml-auto fill-sidebar-foreground transition-transform" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          <SidebarMenuItem>
                            <SidebarMenuButton tooltip="Linked accounts">
                              <ManageAccountsIcon className="fill-sidebar-foreground" />
                              <span className="truncate">Linked accounts</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </Collapsible>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Resources Section */}
            <SidebarGroup>
              <SidebarGroupLabel>Resources.</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <Collapsible className="group/collapsible [&[data-state=open]>button>svg:last-child]:rotate-90">
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Get started">
                          <DeveloperGuideIcon className="fill-sidebar-foreground" />
                          <span className="truncate">Get started</span>
                          <ChevronRightIcon className="ml-auto fill-sidebar-foreground transition-transform" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          <SidebarMenuItem>
                            <SidebarMenuButton tooltip="Thread">
                              <span className="truncate">🧵 Thread</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </Collapsible>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Keywords Tried Section */}
            <SidebarGroup>
              <SidebarGroupLabel>Keywords tried.</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* Keyword History */}
                  {isCollapsed ? (
                    <SidebarMenuItem>
                      <CollapsedMenuButton
                        icon={SearchActivityIcon}
                        tooltip="Keyword history"
                        items={recentKeywords}
                        onItemSelect={handleKeywordItemSelect}
                        commandTitle="Keyword History"
                        commandHeading="Recent keywords"
                      />
                    </SidebarMenuItem>
                  ) : (
                    <Collapsible className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90">
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Keyword history">
                          <ChevronRightIcon className="fill-sidebar-foreground transition-transform" />
                          <SearchActivityIcon className="fill-sidebar-foreground" />
                          Keyword history
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {Object.entries(groupedHistory).map(
                            ([group, items], index) => (
                              <Tree
                                key={index}
                                name={group}
                                items={items}
                                onPin={handlePin}
                                onUnpin={handleUnpin}
                                onDelete={handleDelete}
                                onSelect={handleKeywordSelect}
                              />
                            )
                          )}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Pinned Keywords */}
                  {isCollapsed ? (
                    <SidebarMenuItem>
                      <CollapsedMenuButton
                        icon={KeepIcon}
                        tooltip="Pinned keywords"
                        items={pinnedKeywords.map((p) => ({
                          id: p.id,
                          keyword: p.keyword,
                          timestamp: new Date(p.pinnedAt).toISOString(),
                          metadata: p.metadata,
                        }))}
                        onItemSelect={handleKeywordItemSelect}
                        commandTitle="Pinned Keywords"
                        commandHeading="Pinned keywords"
                      />
                    </SidebarMenuItem>
                  ) : pinnedCount > 0 ? (
                    <Collapsible className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90">
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Pinned keywords">
                          <ChevronRightIcon className="fill-sidebar-foreground transition-transform" />
                          <KeepIcon className="fill-sidebar-foreground" />
                          <span className="truncate">Pinned keywords</span>
                          <SidebarMenuBadge className="right-3">
                            {pinnedCount}
                          </SidebarMenuBadge>
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Default workspace">
              <FilledFolderIcon className="fill-foreground" />
              <span className="truncate">Default workspace</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}

interface TreeProps {
  name: string;
  items: KeywordItem[];
  onPin?: (id: string, keyword: string) => void;
  onUnpin?: (id: string) => void;
  onDelete?: (id: string) => void;
  onSelect?: (keyword: string) => void;
}

function Tree({ name, items, onPin, onUnpin, onDelete, onSelect }: TreeProps) {
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
            <SidebarMenuBadge>{totalCount}</SidebarMenuBadge>
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
                showTimestamp={true}
                timestamp={item.timestamp}
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
