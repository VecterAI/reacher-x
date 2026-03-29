"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, usePathname } from "next/navigation";
import { formatLargeNumber } from "@/shared/lib/utils";
import { cn } from "@/shared/lib/utils";
import {
  QuickPhrasesIcon,
  RepeatIcon,
  FavoriteIcon,
  InsertChartIcon,
  FilledFavoriteIcon,
  RepeatOneIcon,
} from "@/shared/ui/components/icons";
import type { Tweet } from "@/features/threads/types";
import { Button } from "@/shared/ui/components/Button";
import { logger } from "@/shared/lib/logger";
import Link from "next/link";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { toast } from "sonner";
import { createEmptyTwitterViewerState } from "@/shared/lib/twitter/contracts";
import { invalidateHydratedTwitterPostsCache } from "@/shared/hooks/useHydratedTwitterPosts";

import { useReplyPanel } from "@/shared/contexts/ReplyPanelContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";

interface TweetFooterProps {
  tweet: Tweet;
  className?: string;
  /** Whether the parent card is being hovered - triggers animation */
  isHovered?: boolean;
}

function getAnimatedPartsFromCount(count?: number | string): {
  value: number;
  suffix?: string;
  decimals: number;
} {
  if (typeof count === "number") {
    const formatted = formatLargeNumber(Number(count || 0));
    const match = /^(\d+(?:\.\d+)?)([A-Za-z]*)$/.exec(formatted);
    if (!match) return { value: Number(count || 0), decimals: 0 };
    const n = Number(match[1]);
    const suffix = match[2] || undefined;
    const decimals = /\.\d/.test(match[1]) ? 1 : 0;
    return { value: n, suffix, decimals };
  }
  const str = String(count || "0");
  const m = /^(\d+(?:\.\d+)?)([A-Za-z]*)$/.exec(str);
  if (!m) return { value: Number(str) || 0, decimals: 0 };
  const n = Number(m[1]);
  const suffix = m[2] || undefined;
  const decimals = /\.\d/.test(m[1]) ? 1 : 0;
  return { value: n, suffix, decimals };
}

/**
 * Maps raw backend errors to user-friendly messages.
 * Prevents exposing technical details (JSON, stack traces, HTTP codes) in toasts.
 */
function getUserFriendlyErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const lower = raw.toLowerCase();

  if (
    lower.includes("429") ||
    lower.includes("too many requests") ||
    lower.includes("rate limit")
  ) {
    return "Too many actions too fast. Please wait a moment and try again.";
  }
  if (
    lower.includes("403") ||
    lower.includes("forbidden") ||
    lower.includes("blocked") ||
    lower.includes("not permitted")
  ) {
    return "This action isn't allowed. The author may have restricted who can interact with this post.";
  }
  if (
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("authentication") ||
    lower.includes("reauth")
  ) {
    return "Your X session has expired. Please reconnect your account in Settings.";
  }
  if (
    lower.includes("404") ||
    lower.includes("not found") ||
    lower.includes("no longer")
  ) {
    return "This post is no longer available.";
  }
  if (lower.includes("duplicate") || lower.includes("already been posted")) {
    return "This looks like a duplicate. Try changing your message.";
  }
  if (
    lower.includes("280") ||
    lower.includes("too long") ||
    lower.includes("character")
  ) {
    return "Your message is too long. Please shorten it and try again.";
  }

  return "Something went wrong. Please try again.";
}

// TweetActionButton: icon-only if count is 0, icon+animated label if count > 0
function TweetActionButton({
  icon: Icon,
  count,
  href,
  ariaLabel,
  onClick,
  active = false,
  activeClassName,
  id,
}: {
  icon: React.ComponentType<{ className?: string }>;
  count?: number | string;
  href?: string;
  ariaLabel: string;
  onClick?: (e: React.MouseEvent) => void;
  active?: boolean;
  activeClassName?: string;
  id?: string;
}) {
  const showLabel =
    typeof count === "number" ? count > 0 : !!count && count !== "0";
  const { value, suffix, decimals } = getAnimatedPartsFromCount(count);
  const content = (
    <>
      <Icon className="fill-current" aria-hidden="true" />
      {showLabel && (
        <AnimatedNumber
          value={value}
          suffix={suffix}
          decimals={decimals}
          format={{ useGrouping: false }}
          animateOnMount={false}
        />
      )}
    </>
  );

  if (href && !onClick) {
    return (
      <Button
        asChild
        variant="ghost"
        size={showLabel ? "xs" : "xsIcon"}
        aria-label={ariaLabel}
        className={cn(
          "text-muted-foreground gap-1 font-mono",
          active && "text-foreground",
          activeClassName
        )}
      >
        <Link href={href} id={id}>
          {content}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size={showLabel ? "xs" : "xsIcon"}
      aria-label={ariaLabel}
      className={cn(
        "text-muted-foreground gap-1 font-mono",
        active && "text-foreground",
        activeClassName
      )}
      onClick={onClick}
      id={id}
    >
      {content}
    </Button>
  );
}

export function TweetFooter({
  tweet,
  className,
  isHovered: _isHovered = false,
}: TweetFooterProps) {
  const getXStatus = useAction(api.x.getTwitterConnectionStatus);
  const likeOnX = useAction(api.x.likeTweet);
  const unlikeOnX = useAction(api.x.unlikeTweet);
  const retweetOnX = useAction(api.x.retweet);
  const unretweetOnX = useAction(api.x.unretweet);
  const router = useRouter();
  const pathname = usePathname();
  const openReplyPanel = useReplyPanel();
  const tweetId = tweet.id_str || tweet.id?.toString();
  const threadId = tweet.conversation_id_str || tweetId;
  const authorId = tweet.user?.id_str;

  const [viewerState, setViewerState] = React.useState(tweet.viewerState);
  const [likeCountDelta, setLikeCountDelta] = React.useState(0);
  const [retweetCountDelta, setRetweetCountDelta] = React.useState(0);
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  // Once true, prop-sync is permanently disabled for this component instance.
  // Prevents stale parent data from overwriting local optimistic state.
  const hasLocalMutation = React.useRef(false);

  const formattedReplyCount = formatLargeNumber(Number(tweet.reply_count ?? 0));
  const repeatSum =
    Number(tweet.quote_count ?? 0) +
    Number(tweet.retweet_count ?? 0) +
    retweetCountDelta;
  const formattedRepeatSum = formatLargeNumber(repeatSum);
  const formattedFavoriteCount = formatLargeNumber(
    Number(tweet.favorite_count ?? 0) + likeCountDelta
  );
  const formattedViewsCount = formatLargeNumber(Number(tweet.views_count ?? 0));

  let postHref = `https://x.com/${tweet?.user?.screen_name}/status/${tweetId}`;
  if (tweetId) {
    const params = new URLSearchParams();
    if (threadId && threadId !== tweetId) {
      params.set("cid", threadId);
    }
    const qs = params.toString();
    postHref = `/post/x/${tweetId}${qs ? `?${qs}` : ""}`;
  }

  // Sync viewer state from props ONLY if we haven't made any local mutations.
  // Once the user interacts (like/repost), we own the state and never accept
  // stale props again for this component instance.
  React.useEffect(() => {
    if (hasLocalMutation.current) return;
    setViewerState(tweet.viewerState);
  }, [tweet.viewerState]);

  const ensureConnected = React.useCallback(async () => {
    const status = await getXStatus({});
    if (!status?.isConnected) {
      toast.error("Connect your X account", {
        description:
          "Connect X via Settings → Connected accounts before using X actions.",
        action: {
          label: "Open settings",
          onClick: () => router.push("/settings/connected-accounts"),
        },
      });
      return null;
    }
    return status;
  }, [getXStatus, router]);

  const runPostAction = React.useCallback(
    async (options: {
      actionKey: string;
      run: () => Promise<unknown>;
      processingLabel: string;
      successLabel: string;
      failureLabel: string;
      optimisticUpdate: () => void;
      revertUpdate: () => void;
    }) => {
      if (!tweetId) {
        return;
      }

      // Apply optimistic update IMMEDIATELY (before any network call)
      hasLocalMutation.current = true;
      options.optimisticUpdate();

      const loadingToastId = toast.loading(options.processingLabel);
      try {
        setPendingAction(options.actionKey);
        const status = await ensureConnected();
        if (!status) {
          toast.dismiss(loadingToastId);
          options.revertUpdate();
          return;
        }
        await options.run();
        invalidateHydratedTwitterPostsCache(tweetId ? [tweetId] : undefined);
        toast.dismiss(loadingToastId);
        toast.success(options.successLabel);
      } catch (error) {
        toast.dismiss(loadingToastId);
        // Revert the optimistic update on failure
        options.revertUpdate();
        logger.error(`Failed to perform ${options.actionKey}:`, error);
        toast.error(options.failureLabel, {
          description: getUserFriendlyErrorMessage(error),
        });
      } finally {
        setPendingAction(null);
      }
    },
    [ensureConnected, tweetId]
  );

  const handleReplyClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!tweetId) return;
      // Use panel when available and we're not already on the post page (which has no panel renderer)
      const isOnPostPage = pathname?.startsWith("/post/x/");
      if (openReplyPanel && !isOnPostPage) {
        openReplyPanel({
          tweetId: tweetId as string,
          threadId: threadId as string,
          initialTweet: tweet,
        });
      } else {
        router.push(postHref ?? "/");
      }
    },
    [tweetId, threadId, tweet, postHref, openReplyPanel, pathname, router]
  );

  const handleLikeToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!tweetId || pendingAction) return;

    const isLiked = viewerState?.liked ?? false;
    await runPostAction({
      actionKey: "like",
      run: () =>
        isLiked
          ? unlikeOnX({ tweetId, authorId })
          : likeOnX({ tweetId, authorId }),
      processingLabel: isLiked ? "Removing like…" : "Liking on X…",
      successLabel: isLiked ? "Like removed on X" : "Liked on X",
      failureLabel: isLiked ? "Unable to remove like" : "Unable to like on X",
      optimisticUpdate: () => {
        setViewerState((current) => ({
          ...(current ??
            createEmptyTwitterViewerState({
              postId: tweetId,
              source: "optimistic",
            })),
          liked: !isLiked,
          source: "optimistic",
        }));
        setLikeCountDelta((d) => d + (isLiked ? -1 : 1));
      },
      revertUpdate: () => {
        setViewerState((current) => ({
          ...(current ??
            createEmptyTwitterViewerState({
              postId: tweetId,
              source: "optimistic",
            })),
          liked: isLiked,
          source: "optimistic",
        }));
        setLikeCountDelta((d) => d + (isLiked ? 1 : -1));
      },
    });
  };

  const handleRetweetToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!tweetId || pendingAction) return;

    const isRetweeted = viewerState?.retweeted ?? false;
    await runPostAction({
      actionKey: "repost",
      run: () =>
        isRetweeted
          ? unretweetOnX({ tweetId, authorId })
          : retweetOnX({ tweetId, authorId }),
      processingLabel: isRetweeted ? "Removing repost…" : "Reposting on X…",
      successLabel: isRetweeted ? "Repost removed on X" : "Reposted on X",
      failureLabel: isRetweeted
        ? "Unable to remove repost"
        : "Unable to repost on X",
      optimisticUpdate: () => {
        setViewerState((current) => ({
          ...(current ??
            createEmptyTwitterViewerState({
              postId: tweetId,
              source: "optimistic",
            })),
          retweeted: !isRetweeted,
          source: "optimistic",
        }));
        setRetweetCountDelta((d) => d + (isRetweeted ? -1 : 1));
      },
      revertUpdate: () => {
        setViewerState((current) => ({
          ...(current ??
            createEmptyTwitterViewerState({
              postId: tweetId,
              source: "optimistic",
            })),
          retweeted: isRetweeted,
          source: "optimistic",
        }));
        setRetweetCountDelta((d) => d + (isRetweeted ? 1 : -1));
      },
    });
  };

  const isActionPending = Boolean(pendingAction);
  const isLiked = viewerState?.liked ?? false;
  const isRetweeted = viewerState?.retweeted ?? false;
  const repeatAnimated = getAnimatedPartsFromCount(formattedRepeatSum);
  const showRepeatLabel = repeatSum > 0;

  return (
    <footer
      className={cn(
        "flex items-center justify-between gap-6 text-xs",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {/* Reply: opens panel with post + composer */}
        <TweetActionButton
          icon={QuickPhrasesIcon}
          count={formattedReplyCount}
          ariaLabel={`Reply (${formattedReplyCount})`}
          onClick={handleReplyClick}
          active={viewerState?.commented}
          id="rx-tour-reply"
        />
        {/* Repost: dropdown with Repost (enabled) and Quote (disabled) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size={showRepeatLabel ? "xs" : "xsIcon"}
              aria-label={`Repost (${formattedRepeatSum})`}
              className={cn(
                "text-muted-foreground gap-1 font-mono",
                isRetweeted && "bg-muted text-green-600"
              )}
            >
              {isRetweeted ? (
                <RepeatOneIcon className="fill-current" aria-hidden />
              ) : (
                <RepeatIcon className="fill-current" aria-hidden />
              )}
              {showRepeatLabel && (
                <AnimatedNumber
                  value={repeatAnimated.value}
                  suffix={repeatAnimated.suffix}
                  decimals={repeatAnimated.decimals}
                  format={{ useGrouping: false }}
                  animateOnMount={false}
                />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={handleRetweetToggle}
              disabled={!tweetId || isActionPending}
            >
              {isRetweeted ? "Undo repost" : "Repost"}
            </DropdownMenuItem>
            <DropdownMenuItem disabled>Quote (coming soon)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Like: toggles like on click */}
        <TweetActionButton
          icon={isLiked ? FilledFavoriteIcon : FavoriteIcon}
          count={formattedFavoriteCount}
          ariaLabel={`Like (${formattedFavoriteCount})`}
          onClick={handleLikeToggle}
          active={isLiked}
        />
        {/* Views: link to post */}
        <TweetActionButton
          icon={InsertChartIcon}
          count={formattedViewsCount}
          href={postHref}
          ariaLabel={`View impressions (${formattedViewsCount})`}
        />
      </div>
    </footer>
  );
}
