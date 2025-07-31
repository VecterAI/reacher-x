// features/landing/ui/components/TweetMenu.tsx
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
  ExitToAppIcon,
  LinkIcon,
  AccountCircleIcon,
  MoreHorizIcon,
} from "@/shared/ui/components/icons";
import { useToast } from "@/shared/ui/hooks/useToast";

export function TweetMenu({
  tweetUrl,
  profileUrl,
  className,
}: {
  tweetUrl: string;
  profileUrl: string;
  className?: string;
}) {
  const { toast } = useToast();

  const handleCopyLink = (event: React.MouseEvent) => {
    event.stopPropagation();
    navigator.clipboard.writeText(tweetUrl).then(
      () =>
        toast({
          title: "☑︎ Copied!",
          description: "Link copied to clipboard.",
        }),
      () =>
        toast({
          variant: "destructive",
          title: "☒ Error!",
          description: "Unable to copy link.",
        })
    );
  };

  const handleViewTweet = (event: React.MouseEvent) => {
    event.stopPropagation();
    window.open(tweetUrl, "_blank");
  };

  const handleViewProfile = (event: React.MouseEvent) => {
    event.stopPropagation();
    window.open(profileUrl, "_blank");
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
          <ExitToAppIcon className="fill-current" aria-hidden="true" />
          Open on 𝕏
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink}>
          <LinkIcon className="fill-current" aria-hidden="true" />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleViewProfile}>
          <AccountCircleIcon className="fill-current" aria-hidden="true" />
          View profile
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
