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

export interface LinkedInFooterProps {
  post: UnifiedPost;
  prospectId?: string;
  className?: string;
  /** Whether the parent card is being hovered - triggers animation */
  isHovered?: boolean;
  readOnly?: boolean;
  previewMode?: boolean;
  onPreviewComment?: (post: UnifiedPost) => void;
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

function LinkedInActionButton({
  icon: Icon,
  count,
  href,
  ariaLabel,
  disabled = false,
  tooltip,
  onClick,
  isHovered: _isHovered = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  href?: string;
  ariaLabel: string;
  disabled?: boolean;
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
        className="text-muted-foreground gap-1 font-mono"
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
        className="text-muted-foreground gap-1 font-mono"
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
  onPreviewComment,
}) => {
  const router = useRouter();
  const createActionRequest = useAction(
    (api as any).linkedin.createLinkedInPostActionRequest
  );
  const [pendingAction, setPendingAction] = React.useState<
    "react" | "comment" | null
  >(null);
  const reactions = Number(post?.metrics?.reactions || 0);
  const comments = Number(post?.metrics?.comments || 0);
  const reposts = Number(post?.metrics?.reposts || 0);

  const postId = typeof post?.id === "string" ? post.id : "";
  const disabledActionReason = !prospectId
    ? "Open this post from a LinkedIn prospect profile to use in-app actions."
    : !postId
      ? "This LinkedIn post is missing a stable id."
      : undefined;

  const openApprovalPanel = React.useCallback(
    (actionRequestId: string) => {
      if (!prospectId) {
        return;
      }
      router.push(
        `/agent?prospectId=${encodeURIComponent(prospectId)}&actionRequestId=${encodeURIComponent(actionRequestId)}&panel=approval`
      );
    },
    [prospectId, router]
  );

  const createLinkedInAction = React.useCallback(
    async (
      actionKey: "linkedin_react_to_post" | "linkedin_comment_on_post"
    ) => {
      if (!prospectId || !postId) {
        return;
      }

      try {
        setPendingAction(
          actionKey === "linkedin_react_to_post" ? "react" : "comment"
        );
        const result = await createActionRequest({
          prospectId: prospectId as any,
          actionKey,
          postId,
          postData: post,
          reactionType:
            actionKey === "linkedin_react_to_post" ? "LIKE" : undefined,
        });
        toast.success(result?.title ?? "Approval request created", {
          description:
            actionKey === "linkedin_comment_on_post"
              ? "Review and edit the LinkedIn comment before sending."
              : "Review the LinkedIn reaction before sending.",
        });
        if (result?.actionRequestId) {
          openApprovalPanel(result.actionRequestId);
        }
      } catch (error) {
        toast.error("Could not create LinkedIn action request", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      } finally {
        setPendingAction(null);
      }
    },
    [createActionRequest, openApprovalPanel, post, postId, prospectId]
  );

  if (readOnly) {
    return (
      <footer
        className={cn(
          "text-muted-foreground mt-2 flex items-center justify-between gap-6 text-xs",
          className
        )}
      >
        <div className="flex items-center gap-3 font-mono">
          <span className="inline-flex items-center gap-1">
            <RecommendIcon className="fill-current" aria-hidden="true" />
            {reactions > 0 ? formatLargeNumber(reactions) : null}
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
            icon={RecommendIcon}
            count={reactions}
            ariaLabel={`React on LinkedIn (${formatLargeNumber(reactions)})`}
            disabled={Boolean(
              disabledActionReason || pendingAction || previewMode
            )}
            tooltip={
              (previewMode
                ? "Reaction is unavailable for this sample dataset."
                : undefined) ||
              disabledActionReason ||
              (pendingAction === "react"
                ? "Creating approval request…"
                : undefined)
            }
            onClick={() => createLinkedInAction("linkedin_react_to_post")}
          />
          <LinkedInActionButton
            icon={QuickPhrasesIcon}
            count={comments}
            ariaLabel={`Comment on LinkedIn (${formatLargeNumber(comments)})`}
            disabled={Boolean(
              (!previewMode && disabledActionReason) || pendingAction
            )}
            tooltip={
              (!previewMode ? disabledActionReason : undefined) ||
              (pendingAction === "comment"
                ? "Creating approval request…"
                : undefined)
            }
            onClick={() =>
              previewMode && onPreviewComment
                ? onPreviewComment(post)
                : createLinkedInAction("linkedin_comment_on_post")
            }
          />
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
