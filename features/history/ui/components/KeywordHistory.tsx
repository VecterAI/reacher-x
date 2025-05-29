"use client";
import { ChevronRight, Folder, MoreHorizontal } from "lucide-react";
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
  TodayIcon,
  EventRepeatIcon,
  CalendarViewWeekIcon,
  CalendarClockIcon,
  DeleteIcon,
  DoNotDisturbOnIcon,
  KeepIcon,
  SearchActivityIcon,
  YoutubeSearchedForIcon,
} from "@/shared/ui/components/icons";

// Mock data (replace with Convex backend fetch later)
const keywordHistory = {
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
    ],
    "Last week": [
      {
        keyword: "need a web dev",
        count: 12,
        timestamp: "Mar 15, 2025",
        id: "7",
      },
    ],
    Older: [
      {
        keyword: "need a web dev",
        count: 12,
        timestamp: "Mar 15, 2025",
        id: "7",
      },
    ],
  },
};

interface KeywordItemProps {
  keyword: string;
  count: number;
  id: string;
  isPinned?: boolean;
  onPin?: (id: string) => void;
  onUnpin?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function KeywordItem({
  keyword,
  count,
  id,
  isPinned = false,
  onPin,
  onUnpin,
  onDelete,
}: KeywordItemProps) {
  const handlePin = () => {
    if (isPinned) {
      onUnpin?.(id);
    } else {
      onPin?.(id);
    }
  };

  const handleDelete = () => {
    onDelete?.(id);
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton className="pr-16">
        <YoutubeSearchedForIcon className="fill-sidebar-foreground" />
        <span className="truncate">{keyword}</span>
      </SidebarMenuButton>
      {/* <SidebarMenuBadge className="right-8">{count}</SidebarMenuBadge> */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            showOnHover
            className="opacity-0 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 sm:opacity-100 md:opacity-0 md:group-hover/menu-item:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <MoreHorizontal />
            <span className="sr-only">Open menu</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right">
          <DropdownMenuItem onClick={handlePin}>
            {isPinned ? (
              <>
                <DoNotDisturbOnIcon className="fill-popover-foreground" />
                Remove from “Pinned”
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

export function KeywordHistory() {
  const handlePin = (id: string) => {
    console.log("Pin keyword:", id);
    // Implement pin logic here
  };

  const handleUnpin = (id: string) => {
    console.log("Unpin keyword:", id);
    // Implement unpin logic here
  };

  const handleDelete = (id: string) => {
    console.log("Delete keyword:", id);
    // Implement delete logic here
  };

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Pinned keywords</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {keywordHistory.pinned.map((item) => (
              <KeywordItem
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
                  <ChevronRight className="transition-transform" />
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

function Tree({
  name,
  items,
  onPin,
  onUnpin,
  onDelete,
}: {
  name: string;
  items: { keyword: string; count: number; timestamp: string; id: string }[];
  onPin?: (id: string) => void;
  onUnpin?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  if (!items.length) {
    return null;
  }

  // Calculate total count of keywords in this group
  const totalCount = items.length;

  // Icon mapping for different time groups
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Today: TodayIcon,
    Yesterday: EventRepeatIcon,
    "Last week": CalendarViewWeekIcon,
    Older: CalendarClockIcon,
  };

  // Select the appropriate icon based on the group name, default to Folder if not found
  const Icon = iconMap[name] || Folder;

  return (
    <SidebarMenuItem>
      <Collapsible
        className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
        defaultOpen={name === "Today"}
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className="pr-16">
            <ChevronRight className="transition-transform" />
            <Icon className="fill-sidebar-foreground" />
            {name}
            <SidebarMenuBadge className="ml-auto">
              {totalCount}
            </SidebarMenuBadge>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((item) => (
              <div key={item.id} className="pl-4">
                <KeywordItem
                  keyword={item.keyword}
                  count={item.count}
                  id={item.id}
                  isPinned={false}
                  onPin={onPin}
                  onUnpin={onUnpin}
                  onDelete={onDelete}
                />
              </div>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}
