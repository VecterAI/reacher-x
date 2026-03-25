/**
 * ReplyPanel
 * Panel that displays a post with the reply composer.
 * Same pattern as the post detail page - used when opening reply from TweetFooter.
 * On desktop replaces current panel; on mobile replaces the drawer content.
 */
"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth as useWorkosAuth } from "@workos-inc/authkit-nextjs/components";
import { useConvexAuth } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useViewerXComposerIdentity } from "@/features/composer/hooks/useViewerXComposerIdentity";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { Tweet } from "@/features/webapp/ui/components/tweet";
import { ReplyComposer } from "@/features/composer/ui/components/ReplyComposer";
import { XReplyFallbackAlert } from "@/features/composer/ui/components/XReplyFallbackAlert";
import { extractTextFromEditorState } from "@/shared/lib/utils";
import { X_POST_WEIGHTED_MAX } from "@/shared/lib/twitter/xPostTextLimit";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { Button } from "@/shared/ui/components/Button";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { usePanelStack } from "../../contexts/PanelStackContext";
import type { Tweet as TweetType } from "@/features/threads/types";

export interface ReplyPanelProps {
  tweetId: string;
  threadId: string;
  /** Optional pre-loaded tweet to avoid fetch */
  initialTweet?: TweetType | null;
  className?: string;
}

export function ReplyPanel({
  tweetId,
  threadId: _threadId,
  initialTweet,
  className,
}: ReplyPanelProps) {
  const router = useRouter();
  const { popPanel } = usePanelStack();
  const getHydratedTweet = useAction(api.x.getHydratedTwitterPost);
  const replyToPost = useAction(api.x.replyToPost);
  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const { loading: workosLoading } = useWorkosAuth();
  const getHydratedTweetRef = useRef(getHydratedTweet);

  const {
    connectionStatus,
    loading: connectionLoading,
    error: connectionError,
    currentUser: composerCurrentUser,
  } = useViewerXComposerIdentity({ enabled: isAuthenticated });

  const [tweet, setTweet] = useState<TweetType | null>(initialTweet ?? null);
  const [tweetLoading, setTweetLoading] = useState(!initialTweet);
  const [tweetError, setTweetError] = useState<string | null>(null);

  useEffect(() => {
    getHydratedTweetRef.current = getHydratedTweet;
  }, [getHydratedTweet]);

  useEffect(() => {
    if (initialTweet) {
      setTweet(initialTweet);
      setTweetLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        setTweetLoading(true);
        const data = await getHydratedTweetRef.current({ tweetId });
        const resolvedTweet = data.tweet ?? null;
        if (!cancelled) {
          setTweet(resolvedTweet);
          setTweetError(
            resolvedTweet ? null : "This post could not be loaded from X."
          );
        }
      } catch (error) {
        if (!cancelled) {
          setTweet(null);
          setTweetError(
            error instanceof Error ? error.message : "Unable to load post."
          );
        }
      } finally {
        if (!cancelled) {
          setTweetLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tweetId, initialTweet]);

  const handleReplySubmit = useCallback(
    async (content: unknown, mediaUrls?: string[]) => {
      const text = extractTextFromEditorState(content).trim();
      const hasMedia = Array.isArray(mediaUrls) && mediaUrls.length > 0;
      if (!text && !hasMedia) return;
      await replyToPost({
        tweetId,
        text,
        mediaUrls,
      });
      toast.success("Reply posted on X");
    },
    [replyToPost, tweetId]
  );

  const authLoading = convexLoading || workosLoading;
  const accountLoading = isAuthenticated && connectionLoading;
  const shouldShowThread = isAuthenticated && !!connectionStatus?.isConnected;

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout className="md:w-full">
        <PageHeader title="Post" onBack={popPanel} />
        <PageContent className="px-4 pt-4">
          {tweetLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : !tweet ? (
            <div className="text-muted-foreground text-sm">
              {tweetError || "Unable to load this post."}
            </div>
          ) : (
            <div className="mb-0">
              <Tweet
                tweet={tweet}
                showFullContent={true}
                showThread={!shouldShowThread}
              />
            </div>
          )}

          {authLoading || accountLoading ? (
            <div className="mx-0 px-0">
              <div className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-24 w-full rounded-md" />
                </div>
              </div>
            </div>
          ) : !isAuthenticated ? (
            <Alert>
              <AlertTitle>Sign in required</AlertTitle>
              <AlertDescription>
                Sign in and connect X to post replies from this screen.
                <div className="mt-3">
                  <Button size="xs" onClick={() => router.push("/login")}>
                    Sign in
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : connectionError ? (
            <Alert>
              <AlertTitle>Could not load your X account</AlertTitle>
              <AlertDescription>
                {connectionError}
                <div className="mt-3 flex gap-1">
                  <Button size="xs" onClick={() => router.refresh()}>
                    Retry
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => router.push("/settings/connected-accounts")}
                  >
                    View connected accounts
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : !connectionStatus?.isConnected ? (
            <Alert>
              <AlertTitle>X account not connected</AlertTitle>
              <AlertDescription>
                Connect X in Settings → Connected accounts to post replies.
                <div className="mt-3 flex gap-1">
                  <Button
                    size="xs"
                    onClick={() => router.push("/settings/connected-accounts")}
                  >
                    Connect account
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : tweet ? (
            <div className="space-y-3">
              <ReplyComposer
                className="mx-0 px-0"
                replyTo={{
                  tweet,
                  users: [
                    {
                      screenName: tweet.user?.screen_name || "",
                      name: tweet.user?.name || "",
                    },
                  ],
                }}
                currentUser={composerCurrentUser}
                placeholder="Post your reply"
                maxLength={
                  connectionStatus?.postComposerMaxLength ?? X_POST_WEIGHTED_MAX
                }
                characterCountMode={
                  connectionStatus?.postComposerCountMode ?? "x_post"
                }
                onSubmit={handleReplySubmit}
              />
              <XReplyFallbackAlert
                postId={tweetId}
                authorHandle={tweet.user?.screen_name}
              />
            </div>
          ) : null}
        </PageContent>
      </PageLayout>
    </aside>
  );
}
