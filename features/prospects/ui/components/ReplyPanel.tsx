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
import { useViewerXComposerIdentity } from "@/features/composer/hooks/useViewerXComposerIdentity";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { ReplyComposer } from "@/features/composer/ui/components/ReplyComposer";
import { XReplyFallbackAlert } from "@/features/composer/ui/components/XReplyFallbackAlert";
import { extractTextFromEditorState } from "@/shared/lib/utils";
import { X_POST_WEIGHTED_MAX } from "@/shared/lib/twitter/xPostTextLimit";
import { cacheTwitterPostEngagement } from "@/shared/hooks/useTwitterPostEngagementState";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { Button } from "@/shared/ui/components/Button";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { usePanelStack } from "../../contexts/PanelStackContext";
import type { Tweet as TweetType } from "@/features/threads/types";
import { ThreadAwareTwitterReplyBody } from "./ThreadAwareTwitterReplyBody";

export interface ReplyPanelProps {
  tweetId: string;
  threadId: string;
  /** Optional pre-loaded tweet to avoid fetch */
  initialTweet?: TweetType | null;
  className?: string;
  onBack?: () => void;
}

export function ReplyPanel({
  tweetId,
  threadId,
  initialTweet,
  className,
  onBack,
}: ReplyPanelProps) {
  const router = useRouter();
  const { popPanel } = usePanelStack();
  const replyToPost = useAction(api.x.replyToPost);
  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const { loading: workosLoading } = useWorkosAuth();

  const {
    connectionStatus,
    loading: connectionLoading,
    error: connectionError,
    currentUser: composerCurrentUser,
  } = useViewerXComposerIdentity({ enabled: isAuthenticated });

  const authLoading = convexLoading || workosLoading;
  const accountLoading = isAuthenticated && connectionLoading;

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout className="flex h-full flex-col md:w-full">
        <PageHeader title="Post" onBack={onBack ?? popPanel} />
        <ScrollArea
          className="min-h-0 flex-1 overscroll-contain"
          viewportClassName="pb-6"
        >
          <PageContent className="space-y-4 py-4">
            <ThreadAwareTwitterReplyBody
              tweetId={tweetId}
              threadId={threadId}
              initialTweet={initialTweet}
              overlayCommented={initialTweet?.viewerState?.commented === true}
              renderComposerSection={(tweet) => (
                <div className="mx-4">
                  {authLoading || accountLoading ? (
                    <div className="flex gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-3">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-24 w-full rounded-md" />
                      </div>
                    </div>
                  ) : !isAuthenticated ? (
                    <Alert>
                      <AlertTitle>Sign in required</AlertTitle>
                      <AlertDescription>
                        Sign in and connect X/Twitter to post replies from this
                        screen.
                        <div className="mt-3">
                          <Button
                            size="xs"
                            onClick={() => router.push("/login")}
                          >
                            Sign in
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : connectionError ? (
                    <Alert>
                      <AlertTitle>
                        Could not load your X/Twitter account
                      </AlertTitle>
                      <AlertDescription>
                        {connectionError}
                        <div className="mt-3 flex gap-1">
                          <Button size="xs" onClick={() => router.refresh()}>
                            Retry
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() =>
                              router.push("/settings/connected-accounts")
                            }
                          >
                            View connected accounts
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : !connectionStatus?.isConnected ? (
                    <Alert>
                      <AlertTitle>X/Twitter account not connected</AlertTitle>
                      <AlertDescription>
                        Connect X/Twitter in Settings → Connected accounts to
                        post replies.
                        <div className="mt-3 flex gap-1">
                          <Button
                            size="xs"
                            onClick={() =>
                              router.push("/settings/connected-accounts")
                            }
                          >
                            Connect account
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : (
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
                          connectionStatus?.postComposerMaxLength ??
                          X_POST_WEIGHTED_MAX
                        }
                        characterCountMode={
                          connectionStatus?.postComposerCountMode ?? "x_post"
                        }
                        inlineAutocompleteContext={{
                          surfaceLabel: "x_reply_panel",
                          threadId,
                        }}
                        onSubmit={async (
                          content,
                          mediaUrls,
                          mediaDescriptions,
                          _mediaKinds
                        ) => {
                          const text =
                            extractTextFromEditorState(content).trim();
                          const hasMedia =
                            Array.isArray(mediaUrls) && mediaUrls.length > 0;
                          if (!text && !hasMedia) return;
                          await replyToPost({
                            tweetId,
                            text,
                            mediaUrls,
                            mediaDescriptions,
                            parentAuthorId: tweet.user?.id_str,
                          });
                          cacheTwitterPostEngagement({
                            postId: tweetId,
                            viewerStatePatch: { commented: true },
                          });
                          toast.success("Reply posted on X/Twitter");
                        }}
                      />
                      <XReplyFallbackAlert
                        postId={tweetId}
                        authorHandle={tweet.user?.screen_name}
                      />
                    </div>
                  )}
                </div>
              )}
            />
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
  );
}
