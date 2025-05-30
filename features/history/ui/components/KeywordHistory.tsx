"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Folder } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarHeader,
  SidebarInput,
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
} from "@/shared/ui/components/icons";
import { Button } from "@/shared/ui/components/Button";

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

// Type definitions for better type safety
interface KeywordItem {
  keyword: string;
  count: number;
  id: string;
  timestamp?: string;
}

interface KeywordHistory {
  pinned: KeywordItem[];
  history: Record<string, KeywordItem[]>;
}

// Mock data (replace with Convex backend fetch later)
const keywordHistory: KeywordHistory = {
  pinned: [
    { keyword: "web coder needed", count: 16, id: "1" },
    { keyword: "suck at web dev", count: 16, id: "2" },
  ],
  history: {
    Today: [
      {
        keyword: "web coder needed",
        count: 16,
        timestamp: "Mar 22, 2025",
        id: "3",
      },
      { keyword: "suck at web dev", count: 16, timestamp: "9h", id: "4" },
      { keyword: "web dev sucks", count: 16, timestamp: "10h", id: "5" },
    ],
    Yesterday: [
      {
        keyword: "web dev suck",
        count: 16,
        timestamp: "Mar 21, 2025",
        id: "6",
      },
      {
        keyword: "coding sucks",
        count: 12,
        timestamp: "Mar 21, 2025",
        id: "8",
      },
      {
        keyword: "mobile dev sucks",
        count: 8,
        timestamp: "Mar 21, 2025",
        id: "9",
      },
    ],
    "Last week": [
      {
        keyword: "need a web dev",
        count: 12,
        timestamp: "Mar 15, 2025",
        id: "7",
      },
      {
        keyword: "web development struggles",
        count: 10,
        timestamp: "Mar 14, 2025",
        id: "10",
      },
    ],
    Older: [
      {
        keyword: "web sucks sometimes",
        count: 5,
        timestamp: "Mar 10, 2025",
        id: "11",
      },
      {
        keyword: "development issues",
        count: 7,
        timestamp: "Mar 8, 2025",
        id: "12",
      },
    ],
  },
};

interface KeywordItemComponentProps {
  keyword: string;
  count: number;
  id: string;
  isPinned?: boolean;
  showTimestamp?: boolean;
  timestamp?: string;
  onPin?: (id: string) => void;
  onUnpin?: (id: string) => void;
  onDelete?: (id: string) => void;
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
}: KeywordItemComponentProps) {
  const handlePin = useCallback(() => {
    if (isPinned) {
      onUnpin?.(id);
    } else {
      onPin?.(id);
    }
  }, [isPinned, onUnpin, onPin, id]);

  const handleDelete = useCallback(() => {
    onDelete?.(id);
  }, [onDelete, id]);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton>
        <YoutubeSearchedForIcon className="fill-sidebar-foreground" />
        <span className="truncate text-sm">{keyword}</span>
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
}

function SearchHeader({
  searchQuery,
  onSearchChange,
  onNewKeyword,
}: SearchHeaderProps) {
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
          className="pl-8"
          aria-label="Search keywords"
        />
      </div>
    </SidebarHeader>
  );
}

export function KeywordHistory() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Flatten all keywords for searching
  const allKeywords = useMemo(() => {
    const keywords: (KeywordItem & { isPinned: boolean; source: string })[] =
      [];

    // Add pinned keywords
    keywordHistory.pinned.forEach((item) => {
      keywords.push({ ...item, isPinned: true, source: "pinned" });
    });

    // Add history keywords
    Object.entries(keywordHistory.history).forEach(([group, items]) => {
      items.forEach((item) => {
        keywords.push({ ...item, isPinned: false, source: group });
      });
    });

    return keywords;
  }, []);

  // Filter keywords based on search query
  const filteredKeywords = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return [];
    }

    const query = debouncedSearchQuery.toLowerCase();
    return allKeywords.filter((item) =>
      item.keyword.toLowerCase().includes(query)
    );
  }, [debouncedSearchQuery, allKeywords]);

  const handlePin = useCallback((id: string) => {
    console.log("Pin keyword:", id);
    // Implement pin logic here
  }, []);

  const handleUnpin = useCallback((id: string) => {
    console.log("Unpin keyword:", id);
    // Implement unpin logic here
  }, []);

  const handleDelete = useCallback((id: string) => {
    console.log("Delete keyword:", id);
    // Implement delete logic here
  }, []);

  const handleNewKeyword = useCallback(() => {
    console.log("Create new keyword");
    // Implement new keyword logic here
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const pinnedCount = keywordHistory.pinned.length;
  const isSearching = debouncedSearchQuery.trim().length > 0;

  // Render search results when searching
  if (isSearching) {
    return (
      <>
        <SearchHeader
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onNewKeyword={handleNewKeyword}
        />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredKeywords.length > 0 ? (
                filteredKeywords.map((item) => (
                  <KeywordItemComponent
                    key={item.id}
                    keyword={item.keyword}
                    count={item.count}
                    id={item.id}
                    isPinned={item.isPinned}
                    showTimestamp={!!item.timestamp}
                    timestamp={item.timestamp}
                    onPin={handlePin}
                    onUnpin={handleUnpin}
                    onDelete={handleDelete}
                  />
                ))
              ) : (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <span className="text-sidebar-foreground/60">
                      No keywords found for "{debouncedSearchQuery}"
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </>
    );
  }

  // Render normal sidebar content when not searching
  return (
    <>
      <SearchHeader
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onNewKeyword={handleNewKeyword}
      />

      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <Collapsible className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90">
              <CollapsibleTrigger asChild>
                <SidebarMenuButton>
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
                  {keywordHistory.pinned.map((item) => (
                    <KeywordItemComponent
                      key={item.id}
                      keyword={item.keyword}
                      count={item.count}
                      id={item.id}
                      isPinned={true}
                      onPin={handlePin}
                      onUnpin={handleUnpin}
                      onDelete={handleDelete}
                    />
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Navigation.</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <QuickPhrasesIcon className="fill-sidebar-foreground" />
                <span className="truncate">Replies</span>
                <SidebarMenuBadge>2</SidebarMenuBadge>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <GroupIcon className="fill-sidebar-foreground" />
                <span className="truncate">Customers</span>
                <SidebarMenuBadge>2</SidebarMenuBadge>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Collapsible className="group/collapsible [&[data-state=open]>button>svg:last-child]:rotate-90">
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton>
                    <SettingsIcon className="fill-sidebar-foreground" />
                    <span className="truncate">Settings</span>
                    <ChevronRightIcon className="ml-auto fill-sidebar-foreground transition-transform" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
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

      <SidebarGroup>
        <SidebarGroupLabel>Resources.</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <Collapsible className="group/collapsible [&[data-state=open]>button>svg:last-child]:rotate-90">
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton>
                    <DeveloperGuideIcon className="fill-sidebar-foreground" />
                    <span className="truncate">Get started</span>
                    <ChevronRightIcon className="ml-auto fill-sidebar-foreground transition-transform" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
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

      <SidebarGroup>
        <SidebarGroupLabel>Keywords tried.</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <Collapsible className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90">
              <CollapsibleTrigger asChild>
                <SidebarMenuButton>
                  <ChevronRightIcon className="fill-sidebar-foreground transition-transform" />
                  <SearchActivityIcon className="fill-sidebar-foreground" />
                  Keyword history
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {Object.entries(keywordHistory.history).map(
                    ([group, items], index) => (
                      <Tree
                        key={index}
                        name={group}
                        items={items}
                        onPin={handlePin}
                        onUnpin={handleUnpin}
                        onDelete={handleDelete}
                      />
                    )
                  )}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

interface TreeProps {
  name: string;
  items: KeywordItem[];
  onPin?: (id: string) => void;
  onUnpin?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function Tree({ name, items, onPin, onUnpin, onDelete }: TreeProps) {
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
          <SidebarMenuButton>
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
                count={item.count}
                id={item.id}
                isPinned={false}
                showTimestamp={true}
                timestamp={item.timestamp}
                onPin={onPin}
                onUnpin={onUnpin}
                onDelete={onDelete}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}
