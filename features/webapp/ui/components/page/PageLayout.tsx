"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";

export interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Horizontal border contract for a panel rendered beside primary content.
 * Mobile panels stay edge-to-edge; desktop panels own the divider on the left.
 */
export const DESKTOP_PANEL_BORDER_CLASS_NAME =
  "border-x-0 md:border-border md:border-l md:border-r-0";

/**
 * PageLayout component that provides consistent container styling
 * for webapp pages with a contained width. Positional borders belong to the
 * page or panel container because PageLayout is used in both roles.
 */
export const PageLayout = React.forwardRef<HTMLDivElement, PageLayoutProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-page-layout
        className={cn("h-full w-full max-w-lg min-w-0 border-x-0", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

PageLayout.displayName = "PageLayout";
