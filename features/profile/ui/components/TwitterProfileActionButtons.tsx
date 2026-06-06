"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/shared/ui/components/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import {
  AlternateEmailIcon,
  MoreHorizIcon,
  OpenInNewIcon,
} from "@/shared/ui/components/icons";
import type { HydratedTwitterRelationshipDisplay } from "@/shared/lib/twitter/hydration";

type PrimaryAction = HydratedTwitterRelationshipDisplay["primaryAction"];
type PrimaryLabel = HydratedTwitterRelationshipDisplay["primaryLabel"];

export interface TwitterProfileActionButtonsProps {
  profileUserId?: string;
  username?: string;
  profileUrl?: string;
  primaryAction?: PrimaryAction;
  primaryLabel?: PrimaryLabel;
  conversationAction?: React.ReactNode;
  onRelationshipChange?: (next: {
    primaryAction: PrimaryAction;
    primaryLabel: PrimaryLabel;
  }) => void | Promise<void>;
}

export function TwitterProfileActionButtons({
  profileUserId,
  username,
  profileUrl,
  primaryAction = "follow",
  primaryLabel = "Follow",
  conversationAction,
  onRelationshipChange,
}: TwitterProfileActionButtonsProps) {
  const getXStatus = useAction(api.x.getTwitterConnectionStatus);
  const followUser = useAction(api.x.followUser);
  const unfollowUser = useAction(api.x.unfollowUser);
  const router = useRouter();
  const [pendingAction, setPendingAction] = React.useState<PrimaryAction | null>(
    null
  );
  const [resolvedAction, setResolvedAction] =
    React.useState<PrimaryAction>(primaryAction);
  const [resolvedLabel, setResolvedLabel] =
    React.useState<PrimaryLabel>(primaryLabel);

  React.useEffect(() => {
    setResolvedAction(primaryAction);
    setResolvedLabel(primaryLabel);
  }, [primaryAction, primaryLabel]);

  const ensureConnected = React.useCallback(async () => {
    const status = await getXStatus({});
    if (!status?.isConnected) {
      toast.error("Connect your X/Twitter account", {
        description:
          "Connect X/Twitter via Settings -> Connected accounts before using X/Twitter actions.",
        action: {
          label: "Open settings",
          onClick: () => router.push("/settings/connected-accounts"),
        },
      });
      return null;
    }
    return status;
  }, [getXStatus, router]);

  const handlePrimaryAction = React.useCallback(async () => {
    if (!profileUserId) {
      return;
    }

    const loadingLabel =
      resolvedAction === "unfollow"
        ? "Unfollowing on X/Twitter..."
        : "Following on X/Twitter...";
    const successLabel =
      resolvedAction === "unfollow"
        ? "Unfollowed on X/Twitter"
        : "Following on X/Twitter";
    const nextAction: PrimaryAction =
      resolvedAction === "unfollow" ? "follow" : "unfollow";
    const nextLabel: PrimaryLabel =
      resolvedAction === "unfollow" ? "Follow" : "Unfollow";

    const loadingToastId = toast.loading(loadingLabel);
    const status = await ensureConnected();
    if (!status) {
      toast.dismiss(loadingToastId);
      return;
    }

    setPendingAction(resolvedAction);
    try {
      if (resolvedAction === "unfollow") {
        await unfollowUser({ targetUserId: profileUserId });
      } else {
        await followUser({ targetUserId: profileUserId });
      }

      setResolvedAction(nextAction);
      setResolvedLabel(nextLabel);
      await onRelationshipChange?.({
        primaryAction: nextAction,
        primaryLabel: nextLabel,
      });

      toast.dismiss(loadingToastId);
      toast.success(successLabel);
    } catch {
      toast.dismiss(loadingToastId);
      toast.error("Unable to update follow state", {
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setPendingAction(null);
    }
  }, [
    ensureConnected,
    followUser,
    onRelationshipChange,
    profileUserId,
    resolvedAction,
    unfollowUser,
  ]);

  const handleCopy = React.useCallback(
    async (value: string, successDescription: string, errorDescription: string) => {
      try {
        await navigator.clipboard.writeText(value);
        toast.success("Copied!", {
          description: successDescription,
        });
      } catch {
        toast.error("Error!", {
          description: errorDescription,
        });
      }
    },
    []
  );

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        size="xs"
        onClick={() => void handlePrimaryAction()}
        disabled={!profileUserId || pendingAction !== null}
      >
        {pendingAction === resolvedAction ? `${resolvedLabel}...` : resolvedLabel}
      </Button>

      {conversationAction}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="xsIcon" aria-label="Profile menu">
            <MoreHorizIcon className="fill-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>↳ Menu</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {profileUrl ? (
            <DropdownMenuItem
              onClick={() => window.open(profileUrl, "_blank", "noopener,noreferrer")}
            >
              <OpenInNewIcon className="fill-current" />
              Open on X/Twitter
            </DropdownMenuItem>
          ) : null}
          {username ? (
            <DropdownMenuItem
              onClick={() =>
                void handleCopy(
                  `@${username}`,
                  "X/Twitter handle copied.",
                  "Unable to copy handle."
                )
              }
            >
              <AlternateEmailIcon className="fill-current" />
              Copy X/Twitter handle
            </DropdownMenuItem>
          ) : null}
          {profileUrl ? (
            <DropdownMenuItem
              onClick={() =>
                void handleCopy(
                  profileUrl,
                  "Profile link copied.",
                  "Unable to copy link."
                )
              }
            >
              <OpenInNewIcon className="fill-current" />
              Copy profile link
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
