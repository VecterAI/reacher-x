"use client";

import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useMemo, useCallback, useEffect, useState, useRef } from "react";
import { base64UrlDecodeUtf8 } from "@/shared/lib/utils";
import {
  PageHeader,
  PageLayout,
  PageContent,
} from "@/features/webapp/ui/components";
import { Tweet as TweetComponent } from "@/features/webapp/ui/components";
import type { Tweet } from "@/features/threads/types";
import { ReplyComposer } from "@/features/composer/ui/components/ReplyComposer";
import { useAuth } from "@/shared/hooks/useAuth";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
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

function PostDetailInner() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const tweetId = params.id;

  // 1) Instant hydration from navigation payload (base64-encoded JSON to avoid URL length issues)
  const navTweet: Tweet | null = useMemo(() => {
    const packed = searchParams.get("t");
    if (!packed) return null;
    try {
      const json = base64UrlDecodeUtf8(packed);
      return JSON.parse(json) as Tweet;
    } catch {
      return null;
    }
  }, [searchParams]);

  const tweet = navTweet;

  const { isAuthenticated, isLoading, user, xProfile } = useAuth();
  const xAccount = useQuery(
    api.socialAccountsMutations.getXAccount,
    isAuthenticated ? {} : "skip"
  );
  const postReply = useAction(api.socialAccounts.postReply);
  const tryRefresh = useAction(api.socialAccounts.refreshTokenIfNeeded);
  const { openProfile } = useProfile();
  useIsMobile();

  // Reply status monitoring is now handled globally in webapp layout

  const [showAuthAlert, setShowAuthAlert] = useState(false);
  const openedForTweetRef = useRef<string | null>(null);

  const isTokenInvalid = (expiresAt?: number): boolean => {
    if (!expiresAt) return false;
    const now = Date.now();
    return expiresAt - now <= 0;
  };

  // Proactive token refresh & validity check on page entry
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isAuthenticated) return;
      if (xAccount === undefined || xAccount === null) return;
      const refreshed = await tryRefresh({}).catch(() => undefined);
      const refreshedOrAccount = (refreshed ?? xAccount) as
        | { expiresAt?: number }
        | null
        | undefined;
      const expiresAt = refreshedOrAccount?.expiresAt;
      const expired = isTokenInvalid(expiresAt);
      if (!cancelled) {
        setShowAuthAlert(expired);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, xAccount, tryRefresh]);

  // xProfile is fetched globally via useAuth

  // Auto-open author's profile once per tweet (seed with known user data)
  useEffect(() => {
    if (!tweet) return;
    const author = tweet.user?.screen_name;
    if (!author) return;
    // Do not auto-open on mobile to avoid drawer popping
    // Use a synchronous media query so we don't open before the hook updates
    const isMobileNow =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches;
    if (isMobileNow) return;
    if (openedForTweetRef.current === tweetId) return;
    openProfile({ username: author, seedProfile: tweet.user });
    openedForTweetRef.current = tweetId;
  }, [tweetId, tweet, tweet?.user?.screen_name, openProfile]);

  const handleReplySubmit = useCallback(
    async (
      content: unknown,
      mediaUrls?: string[],
      mediaDescriptions?: string[]
    ) => {
      const text = extractTextFromEditorState(content).trim();
      const hasMedia = Array.isArray(mediaUrls) && mediaUrls.length > 0;
      if (!text && !hasMedia) return;
      // Refresh token if near expiry before posting (ignore errors)
      await tryRefresh({}).catch(() => undefined);
      await postReply({
        inReplyToTweetId: tweetId,
        text,
        mediaUrls,
        mediaDescriptions,
        originalTweetAuthor: tweet?.user?.screen_name,
        replyPreview: text.substring(0, 50),
      });
    },
    [postReply, tryRefresh, tweetId, tweet?.user?.screen_name]
  );

  // Show the vertical thread/separator below the avatar only when authenticated and has an X account
  const shouldShowThread = isAuthenticated && xAccount;

  // Derived loading/account state for stable rendering
  const authLoading = isLoading;
  const accountLoading = isAuthenticated && xAccount === undefined;
  const expiredImmediate =
    isAuthenticated &&
    !!xAccount &&
    isTokenInvalid((xAccount as { expiresAt?: number })?.expiresAt);

  return (
    <div className="flex max-w-full justify-start">
      <PageLayout className="shrink-0">
        <PageHeader title="Post" onBack={() => router.back()} />
        <PageContent className="mx-4 mt-2 space-y-0 pb-4">
          {!tweet ? (
            <div className="text-muted-foreground text-sm">
              Loading tweet… If this persists, open from Search again.
            </div>
          ) : (
            <TweetComponent
              tweet={tweet}
              showFullContent={true}
              showThread={!shouldShowThread}
            />
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
                Please sign in and connect your X (Twitter) account to post
                replies.
                <div className="mt-3">
                  <Button size="xs" onClick={() => router.push("/login")}>
                    Sign in
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : xAccount === null ? (
            // Authenticated but no account: prompt to connect
            <Alert>
              <AlertTitle>X (Twitter) account not connected</AlertTitle>
              <AlertDescription>
                Connect your X (Twitter) account in Settings → Linked accounts
                to post replies.
                <div className="mt-3 flex gap-2">
                  <Button
                    size="xs"
                    onClick={() =>
                      router.push(
                        `/api/x/connect?returnTo=${encodeURIComponent(`/post/x/${tweetId}`)}`
                      )
                    }
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
          ) : expiredImmediate || showAuthAlert ? (
            // Expired session: destructive alert, shown immediately when detected
            <Alert>
              <AlertTitle>Your X/Twitter session expired</AlertTitle>
              <AlertDescription>
                Reconnect your account to continue posting replies.
                <div className="mt-3 flex gap-2">
                  <Button
                    size="xs"
                    onClick={() =>
                      router.push(
                        `/api/x/connect?returnTo=${encodeURIComponent(
                          `/settings/connected-accounts?next=${encodeURIComponent(`/post/x/${tweetId}`)}`
                        )}`
                      )
                    }
                  >
                    Reconnect
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
              currentUser={{
                name:
                  xProfile?.name ||
                  xAccount?.screenName ||
                  user?.firstName ||
                  user?.email ||
                  "User",
                screenName: xProfile?.username || xAccount?.screenName || "",
                profileImageUrl:
                  xProfile?.profile_image_url ||
                  xAccount?.profileImageUrl ||
                  undefined,
              }}
              placeholder="Post your reply"
              onSubmit={handleReplySubmit}
            />
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
