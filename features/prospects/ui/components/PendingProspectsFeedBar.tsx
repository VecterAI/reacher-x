/**
 * Manual merge control for newly discovered prospects that rank above the
 * stable feed anchor (avoids reordering the list until the user opts in).
 */
"use client";

import { AvatarStack } from "@/shared/ui/components/AvatarStack";
import { cn } from "@/shared/lib/utils";
import { RefreshIcon } from "@/shared/ui/components/icons";

export interface PendingProspectsFeedBarProps {
  pendingCount: number;
  pendingCountCapped: boolean;
  preview: Array<{
    prospectId: string;
    displayName: string;
    avatarUrl?: string;
  }>;
  entityPluralLower: string;
  onMerge: () => void;
  disabled?: boolean;
  className?: string;
}

export function PendingProspectsFeedBar({
  pendingCount,
  pendingCountCapped,
  preview,
  entityPluralLower,
  onMerge,
  disabled,
  className,
}: PendingProspectsFeedBarProps) {
  if (pendingCount <= 0) {
    return null;
  }

  const countLabel = `${pendingCount}${pendingCountCapped ? "+" : ""}`;
  const label = `Load ${countLabel} new ${entityPluralLower}`;

  return (
    <button
      type="button"
      onClick={onMerge}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "bg-background border-border flex w-full min-w-0 items-center gap-2 rounded-[12px] border p-2 text-left",
        disabled && "pointer-events-none opacity-60",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {preview.length > 0 ? (
          <AvatarStack
            size="sm"
            maxVisible={2}
            participants={preview.map((p) => ({
              name: p.displayName,
              avatarUrl: p.avatarUrl,
            }))}
          />
        ) : null}
        <span className="text-sm font-medium">
          <span>Load </span>
          <span className="text-muted-foreground font-mono font-semibold tabular-nums">
            {countLabel}
          </span>
          <span>{` new ${entityPluralLower}`}</span>
        </span>
      </div>
      <div className="border-border shrink-0 rounded-md border p-1">
        <RefreshIcon className="fill-current" aria-hidden />
      </div>
    </button>
  );
}
