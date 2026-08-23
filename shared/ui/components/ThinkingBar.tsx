"use client";

import { cn } from "@/lib/utils";
import { ChevronRightIcon } from "@/shared/ui/components/icons";

type ThinkingBarProps = {
  className?: string;
  text?: string;
  onStop?: () => void;
  stopLabel?: string;
  onClick?: () => void;
};

export function ThinkingBar({
  className,
  text = "Thinking",
  onStop,
  stopLabel = "Answer now",
  onClick,
}: ThinkingBarProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center gap-x-3 gap-y-1",
        className
      )}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex items-center gap-1 text-sm transition-opacity hover:opacity-80"
        >
          <span className="text-muted-foreground font-medium">{text}</span>
          <ChevronRightIcon className="text-muted-foreground size-4 fill-current" />
        </button>
      ) : (
        <span className="text-muted-foreground cursor-default font-medium">
          {text}
        </span>
      )}
      {onStop ? (
        <button
          onClick={onStop}
          type="button"
          className="text-muted-foreground hover:text-foreground border-muted-foreground/50 hover:border-foreground border-b border-dotted text-sm transition-colors"
        >
          {stopLabel}
        </button>
      ) : null}
    </div>
  );
}
