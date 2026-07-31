"use client";

import type { ReactNode } from "react";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import { Button } from "@/shared/ui/components/Button";
import { cn } from "@/shared/lib/utils";

type UrlDescriptionStatusLabelProps = {
  text: string;
  className?: string;
};

/** Spinner + status label shown while Exa auto-fill (or related) work runs. */
export function UrlDescriptionStatusLabel({
  text,
  className,
}: UrlDescriptionStatusLabelProps) {
  return (
    <AsciiSpinnerText
      text={text}
      className={cn(
        "text-muted-foreground inline-flex max-w-full min-w-0 text-sm",
        className
      )}
    />
  );
}

type UrlDescriptionStatusActionsProps = {
  statusText: string;
  onCancel?: () => void;
  showCancel?: boolean;
  className?: string;
  labelClassName?: string;
};

/**
 * Left status label + optional Cancel. Compose into a footer row alongside
 * (or instead of) send / counter actions.
 */
export function UrlDescriptionStatusActions({
  statusText,
  onCancel,
  showCancel = false,
  className,
  labelClassName,
}: UrlDescriptionStatusActionsProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-2",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <UrlDescriptionStatusLabel
          text={statusText}
          className={labelClassName}
        />
      </div>
      {showCancel && onCancel ? (
        <Button type="button" size="xs" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
    </div>
  );
}

type UrlDescriptionFooterSlotProps = {
  statusText: string | null;
  isReadingUrl: boolean;
  onCancel: () => void;
  idleLeft: ReactNode;
  idleRight: ReactNode;
  className?: string;
};

/**
 * Footer slot for idle actions vs auto-fill status.
 *
 * Idle controls stay mounted (visibility hidden while status shows) so the
 * row height never changes. Status overlays on top — no CLS from
 * "Auto-filling…" appearing.
 */
export function UrlDescriptionFooterSlot({
  statusText,
  isReadingUrl,
  onCancel,
  idleLeft,
  idleRight,
  className,
}: UrlDescriptionFooterSlotProps) {
  const showStatus = Boolean(statusText);

  return (
    <div className={cn("relative w-full", className)}>
      <div
        className={cn(
          "flex w-full items-center justify-between gap-2",
          showStatus && "invisible"
        )}
        aria-hidden={showStatus || undefined}
      >
        <div className="min-w-0 flex-1">{idleLeft}</div>
        <div className="flex items-center gap-1">{idleRight}</div>
      </div>

      {showStatus && statusText ? (
        <div className="absolute inset-0 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <UrlDescriptionStatusLabel text={statusText} />
          </div>
          {isReadingUrl ? (
            <Button type="button" size="xs" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
