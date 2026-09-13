"use client";
import { toast } from "sonner";
import { Button } from "@/shared/ui/components/Button";
import {
  ContentCopyIcon,
  MoreHorizIcon,
  OpenInNewIcon,
  PersonIcon,
} from "@/shared/ui/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";

/** Shared menu for live and locally supplied LinkedIn conversations. */
export function LinkedInDmConversationMenu({
  profileUrl,
  onViewLinkedInProfile,
  onViewProfile,
}: {
  profileUrl?: string | null;
  onViewLinkedInProfile?: () => void;
  onViewProfile?: () => void;
}) {
  const handleCopyProfile = () => {
    if (!profileUrl) return;
    navigator.clipboard.writeText(profileUrl).then(
      () => toast.success("Copied profile link"),
      () => toast.error("Unable to copy profile link")
    );
  };
  const handleOpenLinkedIn = () => {
    if (profileUrl) window.open(profileUrl, "_blank", "noopener,noreferrer");
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="xsIcon" aria-label="Conversation menu">
          <MoreHorizIcon className="fill-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>↳ Menu</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profileUrl ? (
          <DropdownMenuItem
            onClick={onViewLinkedInProfile ?? handleOpenLinkedIn}
          >
            <OpenInNewIcon className="fill-current" aria-hidden />
            View LinkedIn profile
          </DropdownMenuItem>
        ) : null}
        {profileUrl ? (
          <DropdownMenuItem onClick={handleCopyProfile}>
            <ContentCopyIcon className="fill-current" aria-hidden />
            Copy profile link
          </DropdownMenuItem>
        ) : null}
        {onViewProfile ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onViewProfile()}>
              <PersonIcon className="fill-current" aria-hidden />
              View profile
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
