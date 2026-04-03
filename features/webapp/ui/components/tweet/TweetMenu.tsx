// features/webapp/ui/components/tweet/TweetMenu.tsx
"use client";

import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import { Button } from "@/shared/ui/components/Button";
import {
  ContentCopyIcon,
  LinkIcon,
  MoreHorizIcon,
  OpenInNewIcon,
  PersonIcon,
} from "@/shared/ui/components/icons";

import { useProfile } from "@/features/profile/contexts/TwitterProfileContext";
import type { Tweet as TweetType } from "@/features/threads/types";
import { getVisibleTweetPlainText } from "@/shared/lib/utils";
import { toast } from "sonner";

export function TweetMenu({
  tweetUrl,
  profileUrl,
  screenName,
  tweet,
  characterLimit = 280,
  showFullContent = false,
  className,
  readOnly = false,
}: {
  tweetUrl: string;
  profileUrl: string;
  screenName: string;
  tweet: TweetType;
  characterLimit?: number;
  showFullContent?: boolean;
  className?: string;
  readOnly?: boolean;
}) {
  const { openProfile } = useProfile();

  const handleCopyLink = (event: React.MouseEvent) => {
    event.stopPropagation();
    navigator.clipboard.writeText(tweetUrl).then(
      () =>
        toast.success("Copied!", {
          description: "Post link copied.",
        }),
      () =>
        toast.error("Error!", {
          description: "Unable to copy link.",
        })
    );
  };

  const handleViewTweet = (event: React.MouseEvent) => {
    event.stopPropagation();
    window.open(tweetUrl, "_blank");
  };

  const handleCopyPostText = (event: React.MouseEvent) => {
    event.stopPropagation();
    const visibleText = getVisibleTweetPlainText(tweet, {
      characterLimit,
      showFullContent,
    });
    if (!visibleText) return;
    navigator.clipboard.writeText(visibleText).then(
      () => toast.success("Copied!", { description: "Post text copied." }),
      () => toast.error("Error!", { description: "Unable to copy." })
    );
  };

  const handleCopyProfileLink = (event: React.MouseEvent) => {
    event.stopPropagation();
    navigator.clipboard.writeText(profileUrl).then(
      () => toast.success("Copied!", { description: "Profile link copied." }),
      () => toast.error("Error!", { description: "Unable to copy." })
    );
  };

  const handleViewProfile = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (screenName) openProfile({ username: screenName });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="xsIcon"
          variant="ghost"
          onClick={(e) => e.stopPropagation()}
          aria-label="More options"
          className={className}
        >
          <MoreHorizIcon className="fill-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>↳ Menu</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleViewTweet}>
          <OpenInNewIcon className="fill-current" aria-hidden="true" />
          Open on X (Twitter)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyPostText}>
          <ContentCopyIcon className="fill-current" aria-hidden="true" />
          Copy post text
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink}>
          <LinkIcon className="fill-current" aria-hidden="true" />
          Copy post link
        </DropdownMenuItem>
        {!readOnly ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleViewProfile}>
              <PersonIcon className="fill-current" aria-hidden="true" />
              View profile
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuSeparator />
        )}
        <DropdownMenuItem onClick={handleCopyProfileLink}>
          <LinkIcon className="fill-current" aria-hidden="true" />
          Copy profile link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
