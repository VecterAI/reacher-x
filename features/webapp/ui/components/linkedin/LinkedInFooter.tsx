// features/webapp/ui/components/linkedin/LinkedInFooter.tsx
"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { api } from "@/convex/_generated/api";
import {
  FilledRecommendIcon,
  MailIcon,
  QuickPhrasesIcon,
  RecommendIcon,
  RepeatIcon,
} from "@/shared/ui/components/icons";
import { formatLargeNumber } from "@/shared/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/components/Tooltip";
import { toast } from "sonner";
import {
  cacheLinkedInPostReaction,
  cacheLinkedInPostReactionKeys,
  getLinkedInPostReactionKeys,
  useLinkedInPostReactionState,
} from "@/shared/hooks/useLinkedInPostReactionState";

export interface LinkedInFooterProps {
  post: UnifiedPost;
  prospectId?: string;
  className?: string;
  /** Whether the parent card is being hovered - triggers animation */
  isHovered?: boolean;
  readOnly?: boolean;
  previewMode?: boolean;
  commentBehavior?: "open_thread" | "create_action_request" | "none";
  isCommentsOpen?: boolean;
  onToggleComments?: (post: UnifiedPost) => void;
  commentsState?: {
    loading?: boolean;
    error?: string | null;
  };
}

function getAnimatedParts(value: number): {
  value: number;
  suffix?: string;
  decimals: number;
} {
  const formatted = formatLargeNumber(Number(value || 0));
  const match = /^(\d+(?:\.\d+)?)([A-Za-z]*)$/.exec(formatted);
  if (!match) {
    return { value: Number(value || 0), decimals: 0 };
  }
  const n = Number(match[1]);
  const suffix = match[2] || undefined;
  const decimals = /\.\d/.test(match[1]) ? 1 : 0;
  return { value: n, suffix, decimals };
}

function getPostViewerReaction(raw: UnifiedPost["raw"]): string | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const candidate = (raw as Record<string, unknown>).user_reacted;
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate.trim().toLowerCase()
    : undefined;
}

function getPostCanReact(raw: UnifiedPost["raw"]): boolean | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const permissions = (raw as Record<string, unknown>).permissions;
  if (!permissions || typeof permissions !== "object") {
    return undefined;
  }
  const canReact = (permissions as Record<string, unknown>).can_react;
  return typeof canReact === "boolean" ? canReact : undefined;
}

function LinkedInActionButton({
  icon: Icon,
  count,
  href,
  ariaLabel,
  disabled = false,
  active = false,
  tooltip,
  onClick,
  isHovered: _isHovered = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  href?: string;
  ariaLabel: string;
  disabled?: boolean;
  active?: boolean;
  tooltip?: string;
  onClick?: (event: React.MouseEvent) => void | Promise<void>;
  isHovered?: boolean;
}) {
  const showLabel = Number(count || 0) > 0;
  const { value, suffix, decimals } = getAnimatedParts(Number(count || 0));
  const button =
    href && !disabled && !onClick ? (
      <Button
        asChild
        variant="ghost"
        size={showLabel ? "xs" : "xsIcon"}
        aria-label={ariaLabel}
        className={cn(
          "gap-1 font-mono",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
        >
          <Icon className="fill-current" aria-hidden="true" />
          {showLabel ? (
            <AnimatedNumber
              value={value}
              suffix={suffix}
              decimals={decimals}
              format={{ useGrouping: false }}
              animateOnMount={false}
            />
          ) : null}
        </a>
      </Button>
    ) : (
      <Button
        variant="ghost"
        size={showLabel ? "xs" : "xsIcon"}
        aria-label={ariaLabel}
        className={cn(
          "gap-1 font-mono",
          active ? "text-foreground" : "text-muted-foreground"
        )}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          void onClick?.(event);
        }}
      >
        <Icon className="fill-current" aria-hidden="true" />
        {showLabel ? (
          <AnimatedNumber
            value={value}
            suffix={suffix}
            decimals={decimals}
            format={{ useGrouping: false }}
            animateOnMount={false}
          />
        ) : null}
      </Button>
    );

  if (!tooltip) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{button}</span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export const LinkedInFooter: React.FC<LinkedInFooterProps> = ({
  post,
  prospectId,
  className,
  isHovered: _isHovered = false,
  readOnly = false,
  previewMode = false,
  commentBehavior = "open_thread",
  isCommentsOpen = false,
  onToggleComments,
  commentsState,
}) => {
  const { push } = useRouter();
  const likeLinkedInPost = useAction((api as any).linkedin.likeLinkedInPost);
  const createActionRequest = useAction(
    (api as any).linkedin.createLinkedInPostActionRequest
  );
  const [pendingAction, setPendingAction] = React.useState<
    "react" | "comment" | null
  >(null);
  const cachedReaction = useLinkedInPostReactionState(post);
  const serverViewerReaction = React.useMemo(
    () => getPostViewerReaction(post?.raw),
    [post?.raw]
  );
  const [localViewerReaction, setLocalViewerReaction] = React.useState<
    string | null | undefined
  >(undefined);
  const [reactionCountDelta, setReactionCountDelta] = React.useState(0);
  const reactions = Number(post?.metrics?.reactions || 0);
  const comments = Number(post?.metrics?.comments || 0);
  const reposts = Number(post?.metrics?.reposts || 0);
  const hasLocalReactionOverride = localViewerReaction !== undefined;
  const cachedReactionCount =
    typeof cachedReaction?.reactionCount === "number"
      ? cachedReaction.reactionCount
      : undefined;
  const reactionCountBase = hasLocalReactionOverride
    ? reactions
    : (cachedReactionCount ?? reactions);
  const reactionCount = reactionCountBase + reactionCountDelta;
  const viewerReaction =
    hasLocalReactionOverride
      ? (localViewerReaction ?? undefined)
      : (cachedReaction?.viewerReaction ?? serverViewerReaction);

  const postId = typeof post?.id === "string" ? post.id : "";
  const reactionKeySignature = getLinkedInPostReactionKeys(post).join("::");
  const reactionStateResetKey =
    reactionKeySignature || `${postId}::${post?.url ?? ""}`;
  const hasReacted = Boolean(viewerReaction);
  const postReactionUnsupported = getPostCanReact(post?.raw) === false;
  const disabledCommentActionReason = !postId
    ? "This LinkedIn post is missing a stable id."
    : commentBehavior === "create_action_request" && !prospectId
      ? "Open this post from a LinkedIn prospect profile to use in-app actions."
      : undefined;

  React.useEffect(() => {
    const reactionKeys = reactionKeySignature
      ? reactionKeySignature.split("::")
      : [];
    if (serverViewerReaction && reactionKeys.length > 0) {
      cacheLinkedInPostReactionKeys({
        keys: reactionKeys,
        viewerReaction: serverViewerReaction,
      });
    }
    setLocalViewerReaction(undefined);
    setReactionCountDelta(0);
  }, [reactionKeySignature, reactionStateResetKey, serverViewerReaction]);

  const openApprovalPanel = React.useCallback(
    (actionRequestId: string) => {
      if (!prospectId) {
        return;
      }
      push(
        `/agent?prospectId=${encodeURIComponent(prospectId)}&actionRequestId=${encodeURIComponent(actionRequestId)}&panel=approval`
      );
    },
    [prospectId, push]
  );

  const promptConnectLinkedIn = React.useCallback(() => {
    toast.error("Connect your LinkedIn account", {
      description:
        "Connect LinkedIn via Settings -> Connected accounts before using LinkedIn actions.",
      action: {
        label: "Open settings",
        onClick: () => push("/settings/connected-accounts"),
      },
    });
  }, [push]);

  const handleLinkedInActionError = React.useCallback(
    (error: unknown, fallbackTitle: string) => {
      const message =
        error instanceof Error ? error.message : "Please try again.";
      if (
        /connect(ed)? linkedin|linkedin account|missing credentials|disconnected account|expired credentials|insufficient privileges/i.test(
          message
        )
      ) {
        promptConnectLinkedIn();
        return;
      }

      toast.error(fallbackTitle, {
        description: message,
      });
    },
    [promptConnectLinkedIn]
  );

  const handlePostReaction = React.useCallback(async () => {
    if (!postId || pendingAction || previewMode || postReactionUnsupported) {
      return;
    }

    const previousViewerReaction = viewerReaction;
    const previousReactionCountDelta = reactionCountDelta;
    const requestedReactionType = viewerReaction || "like";
    const isRemovingReaction = Boolean(viewerReaction);

    setLocalViewerReaction(isRemovingReaction ? null : requestedReactionType);
    setReactionCountDelta((current) => current + (isRemovingReaction ? -1 : 1));
    setPendingAction("react");

    try {
      const result = await likeLinkedInPost({
        postId,
        postData: post,
        reactionType: requestedReactionType,
        currentViewerReaction: previousViewerReaction,
        ...(prospectId ? { prospectId: prospectId as any } : {}),
      });
      const nextViewerReaction =
        typeof result?.viewerReaction === "string" &&
        result.viewerReaction.trim().length > 0
          ? result.viewerReaction.trim().toLowerCase()
          : null;
      const nextReactionCountDelta =
        typeof result?.reactionCount === "number"
          ? result.reactionCount - reactions
          : previousReactionCountDelta + (isRemovingReaction ? -1 : 1);
      const nextReactionCount = reactions + nextReactionCountDelta;
      const didRemoveReaction =
        Boolean(previousViewerReaction) && !nextViewerReaction;
      const didAddReaction =
        !previousViewerReaction && Boolean(nextViewerReaction);

      setLocalViewerReaction(nextViewerReaction);
      setReactionCountDelta(nextReactionCountDelta);
      cacheLinkedInPostReaction({
        post,
        viewerReaction: nextViewerReaction,
        reactionCount: nextReactionCount,
        resolvedPostId: result?.resolvedPostId,
        resolvedSocialId: result?.resolvedSocialId,
      });
      toast.success(
        didRemoveReaction
          ? "Like removed on LinkedIn"
          : didAddReaction
            ? "Liked on LinkedIn"
            : "LinkedIn reaction updated"
      );
    } catch (error) {
      setLocalViewerReaction(previousViewerReaction ?? null);
      setReactionCountDelta(previousReactionCountDelta);
      handleLinkedInActionError(
        error,
        previousViewerReaction
          ? "Unable to remove like on LinkedIn"
          : "Unable to like on LinkedIn"
      );
    } finally {
      setPendingAction(null);
    }
  }, [
    handleLinkedInActionError,
    likeLinkedInPost,
    pendingAction,
    post,
    postReactionUnsupported,
    postId,
    previewMode,
    prospectId,
    reactionCountDelta,
    reactions,
    viewerReaction,
  ]);

  const createLinkedInCommentAction = React.useCallback(async () => {
    if (!prospectId || !postId) {
      return;
    }

    try {
      setPendingAction("comment");
      const result = await createActionRequest({
        prospectId: prospectId as any,
        actionKey: "linkedin_comment_on_post",
        postId,
        postData: post,
      });
      toast.success(result?.title ?? "Approval request created", {
        description: "Review and edit the LinkedIn comment before sending.",
      });
      if (result?.actionRequestId) {
        openApprovalPanel(result.actionRequestId);
      }
    } catch (error) {
      handleLinkedInActionError(
        error,
        "Could not create LinkedIn action request"
      );
    } finally {
      setPendingAction(null);
    }
  }, [
    createActionRequest,
    handleLinkedInActionError,
    openApprovalPanel,
    post,
    postId,
    prospectId,
  ]);

  if (readOnly) {
    return (
      <footer
        className={cn(
          "text-muted-foreground mt-2 flex items-center justify-between gap-6 text-xs",
          className
        )}
      >
        <div className="flex items-center gap-3 font-mono">
          <span
            className={cn(
              "inline-flex items-center gap-1",
              hasReacted && "text-foreground"
            )}
          >
            {hasReacted ? (
              <FilledRecommendIcon
                className="fill-current"
                aria-hidden="true"
              />
            ) : (
              <RecommendIcon className="fill-current" aria-hidden="true" />
            )}
            {reactionCount > 0 ? formatLargeNumber(reactionCount) : null}
          </span>
          <span className="inline-flex items-center gap-1">
            <QuickPhrasesIcon className="fill-current" aria-hidden="true" />
            {comments > 0 ? formatLargeNumber(comments) : null}
          </span>
          <span className="inline-flex items-center gap-1">
            <RepeatIcon className="fill-current" aria-hidden="true" />
            {reposts > 0 ? formatLargeNumber(reposts) : null}
          </span>
        </div>
      </footer>
    );
  }

  return (
    <TooltipProvider>
      <footer
        className={cn(
          "mt-2 flex items-center justify-between gap-6 text-xs",
          className
        )}
      >
        <div className="flex items-center gap-2">
          <LinkedInActionButton
            icon={hasReacted ? FilledRecommendIcon : RecommendIcon}
            count={reactionCount}
            active={hasReacted}
            ariaLabel={`React on LinkedIn (${formatLargeNumber(reactionCount)})`}
            disabled={Boolean(
              !postId || pendingAction || previewMode || postReactionUnsupported
            )}
            tooltip={
              (previewMode
                ? "Reaction is unavailable for this sample dataset."
                : undefined) ||
              (!postId
                ? "This LinkedIn post is missing a stable id."
                : undefined) ||
              (postReactionUnsupported
                ? "Reactions are disabled on this LinkedIn post."
                : undefined) ||
              (pendingAction === "react"
                ? "Updating reaction on LinkedIn..."
                : undefined)
            }
            onClick={() => void handlePostReaction()}
          />
          <LinkedInActionButton
            icon={QuickPhrasesIcon}
            count={comments}
            ariaLabel={`Comment on LinkedIn (${formatLargeNumber(comments)})`}
            disabled={Boolean(
              commentBehavior === "none" ||
              (!previewMode &&
                disabledCommentActionReason &&
                commentBehavior === "create_action_request") ||
              pendingAction
            )}
            tooltip={
              commentBehavior === "none"
                ? "Comments are not interactive on this surface."
                : (!previewMode ? disabledCommentActionReason : undefined) ||
                  (pendingAction === "comment"
                    ? "Creating approval request…"
                    : commentsState?.loading
                      ? "Loading comments…"
                      : commentsState?.error || undefined)
            }
            onClick={() =>
              commentBehavior === "open_thread"
                ? onToggleComments?.(post)
                : void createLinkedInCommentAction()
            }
          />
          {commentBehavior === "open_thread" && isCommentsOpen ? (
            <span className="text-muted-foreground text-xs">Open</span>
          ) : null}
          <LinkedInActionButton
            icon={RepeatIcon}
            count={reposts}
            ariaLabel={`Repost on LinkedIn (${formatLargeNumber(reposts)})`}
            disabled
            tooltip="Reposts are intentionally disabled in v1."
          />
          <LinkedInActionButton
            icon={MailIcon}
            ariaLabel="Message author on LinkedIn"
            disabled
            tooltip="DM from post is intentionally disabled in v1. Open the prospect profile to message on LinkedIn."
          />
        </div>
      </footer>
    </TooltipProvider>
  );
};
