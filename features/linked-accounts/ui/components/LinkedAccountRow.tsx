"use client";

import React from "react";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  GoogleIcon,
  FilledLinkedinIcon,
  TwitterIcon,
} from "@/shared/ui/components/icons";
import { cn } from "@/shared/lib/utils";

export type LinkedAccountProvider = "google" | "twitter" | "linkedin";

function ProviderIcon({ provider }: { provider: LinkedAccountProvider }) {
  switch (provider) {
    case "twitter":
      return <TwitterIcon className="h-5 w-5" />;
    case "google":
      return <GoogleIcon className="h-5 w-5" />;
    case "linkedin":
      return <FilledLinkedinIcon className="h-5 w-5" />;
    default:
      return null;
  }
}

function providerTitle(provider: LinkedAccountProvider): string {
  switch (provider) {
    case "twitter":
      return "Twitter";
    case "google":
      return "Google";
    case "linkedin":
      return "LinkedIn";
    default:
      return provider;
  }
}

export interface LinkedAccountRowProps {
  id?: string;
  provider: LinkedAccountProvider;
  accountHandle: string;
  /** Right column: status text, buttons, or both (no row dividers). */
  renderRight: () => React.ReactNode;
  className?: string;
}

export function LinkedAccountRow({
  id,
  provider,
  accountHandle,
  renderRight,
  className,
}: LinkedAccountRowProps) {
  return (
    <article
      id={id}
      className={cn(
        "flex w-full max-w-full min-w-0 items-center gap-2 py-2 sm:gap-3",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <div className="bg-muted text-foreground shrink-0 rounded-md p-2">
          <ProviderIcon provider={provider} />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <h3 className="text-foreground min-w-0 truncate text-sm font-medium">
            {providerTitle(provider)}
          </h3>
          <p className="text-muted-foreground min-w-0 truncate font-mono text-sm">
            {accountHandle}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2">
        {renderRight()}
      </div>
    </article>
  );
}

export function LinkedAccountRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Skeleton className="size-9 shrink-0 rounded-md" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <Skeleton className="h-7 w-20 shrink-0" />
    </div>
  );
}

export function LinkedAccountsListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col" role="status" aria-label="Loading accounts">
      {Array.from({ length: rows }).map((_, i) => (
        <LinkedAccountRowSkeleton key={i} />
      ))}
    </div>
  );
}
