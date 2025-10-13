import * as React from "react";
import type { Tweet as TweetType } from "../../../threads/types";
import { cn } from "@/shared/lib/utils/utils";
import { formatRelativeTime } from "@/shared/lib/utils/format";
import { TweetHeader } from "./TweetHeader";
import { TweetBody } from "./TweetBody";
import { TweetMedia } from "../../../threads/ui/components/TweetMedia";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { TweetMenu } from "./TweetMenu";
import { useProfile } from "@/features/profile/contexts/ProfileContext";
import { useRouter, useSearchParams } from "next/navigation";
import { base64UrlEncodeUtf8 } from "@/shared/lib/utils/encoding";
import { cacheTweet } from "@/shared/lib/utils/tweetCache";

export interface QuoteTweetCardProps {
  tweet: TweetType;
  characterLimit?: number;
  showFullContent?: boolean;
  highlightQuery?: string;
  className?: string;
  loading?: boolean;
}

export const QuoteTweetCard: React.FC<QuoteTweetCardProps> = ({
  tweet,
  characterLimit = 280,
  showFullContent = false,
  highlightQuery,
  className,
  loading = false,
}) => {
  const media = tweet?.entities?.media;
  const externalTweetUrl = `https://x.com/${tweet?.user?.screen_name}/status/${tweet?.id_str}`;
  const externalProfileUrl = `https://x.com/${tweet?.user?.screen_name}`;
  const screenName = tweet?.user?.screen_name || "";
  const { openProfile, prefetchProfile } = useProfile();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleCardNavigate = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    // Ignore clicks on interactive elements EXCEPT the card container itself
    const interactive = target.closest(
      "a,button,[role=button],video,media-chrome"
    ) as HTMLElement | null;
    if (interactive && interactive !== e.currentTarget) return;
    e.stopPropagation();

    // Cache quoted tweet for instant hydration
    try {
      cacheTweet(tweet);
    } catch {}

    // Pack tweet as base64url param
    let packed = "";
    try {
      packed = base64UrlEncodeUtf8(JSON.stringify(tweet));
    } catch {}

    const id = tweet?.id_str || String(tweet?.id || "");
    if (!id) return;

    const params = new URLSearchParams();
    if (packed) params.set("t", packed);
    // Preserve search context when available
    const keywordId = searchParams?.get("keywordId");
    const q = searchParams?.get("q");
    if (keywordId) params.set("keywordId", keywordId);
    if (q) params.set("q", q);

    router.push(`/post/${id}?${params.toString()}`, { scroll: false });
  };

  // Extract tweet source (e.g., Twitter for iPhone)
  let tweetSource: React.ReactNode = null;
  if (tweet?.source) {
    // tweet.source is HTML like: <a href="...">Twitter for iPhone</a>
    if (typeof window !== "undefined") {
      const parser = new window.DOMParser();
      const doc = parser.parseFromString(tweet.source, "text/html");
      const a = doc.querySelector("a");
      if (a) {
        tweetSource = (
          <span className="text-xs text-muted-foreground">
            Source{" "}
            <a
              href={a.getAttribute("href") || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {a.textContent}
            </a>
          </span>
        );
      }
    }
  }

  if (loading) {
    return (
      <div
        className={cn(
          "group block w-full cursor-pointer rounded-xl border p-2 transition-colors",
          className
        )}
        aria-label="Loading quoted tweet"
      >
        <div className="flex flex-col">
          <header className="mb-1 flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-muted ring-1 ring-border" />
            <div className="flex flex-1 items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-24 rounded-md bg-muted" />
                <div className="h-4 w-16 rounded-md bg-muted" />
              </div>
              <div className="h-4 w-6 rounded-md bg-muted" />
            </div>
          </header>
          <div className="mb-1 space-y-2">
            <div className="h-4 w-5/6 rounded-md bg-muted" />
            <div className="h-4 w-4/6 rounded-md bg-muted" />
          </div>
          <div className="mt-2 h-32 w-full rounded-md bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardNavigate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const synthetic = {
            ...e,
            target: e.target as EventTarget & HTMLElement,
            currentTarget: e.currentTarget as EventTarget & HTMLDivElement,
            stopPropagation: () => {},
          } as unknown as React.MouseEvent<HTMLDivElement>;
          handleCardNavigate(synthetic);
        }
      }}
      className={cn(
        "group block w-full cursor-pointer rounded-xl border p-2 transition-colors hover:bg-muted/50",
        className
      )}
      aria-label={`View post by ${tweet?.user?.name ?? tweet?.user?.screen_name ?? "user"}`}
    >
      {/* Single column layout with avatar in header */}
      <div className="flex flex-col">
        {/* Header with integrated avatar */}
        <header className="mb-1 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (screenName)
                openProfile({ username: screenName, seedProfile: tweet.user });
            }}
            onMouseEnter={() => screenName && prefetchProfile(screenName)}
            onFocus={() => screenName && prefetchProfile(screenName)}
            aria-label={`View ${tweet?.user?.name ?? tweet?.user?.screen_name ?? "user"}'s profile`}
          >
            <Avatar className="h-6 w-6 ring-1 ring-border">
              <AvatarImage
                src={tweet?.user?.profile_image_url_https}
                alt={`Avatar of ${tweet?.user?.name}`}
              />
              <AvatarFallback>
                {tweet?.user?.name?.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          </button>

          <div className="flex flex-1 items-center justify-between">
            <TweetHeader staticUser={tweet?.user}>
              <time
                className="truncate text-sm text-muted-foreground"
                dateTime={tweet?.tweet_created_at}
              >
                · {formatRelativeTime(tweet?.tweet_created_at)}
              </time>
            </TweetHeader>
            <TweetMenu
              tweetUrl={externalTweetUrl}
              profileUrl={externalProfileUrl}
              screenName={screenName}
              fullText={tweet?.full_text || tweet?.text || ""}
            />
          </div>
        </header>

        {/* Body */}
        <TweetBody
          tweet={tweet}
          characterLimit={characterLimit}
          showFullContent={showFullContent}
          highlightQuery={highlightQuery}
          className="mb-1"
        />

        {/* Media */}
        {media && (
          <div className="mt-2 block shrink-0">
            <TweetMedia media={media} />
          </div>
        )}

        {/* Tweet source */}
        {tweetSource && <div className="mt-1">{tweetSource}</div>}
      </div>
    </div>
  );
};

QuoteTweetCard.displayName = "QuoteTweetCard";
