"use client";

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
import { ReplyComposerProps } from "../../types";
import { logger } from "@/shared/lib/logger";

export function ReplyComposer({
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
  className,
  inlineAutocompleteContext,
  onContentChange,
  onEditorBlur,
  onEditorFocus,
  onSubmit,
  // Remove unused onCancel to fix lint error
}: ReplyComposerProps) {
  const fallbackReplyUsers = replyTo.users.filter(
    (user) => user.screenName.trim().length > 0
  );
  const tweetScreenName = replyTo.tweet.user?.screen_name?.trim() ?? "";
  const tweetName = replyTo.tweet.user?.name?.trim() ?? tweetScreenName;
  const replyUsers =
    tweetScreenName.length === 0
      ? fallbackReplyUsers
      : fallbackReplyUsers.some(
            (user) =>
              user.screenName.trim().toLowerCase() ===
              tweetScreenName.toLowerCase()
          )
        ? fallbackReplyUsers
        : fallbackReplyUsers.length <= 1
          ? [{ screenName: tweetScreenName, name: tweetName }]
          : [
              { screenName: tweetScreenName, name: tweetName },
              ...fallbackReplyUsers,
            ];

  const handleSubmit = async (
    content: SerializedEditorState,
    mediaUrls?: string[],
    mediaDescriptions?: string[],
    mediaKinds?: ("image" | "gif" | "video")[]
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
      headerSecondary={
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
        ) : undefined
      }
      className={className}
    />
  );
}
