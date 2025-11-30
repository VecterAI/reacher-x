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

import { usePathname } from "next/navigation";
import {
  SidebarHeader,
  SidebarInput,
  useSidebar,
} from "@/shared/ui/components/Sidebar";
import { SearchIcon } from "@/shared/ui/components/icons";

export function SidebarSearchHeader() {
  const pathname = usePathname();
  const isOnboarding = pathname.startsWith("/onboarding");
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  // Collapsed view - no search input
  if (isCollapsed) {
    return <SidebarHeader />;
  }

  // Expanded view with search input (placeholder for v4)
  return (
    <SidebarHeader>
      <div className="relative">
        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 fill-muted-foreground" />
        <SidebarInput
          type="text"
          placeholder="Search..."
          className="h-9 pl-8"
          aria-label="Search"
          disabled={isOnboarding}
        />
      </div>
    </SidebarHeader>
  );
}
