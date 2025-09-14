"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils/utils";
import { Button } from "./Button";
import { ArrowBackIcon } from "./icons";

export interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Reusable PageHeader component for consistent page layouts
 *
 * Features:
 * - Back navigation button (optional)
 * - Page title
 * - Action buttons (edit, search, etc.)
 * - Sticky positioning with border
 * - Flexible content area for additional elements
 *
 * Usage:
 * ```tsx
 * <PageHeader
 *   title="Workspace"
 *   onBack={() => router.back()}
 *   actions={
 *     <Button variant="ghost" size="sm">
 *       <Edit className="h-4 w-4" />
 *       Edit
 *     </Button>
 *   }
 * />
 * ```
 */
export const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ title, onBack, actions, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "sticky top-0 z-10 flex items-center justify-between border-b bg-background py-2 pl-2.5 pr-4",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-1">
          {onBack && (
            <Button
              variant="ghost"
              size="xsIcon"
              onClick={onBack}
              aria-label="Go back"
            >
              <ArrowBackIcon className="fill-current" />
            </Button>
          )}
          <h1 className="text-sm font-medium">{title}.</h1>
        </div>

        <div className="flex items-center gap-2">
          {children}
          {actions}
        </div>
      </div>
    );
  }
);

PageHeader.displayName = "PageHeader";

/**
 * PageLayout component that provides consistent container styling
 * with the right border and contained width as seen in the search page
 */
export interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
  showRightBorder?: boolean;
}

export const PageLayout = React.forwardRef<HTMLDivElement, PageLayoutProps>(
  ({ children, className, showRightBorder = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "w-full md:h-full md:w-[514px]",
          showRightBorder && "md:border-r md:border-border",
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

/**
 * PageContent component for the main content area
 */
export interface PageContentProps {
  children: React.ReactNode;
  className?: string;
}

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
