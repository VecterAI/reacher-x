"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import { ArrowBackIcon } from "@/shared/ui/components/icons";

export interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  titleSuffix?: React.ReactNode;
}

/**
 * PageHeader component for webapp pages
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
export const PageHeader = React.forwardRef<HTMLElement, PageHeaderProps>(
  (
    { title, onBack, actions, className, children, titleSuffix, ...props },
    ref
  ) => {
    return (
      <header
        ref={ref}
        className={cn(
          // Sticky header: account for fixed app header by default
          "bg-background sticky top-0 right-0 left-0 z-10 flex items-center justify-between border-b py-2 pr-4 pl-2.5",
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
          <h1 className="text-sm font-medium">{title}</h1>
          {titleSuffix}
        </div>

        <div
          className="flex items-center gap-2"
          role="toolbar"
          aria-label="Page actions"
        >
          {children}
          {actions}
        </div>
      </header>
    );
  }
);

PageHeader.displayName = "PageHeader";
