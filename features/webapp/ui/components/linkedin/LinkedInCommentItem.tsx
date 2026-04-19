"use client";

import * as React from "react";
import type { SerializedEditorState } from "lexical";
import type { LinkedInCommentPage, LinkedInPostComment } from "@/shared/lib/linkedin/comments";
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
import { LinkedInReplyComposer } from "./LinkedInReplyComposer";
import { LinkedInReplyList } from "./LinkedInReplyList";

export interface LinkedInCommentItemProps {
  comment: LinkedInPostComment;
  prospectId?: string;
  showReplyComposer?: boolean;
  repliesPage?: LinkedInCommentPage;
  repliesLoading?: boolean;
  repliesError?: string | null;
  disabled?: boolean;
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
  prospectId,
  showReplyComposer = false,
  repliesPage,
  repliesLoading = false,
  repliesError,
  disabled = false,
  onToggleReplies,
  onLoadMoreReplies,
  onToggleReplyComposer,
  onReplySubmit,
  children,
}: LinkedInCommentItemProps) {
  const authorInitial = comment.author.name.charAt(0).toUpperCase();

  return (
    <article className="flex items-start gap-3">
      <Avatar className="ring-border size-8 shrink-0 ring-1">
        <AvatarImage src={comment.author.avatarUrl} alt={comment.author.name} />
        <AvatarFallback>{authorInitial}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-medium">
                {comment.author.name}
              </span>
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
                    window.open(comment.permalink, "_blank", "noopener,noreferrer")
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
          <Button variant="ghost" size="xs" disabled>
            Like{comment.reactionCount > 0 ? ` ${comment.reactionCount}` : ""}
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
              {repliesPage ? "Collapse replies" : `View replies ${comment.replyCount}`}
            </Button>
          ) : null}
        </div>

        {showReplyComposer && onReplySubmit ? (
          <div className="pl-1">
            <LinkedInReplyComposer
              prospectId={prospectId}
              placeholder={`Reply to ${comment.author.name}...`}
              submitLabel="Reply"
              disabled={disabled}
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
