"use client";

import { EvidencePostsList } from "@/features/prospects/ui/components/EvidencePostsList";
import { InlinePostFeatureStrip } from "./InlinePostFeatureStrip";
import { cn } from "@/shared/lib/utils";

export interface InlinePostListCardProps {
  platform: "twitter" | "linkedin";
  title: string;
  posts: unknown[];
  prospectId?: string | null;
  context?: string | null;
  interactive?: boolean | null;
  onOpenPanel?: () => void;
}

export function InlinePostListCard({
  platform,
  title,
  posts,
  prospectId,
  context,
  interactive,
  onOpenPanel,
}: InlinePostListCardProps) {
  const canOpen = interactive !== false && Boolean(onOpenPanel);

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "border-border bg-background overflow-hidden rounded-xl border",
          canOpen && "transition-colors"
        )}
      >
        <EvidencePostsList
          prospectId={prospectId ?? undefined}
          posts={posts}
          platform={platform}
          readOnly
          maxItems={3}
          compact
          onPostSelect={canOpen ? () => onOpenPanel?.() : undefined}
        />
      </div>

      <InlinePostFeatureStrip
        title={title}
        context={context}
        interactive={interactive}
        onOpenPanel={onOpenPanel}
      />
    </div>
  );
}
