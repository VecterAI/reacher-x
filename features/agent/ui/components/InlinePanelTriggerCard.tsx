"use client";

import { cn } from "@/shared/lib/utils";
import { PostCard, type PostCardProps } from "./PostCard";
import type { AgentPanelMode } from "../../lib";
import { shouldIgnoreInlineCardClick } from "./inlineCardActivation";
import { InlinePostFeatureStrip } from "./InlinePostFeatureStrip";

export interface InlinePanelTriggerCardProps extends PostCardProps {
  panelMode?: AgentPanelMode;
  onOpenPanel: () => void;
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
  const handleActivate = (event: React.MouseEvent<HTMLDivElement>) => {
    if (shouldIgnoreInlineCardClick(event)) {
      return;
    }
    onOpenPanel();
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div
        role="button"
        tabIndex={0}
        className="group border-border hover:bg-muted/30 focus-visible:ring-ring cursor-pointer overflow-hidden rounded-xl border p-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
        aria-label={getAriaLabel(panelMode)}
        onClick={handleActivate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenPanel();
          }
        }}
      >
        <PostCard
          {...postCardProps}
          showFullContent={true}
          readOnly
          bodyLineClamp={3}
          showOpenGraphPreview={false}
          showMenu={true}
          showSource={false}
          showFooter={false}
          interactiveCursor={true}
        />
      </div>

      <InlinePostFeatureStrip title="Post" onOpenPanel={onOpenPanel} />
    </div>
  );
}
