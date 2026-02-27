"use client";

import { Button } from "@/shared/ui/components/Button";
import { cn } from "@/shared/lib/utils";
import { PostCard, type PostCardProps } from "./PostCard";
import type { AgentPanelMode } from "../../lib";

export interface InlinePanelTriggerCardProps extends PostCardProps {
  panelMode?: AgentPanelMode;
  onOpenPanel: () => void;
}

function getButtonCopy(mode?: AgentPanelMode): string {
  if (mode === "posted") return "View posted reply";
  return "View post";
}

export function InlinePanelTriggerCard({
  panelMode,
  onOpenPanel,
  className,
  context: _context,
  ...postCardProps
}: InlinePanelTriggerCardProps) {
  return (
    <div
      className={cn(
        "group border-border relative overflow-hidden rounded-xl border p-2",
        className
      )}
    >
      <PostCard {...postCardProps} />

      <div
        role="button"
        tabIndex={0}
        className="bg-background/80 group-hover:bg-background/70 absolute inset-0 z-10 flex cursor-pointer items-center justify-center transition-colors"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenPanel();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onOpenPanel();
          }
        }}
        aria-label={getButtonCopy(panelMode)}
      >
        <Button size="xs" tabIndex={-1} asChild>
          <span>{getButtonCopy(panelMode)}</span>
        </Button>
      </div>
    </div>
  );
}
