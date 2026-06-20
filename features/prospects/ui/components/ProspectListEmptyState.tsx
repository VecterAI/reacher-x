"use client";

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export interface ProspectListEmptyStateProps {
  title: string;
  description?: string;
  icon: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function ProspectListEmptyState({
  title,
  description,
  icon,
  className,
  children,
}: ProspectListEmptyStateProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-h-[280px] items-start justify-center px-3 pt-12 pb-16 text-center",
        className
      )}
    >
      <div className="max-w-[28rem]">
        <div className="mx-auto mb-3 flex justify-center">{icon}</div>
        <p className="text-foreground text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm text-pretty">
            {description}
          </p>
        ) : null}
        {children ? (
          <div className="text-foreground mt-4 flex flex-col items-center gap-2">
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}
