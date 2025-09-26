"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils/utils";
import { Button } from "@/shared/ui/components/Button";
import { ArrowBackIcon } from "@/shared/ui/components/icons";

export interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  titleSuffix?: React.ReactNode;
  /**
   * Tailwind class controlling the sticky offset from the top.
   * Defaults to `top-12` to account for the fixed app header height.
   */
  stickyOffsetClassName?: string;
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
    {
      title,
      onBack,
      actions,
      className,
      children,
      titleSuffix,
      stickyOffsetClassName = "top-12",
      ...props
    },
    ref
  ) => {
    return (
      <header
        ref={ref}
        className={cn(
          // Sticky header: account for fixed app header by default
          "sticky left-0 right-0 z-10 flex items-center justify-between border-b bg-background py-2 pl-2.5 pr-4",
          stickyOffsetClassName,
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
