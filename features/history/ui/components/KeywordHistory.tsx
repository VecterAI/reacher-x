"use client";

import * as React from "react";
import { ChevronRight, Folder } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
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

// Mock data (replace with Convex backend fetch later)
const keywordHistory = {
  pinned: [
    { keyword: "web coder needed", count: 16 },
    { keyword: "suck at web dev", count: 16 },
  ],
  history: {
    Today: [
      { keyword: "web coder needed", count: 16, timestamp: "Mar 22, 2025" },
      { keyword: "suck at web dev", count: 16, timestamp: "9h" },
      { keyword: "web dev sucks", count: 16, timestamp: "10h" },
    ],
    Yesterday: [
      { keyword: "web dev suck", count: 16, timestamp: "Mar 21, 2025" },
    ],
    "Last week": [
      { keyword: "need a web dev", count: 12, timestamp: "Mar 15, 2025" },
    ],
  },
};

export function KeywordHistory() {
  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Pinned keywords</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {keywordHistory.pinned.map((item, index) => (
              <SidebarMenuItem key={index}>
                <SidebarMenuButton>{item.keyword}</SidebarMenuButton>
                <SidebarMenuBadge>{item.count}</SidebarMenuBadge>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Keyword history</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {Object.entries(keywordHistory.history).map(
              ([group, items], index) => (
                <Tree key={index} name={group} items={items} />
              )
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

function Tree({
  name,
  items,
}: {
  name: string;
  items: { keyword: string; count: number; timestamp: string }[];
}) {
  if (!items.length) {
    return null; // Handle empty groups if needed
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
            {items.map((item, index) => (
              <SidebarMenuItem key={index} className="pl-4">
                <SidebarMenuButton>
                  <Folder />
                  {item.keyword}
                </SidebarMenuButton>
                <SidebarMenuBadge>{item.count}</SidebarMenuBadge>
              </SidebarMenuItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}
