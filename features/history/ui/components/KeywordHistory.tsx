"use client";
import {
  ChevronRight,
  Folder,
  MoreHorizontal,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
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
        <Folder />
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
                <PinOff />
                Unpin keyword
              </>
            ) : (
              <>
                <Pin />
                Pin keyword
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDelete}>
            <Trash2 />
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
        <SidebarGroupLabel>Keyword history</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <Collapsible className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90">
              <CollapsibleTrigger asChild>
                <SidebarMenuButton>
                  <ChevronRight className="transition-transform" />
                  <Folder />
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

  return (
    <SidebarMenuItem>
      <Collapsible
        className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
        defaultOpen={name === "Today"}
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <ChevronRight className="transition-transform" />
            <Folder />
            {name}
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
