"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils/utils";

export interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * PageLayout component that provides consistent container styling
 * for webapp pages with the right border and contained width
 */
export const PageLayout = React.forwardRef<HTMLDivElement, PageLayoutProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "w-full max-w-lg md:h-full md:border-r md:border-border",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

PageLayout.displayName = "PageLayout";
