"use client";

import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useMemo, useCallback, useEffect, useState } from "react";
import {
  PageHeader,
  PageLayout,
  PageContent,
} from "@/features/webapp/ui/components";
import { Tweet as TweetComponent } from "@/features/threads/ui/components/Tweet";
import type { Tweet } from "@/features/threads/types";
import { getCachedTweet } from "@/shared/lib/utils/tweetCache";
import { ReplyComposer } from "@/features/composer/ui/components/ReplyComposer";
import { useAuth } from "@/shared/hooks/useAuth";
import { useReplyStatus } from "@/shared/hooks/useReplyStatus";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { extractTextFromEditorState } from "@/shared/lib/utils/urlDetection";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";

export default function PostDetailPage() {
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
      const json = atob(packed);
      return JSON.parse(json) as Tweet;
    } catch {
      return null;
    }
  }, [searchParams]);

  const cachedTweet = useMemo(() => getCachedTweet(tweetId), [tweetId]);
  const tweet = navTweet || cachedTweet;

  const { isAuthenticated, isLoading, user } = useAuth();
  const xAccount = useQuery(
    api.socialAccountsMutations.getXAccount,
    isAuthenticated ? {} : "skip"
  );
  const postReply = useAction(api.socialAccounts.postReply);
  const tryRefresh = useAction(api.socialAccounts.refreshTokenIfNeeded);
  const getTwitterProfile = useAction(api.socialdata.getTwitterProfile);

  // Monitor reply status and show notifications
  useReplyStatus();

  const [xProfile, setXProfile] = useState<{
    name: string;
    screen_name: string;
    profile_image_url_https: string;
  } | null>(null);

  // Fetch the logged-in user's X profile for avatar/name/handle
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        if (!xAccount?.screenName) return;
        const data = (await getTwitterProfile({
          twitter: xAccount.screenName,
        })) as {
          name: string;
          screen_name: string;
          profile_image_url_https: string;
        } | null;
        if (active && data) setXProfile(data);
      } catch {}
    };
    run();
    return () => {
      active = false;
    };
  }, [xAccount?.screenName, getTwitterProfile]);

  const handleReplySubmit = useCallback(
    async (content: unknown, mediaUrls?: string[]) => {
      const text = extractTextFromEditorState(content).trim();
      if (!text) return;
      try {
        // Refresh token if near expiry before posting
        await tryRefresh({});
      } catch {}
      await postReply({ inReplyToTweetId: tweetId, text, mediaUrls });
    },
    [postReply, tryRefresh, tweetId]
  );

  return (
    <PageLayout>
      <PageHeader title="Post" onBack={() => router.back()} />
      <PageContent className="mx-4 mt-2 space-y-0">
        {!tweet ? (
          <div className="text-sm text-muted-foreground">
            Loading tweet… If this persists, open from Search again.
          </div>
        ) : (
          <TweetComponent
            tweet={tweet}
            showFullContent={true}
            showThread={false}
          />
        )}

        {isLoading ? null : !isAuthenticated ? (
          <Alert>
            <AlertTitle>Sign in required</AlertTitle>
            <AlertDescription>
              Please sign in and connect your X (Twitter) account to post
              replies.
            </AlertDescription>
          </Alert>
        ) : !xAccount ? (
          <Alert>
            <AlertTitle>X account not connected</AlertTitle>
            <AlertDescription>
              Connect your X (Twitter) account in Settings → Linked accounts to
              post replies.
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
  );
}
