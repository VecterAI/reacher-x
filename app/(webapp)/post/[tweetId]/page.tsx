"use client";

import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useMemo, useCallback, useEffect, useState, useRef } from "react";
import { base64UrlDecodeUtf8 } from "@/shared/lib/utils/encoding";
import {
  PageHeader,
  PageLayout,
  PageContent,
} from "@/features/webapp/ui/components";
import { Tweet as TweetComponent } from "@/features/webapp/ui/components/Tweet";
import type { Tweet } from "@/features/threads/types";
import { getCachedTweet, touchTweetLRU } from "@/shared/lib/utils/tweetCache";
import { ReplyComposer } from "@/features/composer/ui/components/ReplyComposer";
import { useAuth } from "@/shared/hooks/useAuth";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { extractTextFromEditorState } from "@/shared/lib/utils/urlDetection";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { Button } from "@/shared/ui/components/Button";
import { validateTokenExpiration } from "@/shared/lib/utils/tokenValidation";
import {
  ProfileProvider,
  useProfile,
} from "@/features/profile/contexts/ProfileContext";
import { ProfilePanel } from "@/features/profile/ui/components/ProfilePanel";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import { extractKeywordsFromQuery } from "@/shared/lib/utils/highlighting";
import { Skeleton } from "@/shared/ui/components/Skeleton";

function PostDetailInner() {
  const router = useRouter();
  const params = useParams<{ tweetId: string }>();
  const searchParams = useSearchParams();
  const tweetId = params.tweetId;

  // 1) Instant hydration from navigation or local cache (no effects needed)
  // We prefer the navigation payload when present (base64-encoded JSON to avoid URL length issues)
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

  const cachedTweet = useMemo(() => getCachedTweet(tweetId), [tweetId]);
  const tweet = navTweet || cachedTweet;
  // Touch LRU after render to avoid setState-in-render cascades triggered by storage events
  useEffect(() => {
    if (tweetId) {
      queueMicrotask(() => touchTweetLRU(tweetId));
    }
  }, [tweetId]);
  const keywordIdParam = searchParams.get("keywordId") || "";
  const queryParam = searchParams.get("q") || "";
  const exactParam = searchParams.get("exact") === "true";

  const highlightQueries = useMemo(() => {
    if (!queryParam) return undefined;
    return exactParam ? [queryParam] : extractKeywordsFromQuery(queryParam);
  }, [queryParam, exactParam]);

  const { isAuthenticated, isLoading, user } = useAuth();
  const xAccount = useQuery(
    api.socialAccountsMutations.getXAccount,
    isAuthenticated ? {} : "skip"
  );
  const postReply = useAction(api.socialAccounts.postReply);
  const tryRefresh = useAction(api.socialAccounts.refreshTokenIfNeeded);
  const getTwitterProfile = useAction(api.socialapi.getTwitterProfile);
  const { openProfile } = useProfile();
  useIsMobile();

  // Reply status monitoring is now handled globally in webapp layout

  const [xProfile, setXProfile] = useState<{
    name: string;
    screen_name: string;
    profile_image_url_https: string;
  } | null>(null);

  const [showAuthAlert, setShowAuthAlert] = useState(false);
  const openedForTweetRef = useRef<string | null>(null);

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
      const validation = validateTokenExpiration(expiresAt);
      if (!cancelled) {
        setShowAuthAlert(validation.isValid === false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, xAccount, tryRefresh]);

  // Fetch the logged-in user's X profile for avatar/name/handle
  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!xAccount?.screenName) return;
      const data = (await getTwitterProfile({
        twitter: xAccount.screenName,
      }).catch(() => undefined)) as
        | {
            name?: string;
            screen_name?: string;
            profile_image_url_https?: string;
          }
        | undefined;
      if (active && data)
        setXProfile({
          name: data.name || "",
          screen_name: data.screen_name || "",
          profile_image_url_https: data.profile_image_url_https || "",
        });
    };
    run();
    return () => {
      active = false;
    };
  }, [xAccount?.screenName, getTwitterProfile]);

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
    validateTokenExpiration((xAccount as { expiresAt?: number })?.expiresAt)
      .isValid === false;

  return (
    <div className="flex max-w-full justify-start">
      <PageLayout className="shrink-0">
        <PageHeader title="Post" onBack={() => router.back()} />
        <PageContent className="mx-4 mt-2 space-y-0 pb-4">
          {!tweet ? (
            <div className="text-sm text-muted-foreground">
              Loading tweet… If this persists, open from Search again.
            </div>
          ) : (
            <TweetComponent
              tweet={tweet}
              showFullContent={true}
              showThread={!shouldShowThread}
              votingContext={{
                keywordId: keywordIdParam || "",
                searchQuery: queryParam || "",
              }}
              highlightQueries={highlightQueries}
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
                        `/api/x/connect?returnTo=${encodeURIComponent(`/post/${tweetId}`)}`
                      )
                    }
                  >
                    Connect account
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => router.push("/settings/linked-accounts")}
                  >
                    View linked accounts
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : expiredImmediate || showAuthAlert ? (
            // Expired session: destructive alert, shown immediately when detected
            <Alert variant="destructive">
              <AlertTitle>Your X session expired</AlertTitle>
              <AlertDescription>
                Reconnect your account to continue posting replies.
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      router.push(
                        `/api/x/connect?returnTo=${encodeURIComponent(`/post/${tweetId}`)}`
                      )
                    }
                  >
                    Reconnect
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAuthAlert(false)}
                  >
                    Dismiss
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
                screenName: xProfile?.screen_name || xAccount?.screenName || "",
                profileImageUrl: xProfile?.profile_image_url_https || undefined,
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
