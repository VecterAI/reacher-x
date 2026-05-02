"use client";

import * as React from "react";
import { Button } from "@/shared/ui/components/Button";
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import { OpenInNewIcon } from "@/shared/ui/components/icons";
import { EvidencePostsList } from "@/features/prospects/ui/components/EvidencePostsList";

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
  return (
    <div className="space-y-3">
      <div className="border-border bg-background overflow-hidden rounded-xl border">
        <EvidencePostsList
          prospectId={prospectId ?? undefined}
          posts={posts}
          platform={platform}
          readOnly
          maxItems={3}
        />
      </div>

      <InlineFeatureStrip
        leading={
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{title} →</div>
            {context ? (
              <div className="text-muted-foreground truncate text-xs">
                {context}
              </div>
            ) : null}
          </div>
        }
        trailing={
          <>
            <Button
              size="xs"
              variant="outline"
              disabled={!interactive}
              onClick={() => onOpenPanel?.()}
            >
              View
            </Button>
            <Button
              size="xsIcon"
              variant="outline"
              disabled={!interactive}
              onClick={() => onOpenPanel?.()}
            >
              <OpenInNewIcon className="fill-current" />
            </Button>
          </>
        }
      />
    </div>
  );
}
