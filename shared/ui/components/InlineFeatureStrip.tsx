"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";

export interface InlineFeatureStripProps {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}

/**
 * Composable strip: optional leading (e.g. icon + label) and optional trailing (0+ actions).
 * Layout only; consumers supply content.
 */
export function InlineFeatureStrip({
  leading,
  trailing,
  className,
}: InlineFeatureStripProps) {
  if (leading == null && trailing == null) {
    return null;
  }

  return (
    <div
      className={cn(
        "bg-background flex min-h-10 items-center justify-between gap-3 rounded-xl border px-2 py-2",
        className
      )}
    >
      {leading != null ? (
        <div className="text-foreground flex min-w-0 flex-1 items-center gap-2">
          {leading}
        </div>
      ) : (
        <div className="min-w-0 flex-1" />
      )}
      {trailing != null ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
