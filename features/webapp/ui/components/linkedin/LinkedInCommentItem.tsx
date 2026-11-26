"use client";

import * as React from "react";
import type { SerializedEditorState } from "lexical";
import type {
  LinkedInCommentPage,
  LinkedInPostComment,
} from "@/shared/lib/linkedin/comments";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { Button } from "@/shared/ui/components/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import { MoreHorizIcon, OpenInNewIcon } from "@/shared/ui/components/icons";
import { formatRelativeTime } from "@/shared/lib/utils";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { LinkedInReplyComposer } from "./LinkedInReplyComposer";
import { LinkedInReplyList } from "./LinkedInReplyList";
import {
  buildLinkedInCommentAuthorMentionEntity,
  buildLinkedInPostMentionEntities,
} from "./linkedinComposerMentions";
import { useLinkedInProfileNavigation } from "./useLinkedInProfileNavigation";
import type { LinkedInProfileIdentity } from "@/shared/lib/linkedin/profile";

export interface LinkedInCommentItemProps {
  comment: LinkedInPostComment;
  sourcePost?: UnifiedPost;
  prospectId?: string;
  showReplyComposer?: boolean;
  replyComposerKey?: string;
  replyComposerInitialValue?: string;
  repliesPage?: LinkedInCommentPage;
  repliesLoading?: boolean;
  repliesError?: string | null;
  disabled?: boolean;
  likePending?: boolean;
  onLike?: () => void;
  onToggleReplies?: () => void;
  onLoadMoreReplies?: () => void;
  onToggleReplyComposer?: () => void;
  onReplySubmit?: (
    content: SerializedEditorState,
    mediaUrls?: string[],
    mediaDescriptions?: string[]
  ) => void | Promise<void>;
  children?: React.ReactNode;
}

export function LinkedInCommentItem({
  comment,
  sourcePost,
  prospectId,
  showReplyComposer = false,
  replyComposerKey,
  replyComposerInitialValue,
  repliesPage,
  repliesLoading = false,
  repliesError,
  disabled = false,
  likePending = false,
  onLike,
  onToggleReplies,
  onLoadMoreReplies,
  onToggleReplyComposer,
  onReplySubmit,
  children,
}: LinkedInCommentItemProps) {
  const openLinkedInProfile = useLinkedInProfileNavigation();
  const authorInitial = comment.author.name.charAt(0).toUpperCase();
  const authorIdentity = React.useMemo<LinkedInProfileIdentity>(
    () => ({
      entityType: "person",
      displayName: comment.author.name,
      headline: comment.author.headline,
      avatarUrl: comment.author.avatarUrl,
      profileUrl: comment.author.profileUrl,
      providerId: comment.author.id,
    }),
    [comment.author]
  );
  const replyMentionEntities = React.useMemo(
    () =>
      buildLinkedInPostMentionEntities({
        post: sourcePost ?? {
          id: comment.postId,
          platform: "linkedin",
          text: "",
          createdAt: getCurrentUTCTimestamp(),
          author: {},
        },
        comments: [comment, ...(repliesPage?.items ?? [])],
        extraPeople: [buildLinkedInCommentAuthorMentionEntity(comment)],
      }),
    [comment, repliesPage?.items, sourcePost]
  );

  return (
    <article className="flex items-start gap-3">
      <button
        type="button"
        className="shrink-0"
        onClick={() => openLinkedInProfile(authorIdentity)}
        aria-label={`View ${comment.author.name} profile`}
      >
        <Avatar className="ring-border size-8 ring-1">
          <AvatarImage
            src={comment.author.avatarUrl}
            alt={comment.author.name}
          />
          <AvatarFallback>{authorInitial}</AvatarFallback>
        </Avatar>
      </button>

      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                className="truncate text-left text-sm font-medium hover:underline"
                onClick={() => openLinkedInProfile(authorIdentity)}
              >
                {comment.author.name}
              </button>
              {comment.createdAt ? (
                <span className="text-muted-foreground shrink-0 text-xs">
                  · {formatRelativeTime(comment.createdAt)}
                </span>
              ) : null}
              {comment.edited ? (
                <span className="text-muted-foreground shrink-0 text-xs">
                  (edited)
                </span>
              ) : null}
            </div>
            {comment.author.headline ? (
              <p className="text-muted-foreground truncate text-xs">
                {comment.author.headline}
              </p>
            ) : null}
          </div>

          {comment.permalink ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="xsIcon" aria-label="Comment menu">
                  <MoreHorizIcon className="fill-current" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    window.open(
                      comment.permalink,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                >
                  <OpenInNewIcon className="fill-current" />
                  Open on LinkedIn
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <p className="text-sm whitespace-pre-wrap">{comment.text}</p>

        <div className="text-muted-foreground flex flex-wrap items-center gap-1 pl-1 text-xs">
          <Button
            variant="ghost"
            size="xs"
            className={comment.viewerReacted ? "text-foreground" : undefined}
            disabled={!onLike || !comment.canReact || likePending}
            onClick={onLike}
          >
            {comment.viewerReacted ? "Liked" : "Like"}
            {comment.reactionCount > 0 ? ` ${comment.reactionCount}` : ""}
          </Button>
          {onToggleReplyComposer ? (
            <Button
              variant="ghost"
              size="xs"
              disabled={disabled}
              onClick={onToggleReplyComposer}
            >
              Reply
            </Button>
          ) : null}
          {comment.replyCount > 0 && onToggleReplies ? (
            <Button variant="ghost" size="xs" onClick={onToggleReplies}>
              {repliesPage
                ? "Collapse replies"
                : `View replies ${comment.replyCount}`}
            </Button>
          ) : null}
        </div>

        {showReplyComposer && onReplySubmit ? (
          <div className="pl-1">
            <LinkedInReplyComposer
              key={replyComposerKey}
              prospectId={prospectId}
              placeholder={`Reply to ${comment.author.name}...`}
              submitLabel="Reply"
              initialValue={replyComposerInitialValue}
              disabled={disabled}
              localMentionEntities={replyMentionEntities}
              replyToText={
                sourcePost?.text
                  ? `Post by ${sourcePost.author.name}: ${sourcePost.text}\nComment by ${comment.author.name}: ${comment.text}`
                  : comment.text
              }
              replyToAuthorHandle={comment.author.name}
              onCancel={onToggleReplyComposer}
              onSubmit={onReplySubmit}
            />
          </div>
        ) : null}

        {repliesPage || repliesLoading || repliesError ? (
          <LinkedInReplyList
            page={repliesPage}
            loading={repliesLoading}
            error={repliesError}
            onLoadMore={onLoadMoreReplies}
          >
            {children}
          </LinkedInReplyList>
        ) : null}
      </div>
    </article>
  );
}
