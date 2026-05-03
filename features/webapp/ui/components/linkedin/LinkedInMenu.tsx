// features/webapp/ui/components/linkedin/LinkedInMenu.tsx
"use client";

import * as React from "react";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
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
import { toast } from "sonner";

export interface LinkedInMenuProps {
  post: UnifiedPost;
  className?: string;
}

export const LinkedInMenu: React.FC<LinkedInMenuProps> = ({
  post,
  className,
}) => {
  const profileUrl = post?.author?.profileUrl || post?.author?.handle || "";
  const postUrl = post?.url || "";
  const text = post?.text || "";

  const copy = (value: string, label: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(
      () => toast.success("Copied!", { description: `${label} copied.` }),
      () =>
        toast.error("Error!", {
          description: `Unable to copy ${label.toLowerCase()}.`,
        })
    );
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
        {postUrl && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              window.open(postUrl, "_blank", "noopener,noreferrer");
            }}
          >
            <OpenInNewIcon className="fill-current" aria-hidden="true" />
            Open on LinkedIn
          </DropdownMenuItem>
        )}
        {text && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              copy(text, "Post text");
            }}
          >
            <ContentCopyIcon className="fill-current" aria-hidden="true" />
            Copy post text
          </DropdownMenuItem>
        )}
        {postUrl && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              copy(postUrl, "Post link");
            }}
          >
            <LinkIcon className="fill-current" aria-hidden="true" />
            Copy post link
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {profileUrl && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              window.open(profileUrl, "_blank", "noopener,noreferrer");
            }}
          >
            <PersonIcon className="fill-current" aria-hidden="true" />
            View profile
          </DropdownMenuItem>
        )}
        {profileUrl && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              copy(profileUrl, "Profile link");
            }}
          >
            <LinkIcon className="fill-current" aria-hidden="true" />
            Copy profile link
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
