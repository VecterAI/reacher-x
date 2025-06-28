"use client";
/**
 * SidebarContentWrapper Component
 *
 * Manages the dynamic content area of the sidebar.
 * Shows search results when searching, otherwise shows the provided children.
 *
 * References:
 * - Conditional Rendering: https://react.dev/learn/conditional-rendering
 * - Children Prop Pattern: https://react.dev/learn/passing-props-to-a-component#passing-jsx-as-children
 */

import { ReactNode } from "react";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/shared/ui/components/Sidebar";
import { useSidebarContext } from "@/features/webapp/contexts/SidebarContext";
import { KeywordItemComponent } from "./SidebarKeywordsShared";

interface SidebarContentWrapperProps {
  children: ReactNode;
}

export function SidebarContentWrapper({
  children,
}: SidebarContentWrapperProps) {
  const { state } = useSidebar();
  const {
    isSearching,
    filteredKeywords,
    searchQuery,
    handlePin,
    handleUnpin,
    handleDelete,
    handleKeywordSelect,
  } = useSidebarContext();

  const isCollapsed = state === "collapsed";

  return (
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
                    onPin={handlePin}
                    onUnpin={handleUnpin}
                    onDelete={handleDelete}
                    onSelect={handleKeywordSelect}
                    highlightQuery={searchQuery}
                  />
                ))
              ) : (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <span className="text-sidebar-foreground/60">
                      No keywords found for &ldquo;{searchQuery}
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
        children
      )}
    </SidebarContent>
  );
}
