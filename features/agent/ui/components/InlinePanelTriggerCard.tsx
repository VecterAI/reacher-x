"use client";

import { cn } from "@/shared/lib/utils";
import { PostCard, type PostCardProps } from "./PostCard";
import type { AgentPanelMode } from "../../lib";
import { shouldIgnoreInlineCardClick } from "./inlineCardActivation";
import { InlinePostFeatureStrip } from "./InlinePostFeatureStrip";

export interface InlinePanelTriggerCardProps extends PostCardProps {
  panelMode?: AgentPanelMode;
  onOpenPanel?: () => void;
}

function getAriaLabel(mode?: AgentPanelMode): string {
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
  const isInteractive = typeof onOpenPanel === "function";
  const postCard = (
    <PostCard
      {...postCardProps}
      showFullContent={true}
      readOnly
      bodyLineClamp={3}
      showOpenGraphPreview={false}
      showMenu={true}
      showSource={false}
      showFooter={false}
      interactiveCursor={isInteractive}
    />
  );

  const handleActivate = (event: React.MouseEvent<HTMLDivElement>) => {
    if (shouldIgnoreInlineCardClick(event)) {
      return;
    }
    onOpenPanel?.();
  };

  return (
    <div className={cn("space-y-3", className)}>
      {isInteractive ? (
        <div
          role="button"
          tabIndex={0}
          className="group border-border focus-visible:ring-ring cursor-pointer overflow-hidden rounded-xl border p-2 transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden dark:hover:bg-neutral-950"
          aria-label={getAriaLabel(panelMode)}
          onClick={handleActivate}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpenPanel?.();
            }
          }}
        >
          {postCard}
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-xl border p-2">
          {postCard}
        </div>
      )}

      <InlinePostFeatureStrip
        title="Post"
        interactive={isInteractive}
        onOpenPanel={onOpenPanel}
      />
    </div>
  );
}
