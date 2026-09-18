"use client";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import { CloseIcon } from "@/shared/ui/components/icons";
import { TextShimmer } from "@/shared/ui/components/TextShimmer";

export type HighLoadNoticeState = "queued" | "slow";

/** User-facing banner copy, exported so toasts can reuse the same wording. */
export const HIGH_LOAD_NOTICE_COPY: Record<HighLoadNoticeState, string> = {
  queued:
    "We're under heavy load, so this may take longer than expected. Everything is still working.",
  slow: "We're under heavy load, so things are slower than usual right now. Everything is still working.",
};

interface HighLoadNoticeProps {
  /** "queued" = request waiting to start, "slow" = running but slower. */
  state?: HighLoadNoticeState;
  /** Link to a help channel (e.g. X_PROFILE_URL). Renders a "Get help" button. */
  helpHref?: string;
  /** When provided, shows the dismiss button used by the plan limit notice. */
  onDismiss?: () => void;
  dismissing?: boolean;
  className?: string;
}

/**
 * Site-wide "we're busy" banner shown above page content, styled after the
 * plan usage notice. Presentational only: callers decide when to render it
 * and how dismissal is persisted.
 */
export function HighLoadNotice({
  state = "queued",
  helpHref,
  onDismiss,
  dismissing = false,
  className,
}: HighLoadNoticeProps) {
  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="High load notice"
      data-high-load-notice=""
      data-high-load-notice-state={state}
      className={cn(
        "bg-muted/20 relative shrink-0 border-b px-4 py-3 sm:py-2",
        onDismiss && "pr-12",
        className
      )}
    >
      <div className="flex items-start gap-3 sm:items-center sm:gap-2">
        <span
          aria-hidden
          className="relative mt-1.5 flex size-2 shrink-0 sm:mt-0"
        >
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
          <TextShimmer
            as="p"
            className="font-pixel-square text-sm text-pretty sm:flex-1 sm:basis-60"
          >
            {HIGH_LOAD_NOTICE_COPY[state]}
          </TextShimmer>
          {helpHref ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="xs">
                <a href={helpHref} target="_blank" rel="noreferrer">
                  Get help
                </a>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      {onDismiss ? (
        <Button
          variant="ghost"
          size="xsIcon"
          className="absolute top-2 right-3"
          aria-label="Dismiss high load notice"
          disabled={dismissing}
          onClick={onDismiss}
        >
          <CloseIcon className="size-4 fill-current" />
        </Button>
      ) : null}
    </aside>
  );
}
