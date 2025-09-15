"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils/utils";

export interface PageContentProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * PageContent component for the main content area of webapp pages
 */
export const PageContent = React.forwardRef<HTMLDivElement, PageContentProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-4", className)} {...props}>
        {children}
      </div>
    );
  }
);

PageContent.displayName = "PageContent";
