"use client";

import * as React from "react";
import { buildSerializedTextState } from "@/features/composer/lib/buildSerializedTextState";
import { useViewerXComposerIdentity } from "@/features/composer/hooks/useViewerXComposerIdentity";
import { ComposerSurfaceSkeleton } from "@/features/composer/ui/components/ComposerSurfaceSkeleton";
import { ReplyComposer } from "@/features/composer/ui/components/ReplyComposer";
import type {
  ComposerInitialMediaUpload,
  ToolbarConfig,
  ComposerIdentityUser,
  ComposerMediaKind,
} from "@/features/composer/types";
import type { Tweet as TweetType } from "@/features/threads/types";
import { ThreadAwareTwitterReplyBody } from "@/features/prospects/ui/components/ThreadAwareTwitterReplyBody";
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import { Button } from "@/shared/ui/components/Button";
import { cn } from "@/shared/lib/utils";
import { ChangeHistoryIcon, OpenInNewIcon } from "@/shared/ui/components/icons";
import type {
  TwitterPostRef,
  TwitterPostSummary,
} from "@/shared/lib/twitter/contracts";
import { toFallbackTweetFromSummary } from "@/shared/lib/twitter/ui";
import { X_POST_WEIGHTED_MAX } from "@/shared/lib/twitter/xPostTextLimit";
import { TweetSkeleton } from "@/features/webapp/ui/components/tweet";

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

const EMPTY_MEDIA_URLS: string[] = [];
const EMPTY_MEDIA_DESCRIPTIONS: string[] = [];
const EMPTY_MEDIA_KINDS: ComposerMediaKind[] = [];

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
  mediaKinds?: ComposerMediaKind[];
  sourcePostRef?: TwitterPostRef | null;
  sourcePostSummary?: TwitterPostSummary | null;
  targetTweetId?: string | null;
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

function getReplyUsers(args: {
  tweet?: TweetType | null;
  sourcePostRef?: TwitterPostRef | null;
  sourcePostSummary?: TwitterPostSummary | null;
}) {
  const handle =
    args.tweet?.user?.screen_name ??
    args.sourcePostSummary?.author?.handle ??
    args.sourcePostRef?.authorHandle ??
    "";
  const name =
    args.tweet?.user?.name ??
    args.sourcePostSummary?.author?.name ??
    (handle || "user");

  if (!handle) {
    return [];
  }

  return [
    {
      screenName: handle,
      name,
    },
  ];
}

export function InlineReplyApprovalCard({
  status,
  draftContent,
  mediaUrls = EMPTY_MEDIA_URLS,
  mediaDescriptions = EMPTY_MEDIA_DESCRIPTIONS,
  mediaKinds = EMPTY_MEDIA_KINDS,
  sourcePostRef,
  sourcePostSummary,
  targetTweetId,
  onOpenPanel,
  reviewButtonLabel = "Review",
  onApprove,
  onReject,
  pendingAction = null,
  className,
}: InlineReplyApprovalCardProps) {
  const { connectionStatus, currentUser } = useViewerXComposerIdentity();

  const sourceTweetId =
    sourcePostRef?.postId ?? sourcePostSummary?.ref.postId ?? targetTweetId;
  const initialTweet = React.useMemo(
    () =>
      sourcePostSummary
        ? (toFallbackTweetFromSummary(sourcePostSummary) as TweetType)
        : undefined,
    [sourcePostSummary]
  );

  const canOpenPanel = typeof onOpenPanel === "function";
  const isPendingApproval = status === "pending_approval";
  const maxLength =
    connectionStatus?.postComposerMaxLength ?? X_POST_WEIGHTED_MAX;
  const characterCountMode =
    connectionStatus?.postComposerCountMode ?? "x_post";
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

  const previewContent = (
    <div className="space-y-3 px-2 py-2">
      {sourceTweetId ? (
        <ThreadAwareTwitterReplyBody
          tweetId={sourceTweetId}
          initialTweet={initialTweet}
          renderLoadingState={() => (
            <div className="space-y-3">
              <TweetSkeleton showThread={true} />
              <ComposerSurfaceSkeleton compact submitLabel="Reply" />
            </div>
          )}
          loadingContainerClassName="mx-0"
          errorClassName="mx-0"
          timelineContainerClassName="mx-0"
          repliesContainerClassName="divide-y-0"
          loadMoreContainerClassName="px-0"
          showRepliesAfterComposer={false}
          showLoadMoreReplies={false}
          showFocusedTweetFullContent={false}
          focusedTweetBodyLineClamp={3}
          renderComposerSection={(tweet) => (
            <ReplyComposer
              replyTo={{
                tweet,
                users: getReplyUsers({
                  tweet,
                  sourcePostRef,
                  sourcePostSummary,
                }),
              }}
              currentUser={currentUser ?? FALLBACK_CURRENT_USER}
              initialContent={buildSerializedTextState(draftContent ?? "")}
              initialMediaUploads={initialMediaUploads}
              maxLength={maxLength}
              characterCountMode={characterCountMode}
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
              className="pointer-events-none opacity-90 select-none"
            />
          )}
        />
      ) : (
        <ReplyComposer
          replyTo={{
            tweet: { id_str: "" } as TweetType,
            users: getReplyUsers({ sourcePostRef, sourcePostSummary }),
          }}
          currentUser={currentUser ?? FALLBACK_CURRENT_USER}
          initialContent={buildSerializedTextState(draftContent ?? "")}
          initialMediaUploads={initialMediaUploads}
          maxLength={maxLength}
          characterCountMode={characterCountMode}
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
          className="pointer-events-none opacity-90 select-none"
        />
      )}
    </div>
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="border-border overflow-hidden rounded-xl border">
        {previewContent}
      </div>

      <InlineFeatureStrip
        leading={
          <>
            <div className="border-border rounded-md border p-1">
              <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
            </div>
            <span className="text-sm font-medium">
              {getLeadingLabel(status)}
            </span>
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
