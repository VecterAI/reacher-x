"use client";

import * as React from "react";
import { buildSerializedTextState } from "@/features/composer/lib/buildSerializedTextState";
import { useViewerXComposerIdentity } from "@/features/composer/hooks/useViewerXComposerIdentity";
import { ReplyComposer } from "@/features/composer/ui/components/ReplyComposer";
import type {
  ComposerInitialMediaUpload,
  ToolbarConfig,
  ComposerIdentityUser,
  ComposerMediaKind,
} from "@/features/composer/types";
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import { Button } from "@/shared/ui/components/Button";
import { cn } from "@/shared/lib/utils";
import {
  ChangeHistoryIcon,
  OpenInNewIcon,
} from "@/shared/ui/components/icons";
import type {
  TwitterPostRef,
  TwitterPostSummary,
} from "@/shared/lib/twitter/contracts";
import { toFallbackTweetFromSummary } from "@/shared/lib/twitter/ui";
import { shouldIgnoreInlineCardClick } from "./inlineCardActivation";
import { PostCard } from "./PostCard";

const PREVIEW_TOOLBAR_CONFIG: ToolbarConfig = {
  showBold: false,
  showItalic: false,
  showEmoji: true,
  showMedia: true,
};

const FALLBACK_CURRENT_USER: ComposerIdentityUser = {
  name: "You",
  screenName: "you",
};

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|m4v|webm)$/i.test(url);
}

function isGifUrl(url: string): boolean {
  return /\.gif($|\?)/i.test(url);
}

function resolveMediaKind(
  explicitKind: unknown,
  url: string
): ComposerMediaKind {
  if (
    explicitKind === "image" ||
    explicitKind === "gif" ||
    explicitKind === "video"
  ) {
    return explicitKind;
  }

  if (isGifUrl(url)) {
    return "gif";
  }

  return isVideoUrl(url) ? "video" : "image";
}

export interface InlineReplyApprovalCardProps {
  status: string;
  draftContent?: string | null;
  mediaUrls?: string[];
  mediaDescriptions?: string[];
  mediaKinds?: Array<"image" | "gif" | "video">;
  sourcePostRef?: TwitterPostRef | null;
  sourcePostSummary?: TwitterPostSummary | null;
  sourceContext?: string | null;
  onOpenPanel?: () => void;
  reviewButtonLabel?: string;
  onApprove?: () => void | Promise<void>;
  onReject?: () => void | Promise<void>;
  pendingAction?: "approve" | "reject" | null;
  className?: string;
}

function getLeadingLabel(status: string) {
  if (status === "pending_approval") return "Input required →";
  if (status === "completed") return "Posted reply →";
  return "Reply preview →";
}

export function InlineReplyApprovalCard({
  status,
  draftContent,
  mediaUrls = [],
  mediaDescriptions = [],
  mediaKinds = [],
  sourcePostRef,
  sourcePostSummary,
  sourceContext,
  onOpenPanel,
  reviewButtonLabel = "Review",
  onApprove,
  onReject,
  pendingAction = null,
  className,
}: InlineReplyApprovalCardProps) {
  const { currentUser } = useViewerXComposerIdentity();

  const replyUsers = React.useMemo(() => {
    const handle =
      sourcePostSummary?.author?.handle ?? sourcePostRef?.authorHandle ?? "";
    const name = (sourcePostSummary?.author?.name ?? handle) || "user";

    if (!handle) {
      return [];
    }

    return [
      {
        screenName: handle,
        name,
      },
    ];
  }, [
    sourcePostRef?.authorHandle,
    sourcePostSummary?.author?.handle,
    sourcePostSummary?.author?.name,
  ]);

  const replyToTweet = React.useMemo(() => {
    if (sourcePostSummary) {
      return toFallbackTweetFromSummary(sourcePostSummary);
    }

    return {
      id_str: sourcePostRef?.postId ?? "",
    };
  }, [sourcePostRef?.postId, sourcePostSummary]);

  const canOpenPanel = typeof onOpenPanel === "function";
  const isPendingApproval = status === "pending_approval";
  const initialMediaUploads = React.useMemo<ComposerInitialMediaUpload[]>(
    () =>
      mediaUrls.map((url, index) => {
        const mediaKind = resolveMediaKind(mediaKinds[index], url);
        return {
          id: `reply-preview-media-${index}`,
          url,
          serverUrl: url,
          type: mediaKind === "video" ? "video" : "image",
          mediaKind,
          description: mediaDescriptions[index] || undefined,
        };
      }),
    [mediaDescriptions, mediaKinds, mediaUrls]
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        role={canOpenPanel ? "button" : undefined}
        tabIndex={canOpenPanel ? 0 : undefined}
        className={cn(
          "border-border overflow-hidden rounded-xl border",
          canOpenPanel &&
            "hover:bg-muted/30 focus-visible:ring-ring cursor-pointer transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2"
        )}
        aria-label={canOpenPanel ? reviewButtonLabel : undefined}
        onClick={
          canOpenPanel
            ? (event) => {
                if (shouldIgnoreInlineCardClick(event)) {
                  return;
                }
                onOpenPanel?.();
              }
            : undefined
        }
        onKeyDown={
          canOpenPanel
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenPanel?.();
                }
              }
            : undefined
        }
      >
        <div className="space-y-3 px-2 py-2">
          {sourcePostSummary ? (
            <PostCard
              platform="twitter"
              postRef={sourcePostRef ?? undefined}
              postSummary={sourcePostSummary}
              context={sourceContext ?? undefined}
              showFullContent={true}
              readOnly
              bodyLineClamp={3}
              showOpenGraphPreview={false}
            />
          ) : sourcePostRef?.postId ? (
            <div className="border-border rounded-xl border px-3 py-2">
              <p className="text-sm font-medium">
                Replying to {sourcePostRef.authorHandle ? `@${sourcePostRef.authorHandle}` : "this post"}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Source post preview is unavailable right now.
              </p>
            </div>
          ) : null}

          <ReplyComposer
            replyTo={{
              tweet: replyToTweet as never,
              users: replyUsers,
            }}
            currentUser={currentUser ?? FALLBACK_CURRENT_USER}
            initialContent={buildSerializedTextState(draftContent ?? "")}
            initialMediaUploads={initialMediaUploads}
            placeholder="Type here."
            previewMode
            disabled
            showCharacterCount={false}
            showToolbar
            showMediaUpload
            toolbarConfig={PREVIEW_TOOLBAR_CONFIG}
            toolbarPlacement="bottom"
            submitButtonVariant="icon"
            editorAreaClassName="min-h-0 text-sm"
            showMediaDescription
            showOpenGraphPreview={false}
            className="border-border pointer-events-none rounded-lg border p-2 opacity-90 select-none"
          />
        </div>
      </div>

      <InlineFeatureStrip
        leading={
          <>
            <div className="border-border rounded-md border p-1">
              <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
            </div>
            <span className="text-sm font-medium">{getLeadingLabel(status)}</span>
          </>
        }
        trailing={
          <>
            {isPendingApproval && onReject ? (
              <Button
                variant="ghost"
                size="xs"
                disabled={pendingAction !== null}
                onClick={() => void onReject()}
              >
                {pendingAction === "reject" ? "Rejecting..." : "Reject"}
              </Button>
            ) : null}
            {isPendingApproval && onApprove ? (
              <Button
                size="xs"
                disabled={pendingAction !== null}
                onClick={() => void onApprove()}
              >
                {pendingAction === "approve" ? "Approving..." : "Approve"}
              </Button>
            ) : null}
            {!isPendingApproval && canOpenPanel ? (
              <>
                <Button variant="outline" size="xs" onClick={onOpenPanel}>
                  {reviewButtonLabel}
                </Button>
              </>
            ) : null}
            {canOpenPanel ? (
              <Button variant="outline" size="xsIcon" onClick={onOpenPanel}>
                <OpenInNewIcon className="fill-current" />
              </Button>
            ) : null}
          </>
        }
      />
    </div>
  );
}
