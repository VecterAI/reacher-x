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

import { useState } from "react";
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
import type { KeywordItem } from "@/features/keywords/ui/components/KeywordList";

// Tree Component for grouping keywords by time
interface TreeProps {
  name: string;
  items: (KeywordItem & { isPinned?: boolean })[];
  onPin?: (keyword: string) => void;
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
                isPinned={item.isPinned || false}
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

// Collapsed Menu Button Component
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
                    {typeof item.timestamp === "string" &&
                    (item.timestamp.includes("now") ||
                      item.timestamp.includes("h") ||
                      item.timestamp.includes("d") ||
                      item.timestamp.includes("m"))
                      ? item.timestamp
                      : formatRelativeTime(item.timestamp)}
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

// Main SidebarKeywords Component
export function SidebarKeywords() {
  const { state } = useSidebar();
  const {
    filteredGroupedHistory,
    pinnedKeywords,
    recentKeywords,
    handlePin,
    handleUnpin,
    handleDelete,
    handleKeywordSelect,
    handleKeywordItemSelect,
    pinnedCount,
  } = useSidebarContext();

  const isCollapsed = state === "collapsed";

  return (
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
                      />
                    )
                  )}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Pinned Keywords */}
          {isCollapsed ? (
            pinnedCount > 0 && (
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
            )
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
  );
}
