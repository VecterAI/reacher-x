"use client";

import { SerializedEditorState } from "lexical";
import { cn } from "@/shared/lib/utils/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import { Button } from "@/shared/ui/components/Button";
import { MoreHorizIcon } from "@/shared/ui/components/icons";
import { BaseComposer } from "./BaseComposer";
import { ReplyComposerProps } from "../../types";

export function ReplyComposer({
  replyTo,
  currentUser,
  placeholder = "Type here...",
  maxLength = 280,
  showCharacterCount = true,
  showToolbar = true,
  showMediaUpload = true,
  disabled = false,
  className,
  onContentChange,
  onSubmit,
  // Remove unused onCancel to fix lint error
}: ReplyComposerProps) {
  const handleSubmit = async (content: SerializedEditorState) => {
    try {
      await onSubmit?.(content);
    } catch (error) {
      console.error("Reply submit error:", error);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Composer */}
      <BaseComposer
        currentUser={currentUser}
        placeholder={placeholder}
        maxLength={maxLength}
        showCharacterCount={showCharacterCount}
        showToolbar={showToolbar}
        showMediaUpload={showMediaUpload}
        disabled={disabled}
        submitButtonText="Reply"
        onContentChange={onContentChange}
        onSubmit={handleSubmit}
        headerActionsRight={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xsIcon" aria-label="More options">
                <MoreHorizIcon className="fill-current" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Copy link</DropdownMenuItem>
              <DropdownMenuItem>Report</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        headerSecondary={
          <div className="flex items-center gap-1">
            <span>Replying to</span>
            {replyTo.users.map((user, index) => (
              <span key={user.screenName} className="font-mono text-foreground">
                @{user.screenName}
                {index < replyTo.users.length - 1 && ", "}
              </span>
            ))}
          </div>
        }
        className="rounded-t-lg"
      />
    </div>
  );
}
