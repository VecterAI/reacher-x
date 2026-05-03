"use client";

import { useRouter, useParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { useAction, useConvexAuth } from "convex/react";
import { useAuth as useWorkosAuth } from "@workos-inc/authkit-nextjs/components";
import { api } from "@/convex/_generated/api";
import {
  PageHeader,
  PageLayout,
  PageContent,
} from "@/features/webapp/ui/components";
import { Tweet as TweetComponent } from "@/features/webapp/ui/components";
import { ReplyComposer } from "@/features/composer/ui/components/ReplyComposer";
import { XReplyFallbackAlert } from "@/features/composer/ui/components/XReplyFallbackAlert";
import { useViewerXComposerIdentity } from "@/features/composer/hooks/useViewerXComposerIdentity";
import { X_POST_WEIGHTED_MAX } from "@/shared/lib/twitter/xPostTextLimit";
import { useHydratedTwitterPosts } from "@/shared/hooks/useHydratedTwitterPosts";
import { extractTextFromEditorState } from "@/shared/lib/utils";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { Button } from "@/shared/ui/components/Button";
import {
  ProfileProvider,
  useProfile,
} from "@/features/profile/contexts/TwitterProfileContext";
import { ProfilePanel } from "@/features/profile/ui/components";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { toast } from "sonner";

function PostDetailInner() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const tweetId = params.id;

  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const { loading: workosLoading } = useWorkosAuth();
  const replyToPost = useAction(api.x.replyToPost);
  const { openProfile } = useProfile();
  const isMobile = useIsMobile();
  const openedForTweetRef = useRef<string | null>(null);
  const {
    connectionStatus,
    loading: connectionLoading,
    error: connectionError,
    currentUser: composerCurrentUser,
    refetch: refetchConnectionStatus,
  } = useViewerXComposerIdentity({ enabled: isAuthenticated });
  const {
    tweetsById,
    resultsById,
    isLoading: hydratedTweetLoading,
    error: hydratedTweetError,
    refresh: refreshHydratedTweet,
  } = useHydratedTwitterPosts([tweetId]);
  const displayTweet = tweetsById[tweetId] ?? null;
  const tweet = displayTweet;
  const tweetLoading = hydratedTweetLoading && !displayTweet;
  const tweetError =
    resultsById[tweetId]?.status === "not_found"
      ? (resultsById[tweetId]?.message ?? "This post is no longer available.")
      : hydratedTweetError;

  const loadTweet = useCallback(async () => {
    await refreshHydratedTweet({ force: true });
  }, [refreshHydratedTweet]);

  // Auto-open author's profile once per tweet (seed with known user data)
  useEffect(() => {
    if (!tweet) return;
    const author = tweet.user?.screen_name;
    if (!author) return;
    if (isMobile) return;
    if (openedForTweetRef.current === tweetId) return;
    openProfile({ username: author, seedProfile: tweet.user });
    openedForTweetRef.current = tweetId;
  }, [isMobile, openProfile, tweet, tweetId]);

  const handleReplySubmit = useCallback(
    async (
      content: unknown,
      mediaUrls?: string[],
      mediaDescriptions?: string[],
      _mediaKinds?: ("image" | "gif" | "video")[]
    ) => {
      const text = extractTextFromEditorState(content).trim();
      const hasMedia = Array.isArray(mediaUrls) && mediaUrls.length > 0;
      if (!text && !hasMedia) return;
      await replyToPost({
        tweetId,
        text,
        mediaUrls,
        mediaDescriptions,
        parentAuthorId: tweet?.user?.id_str,
      });
      toast.success("Reply posted on X/Twitter");
      await loadTweet();
    },
    [loadTweet, replyToPost, tweetId, tweet?.user?.id_str]
  );

  const authLoading = convexLoading || workosLoading;
  const accountLoading = isAuthenticated && connectionLoading;
  const shouldShowThread = isAuthenticated && !!connectionStatus?.isConnected;

  return (
    <div className="flex max-w-full justify-start">
      <PageLayout className="shrink-0">
        <PageHeader title="Post" onBack={() => router.back()} />
        <PageContent className="mx-4 mt-2 space-y-0 pb-4">
          {tweetLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : !tweet || !displayTweet ? (
            <div className="space-y-3">
              <div className="text-muted-foreground text-sm">
                {tweetError || "Unable to load this post."}
              </div>
              <Button
                size="xs"
                variant="outline"
                onClick={() => void loadTweet()}
              >
                Retry post
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <TweetComponent
                tweet={displayTweet}
                showFullContent={true}
                showThread={!shouldShowThread}
              />
            </div>
          )}

          {authLoading || accountLoading ? (
            // Composer skeleton while auth/account state resolves
            <div className="mx-0 px-0">
              <div className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-24 w-full rounded-md" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-20 rounded-md" />
                    <Skeleton className="h-8 w-24 rounded-md" />
                  </div>
                </div>
              </div>
            </div>
          ) : !isAuthenticated ? (
            // Unauthenticated: show sign-in alert immediately
            <Alert>
              <AlertTitle>Sign in required</AlertTitle>
              <AlertDescription>
                Sign in and connect X/Twitter to post replies from this screen.
                <div className="mt-3">
                  <Button size="xs" onClick={() => router.push("/login")}>
                    Sign in
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : connectionError ? (
            <Alert>
              <AlertTitle>Could not load your X/Twitter account</AlertTitle>
              <AlertDescription>
                {connectionError}
                <div className="mt-3 flex gap-1">
                  <Button
                    size="xs"
                    onClick={() => void refetchConnectionStatus()}
                  >
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
              <AlertTitle>X/Twitter account not connected</AlertTitle>
              <AlertDescription>
                Connect X/Twitter in Settings → Connected accounts to post replies.
                <div className="mt-3 flex gap-1">
                  <Button
                    size="xs"
                    onClick={() => router.push("/settings/connected-accounts")}
                  >
                    Connect account
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
                inlineAutocompleteContext={{
                  surfaceLabel: "x_reply_page",
                }}
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
      <ProfilePanel />
    </div>
  );
}

export default function PostDetailPage() {
  return (
    <ProfileProvider>
      <PostDetailInner />
    </ProfileProvider>
  );
}
