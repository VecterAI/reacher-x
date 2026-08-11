"use client";

import * as React from "react";
import { SerializedEditorState } from "lexical";
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuTrigger,
// } from "@/shared/ui/components/DropdownMenu";
// import { Button } from "@/shared/ui/components/Button";
// import { MoreHorizIcon } from "@/shared/ui/components/icons";
import Link from "next/link";
import { toast } from "sonner";
import { BaseComposer } from "./BaseComposer";
import type { ComposerMediaKind, ReplyComposerProps } from "../../types";
import { logger } from "@/shared/lib/logger";
import type { MentionEntitySearchResult } from "@/shared/lib/mentions/mentionEntities";
import { buildPostMentionEntity } from "@/shared/lib/mentions/postMentions";

export function ReplyComposer({
  prospectId,
  replyTo,
  currentUser,
  initialContent,
  initialMediaUploads,
  placeholder = "Type here...",
  maxLength = 280,
  characterCountMode = "x_post",
  showCharacterCount = true,
  showToolbar = true,
  showMediaUpload = true,
  disabled = false,
  previewMode = false,
  toolbarConfig,
  submitButtonText = "Reply",
  submitButtonVariant = "text",
  submitDisabled = false,
  toolbarPlacement = "top",
  showIdentityHeader = true,
  showAvatar = true,
  editorAreaClassName,
  showMediaDescription = true,
  showOpenGraphPreview = true,
  afterEmojiSlot,
  beforeCounterSlot,
  submitToolbarStart,
  className,
  inlineAutocompleteContext,
  onContentChange,
  onEditorBlur,
  onEditorFocus,
  onSubmit,
  // Remove unused onCancel to fix lint error
}: ReplyComposerProps) {
  const tweetScreenName = replyTo.tweet.user?.screen_name?.trim() ?? "";
  const tweetName = replyTo.tweet.user?.name?.trim() ?? tweetScreenName;
  const replyUsers = React.useMemo(() => {
    const fallbackReplyUsers = replyTo.users.filter(
      (user) => user.screenName.trim().length > 0
    );

    if (tweetScreenName.length === 0) {
      return fallbackReplyUsers;
    }

    if (
      fallbackReplyUsers.some(
        (user) =>
          user.screenName.trim().toLowerCase() === tweetScreenName.toLowerCase()
      )
    ) {
      return fallbackReplyUsers;
    }

    if (fallbackReplyUsers.length <= 1) {
      return [{ screenName: tweetScreenName, name: tweetName }];
    }

    return [
      { screenName: tweetScreenName, name: tweetName },
      ...fallbackReplyUsers,
    ];
  }, [replyTo.users, tweetName, tweetScreenName]);
  const headerSecondary = React.useMemo(
    () =>
      replyUsers.length > 0 ? (
        <div className="flex items-center gap-1">
          <span>Replying to</span>
          {replyUsers.map((user, index) => (
            <Link
              key={user.screenName}
              href={`https://x.com/${user.screenName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground font-mono font-medium hover:underline"
              onClick={(e) => e.stopPropagation()}
              aria-label={`View @${user.screenName}'s profile`}
            >
              @{user.screenName}
              {index < replyUsers.length - 1 && ", "}
            </Link>
          ))}
        </div>
      ) : undefined,
    [replyUsers]
  );
  const localMentionEntities = React.useMemo<
    MentionEntitySearchResult[]
  >(() => {
    const people = replyUsers.map((user) => ({
      id: `prospect:reply-user:${user.screenName.toLowerCase()}`,
      entityId: `reply-user:${user.screenName.toLowerCase()}`,
      kind: "prospect" as const,
      label: user.name?.trim() || user.screenName.trim(),
      mentionText: user.name?.trim() || user.screenName.trim(),
      secondaryLabel: `@${user.screenName.replace(/^@/, "")}`,
      avatarUrl: null,
      verified: false,
      handle: user.screenName.replace(/^@/, ""),
    }));
    const currentPost = buildPostMentionEntity({
      post: replyTo.tweet,
      platformHint: "twitter",
    });

    return currentPost ? [...people, currentPost] : people;
  }, [replyTo.tweet, replyUsers]);

  const handleSubmit = async (
    content: SerializedEditorState,
    mediaUrls?: string[],
    mediaDescriptions?: string[],
    mediaKinds?: ComposerMediaKind[]
  ) => {
    try {
      await onSubmit?.(content, mediaUrls, mediaDescriptions, mediaKinds);
    } catch (error) {
      toast.error("Unable to post reply", {
        description:
          error instanceof Error
            ? error.message
            : "X rejected the reply. Please try again.",
      });
      logger.error("Reply submit error:", error);
      throw error;
    }
  };

  return (
    <BaseComposer
      currentUser={currentUser}
      initialContent={initialContent}
      initialMediaUploads={initialMediaUploads}
      placeholder={placeholder}
      maxLength={maxLength}
      characterCountMode={characterCountMode}
      showCharacterCount={showCharacterCount}
      showToolbar={showToolbar}
      showMediaUpload={showMediaUpload}
      disabled={disabled}
      previewMode={previewMode}
      toolbarConfig={toolbarConfig}
      submitButtonText={submitButtonText}
      submitButtonVariant={submitButtonVariant}
      submitDisabled={submitDisabled}
      toolbarPlacement={toolbarPlacement}
      showIdentityHeader={showIdentityHeader}
      showAvatar={showAvatar}
      editorAreaClassName={editorAreaClassName}
      showMediaDescription={showMediaDescription}
      showOpenGraphPreview={showOpenGraphPreview}
      inlineAutocompleteContext={{
        ...inlineAutocompleteContext,
        surfaceLabel:
          inlineAutocompleteContext?.surfaceLabel ?? "x_reply_composer",
        platform: "twitter",
        maxLength,
        characterCountMode,
        replyToAuthorHandle:
          inlineAutocompleteContext?.replyToAuthorHandle ??
          replyTo.tweet.user?.screen_name ??
          replyTo.users[0]?.screenName,
        replyToText:
          inlineAutocompleteContext?.replyToText ??
          replyTo.tweet.full_text ??
          replyTo.tweet.text ??
          undefined,
      }}
      entityMentions={{
        prospectId,
        attachmentDestination: {
          platform: "twitter",
          surface: "comment",
        },
        remoteAllowedKinds: prospectId
          ? ["post", "attachment"]
          : ["attachment"],
        localEntities: localMentionEntities,
        personTextMode: "handle",
      }}
      onContentChange={onContentChange}
      onEditorBlur={onEditorBlur}
      onEditorFocus={onEditorFocus}
      onSubmit={handleSubmit}
      // headerActionsRight={
      //   <DropdownMenu>
      //     <DropdownMenuTrigger asChild>
      //       <Button variant="ghost" size="xsIcon" aria-label="More options">
      //         <MoreHorizIcon className="fill-current" />
      //       </Button>
      //     </DropdownMenuTrigger>
      //     <DropdownMenuContent align="end">
      //       <DropdownMenuItem>Copy link</DropdownMenuItem>
      //       <DropdownMenuItem>Report</DropdownMenuItem>
      //     </DropdownMenuContent>
      //   </DropdownMenu>
      // }
      headerSecondary={headerSecondary}
      afterEmojiSlot={afterEmojiSlot}
      beforeCounterSlot={beforeCounterSlot}
      submitToolbarStart={submitToolbarStart}
      className={className}
    />
  );
}
