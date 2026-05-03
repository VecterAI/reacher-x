"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import { ArrowBackIcon } from "@/shared/ui/components/icons";

export interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  /** Renders between the back control and the title (e.g. avatar). */
  titleLeading?: React.ReactNode;
  onBack?: () => void;
  backDisabled?: boolean;
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
    {
      title,
      titleLeading,
      onBack,
      backDisabled,
      actions,
      className,
      children,
      titleSuffix,
      ...props
    },
    ref
  ) => {
    return (
      <header
        ref={ref}
        className={cn(
          // Sticky header: account for fixed app header by default
          "bg-background sticky top-0 right-0 left-0 z-10 flex min-h-10 items-center justify-between border-b px-4 py-1",
          className
        )}
        {...props}
      >
        <div className="flex min-w-0 items-center gap-2">
          {onBack && (
            <Button
              variant="ghost"
              size="xsIcon"
              onClick={backDisabled ? undefined : onBack}
              aria-label="Go back"
              disabled={backDisabled}
              className={cn(
                "shrink-0",
                backDisabled && "cursor-default opacity-40"
              )}
            >
              <ArrowBackIcon className="fill-current" />
            </Button>
          )}
          {titleLeading ? (
            <span className="flex min-w-0 shrink-0 items-center">
              {titleLeading}
            </span>
          ) : null}
          <div className="flex min-w-0 items-center gap-0.5">
            <h1 className="min-w-0 truncate text-sm font-medium">{title}</h1>
            {titleSuffix ? (
              <span className="flex shrink-0 items-center">{titleSuffix}</span>
            ) : null}
          </div>
        </div>

        <div
          className="flex items-center gap-1"
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
