"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/shared/lib/utils/utils";
import { formatRelativeTime } from "@/shared/lib/utils/format";
import { TweetMedia } from "@/features/threads/ui/components/TweetMedia";
import { ThreadHeader } from "./ThreadHeader";
import { ThreadMenu } from "./ThreadMenu";
import { highlightInReactTree } from "@/shared/lib/utils/highlighting";
import { parseText } from "@/shared/lib/utils/parseText";
import { Tweet as ThreadTweet } from "@/features/threads/types";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";

export interface QuoteThreadCardProps {
  tweet: ThreadTweet;
  size?: "sm" | "md" | "lg";
  characterLimit?: number;
  showFullContent?: boolean;
  highlightQuery?: string;
  className?: string;
  loading?: boolean;
}

export const QuoteThreadCard: React.FC<QuoteThreadCardProps> = ({
  tweet,
  size = "md",
  characterLimit = 280,
  showFullContent = false,
  highlightQuery,
  className,
  loading = false,
}) => {
  const router = useRouter();
  const media = tweet?.entities?.media;
  const tweetUrl = `https://x.com/${tweet?.user?.screen_name}/status/${tweet?.id_str}`;
  const profileUrl = `https://x.com/${tweet?.user?.screen_name}`;
  // const screenName = tweet?.user?.screen_name || ""; // not used in quote card

  const paddingClass = cn(
    "p-2",
    size === "sm" && "md:p-2",
    size === "md" && "md:p-2",
    size === "lg" && "md:p-3"
  );

  const borderRadiusClass = cn(
    "rounded-xl",
    size === "sm" && "md:rounded-xl",
    size === "md" && "md:rounded-2xl",
    size === "lg" && "md:rounded-3xl"
  );

  const avatarClass = cn(
    "h-6 w-6",
    size === "sm" && "md:h-6 md:w-6",
    size === "md" && "md:h-9 md:w-9",
    size === "lg" && "md:h-10 md:w-10"
  );

  const timeClass = cn(
    "text-xs",
    size === "sm" && "md:text-sm",
    size === "md" && "md:text-base",
    size === "lg" && "md:text-lg"
  );

  const bodyClass = cn(
    "text-base mt-2",
    size === "sm" && "md:text-base md:mt-2",
    size === "md" && "md:text-xl md:mt-2",
    size === "lg" && "md:text-2xl md:mt-4"
  );

  const fullTextRaw = tweet?.full_text || "Tweet text unavailable";
  const isTextLong = fullTextRaw.length > characterLimit;
  const visibleText =
    showFullContent || !isTextLong
      ? fullTextRaw
      : fullTextRaw.substring(0, characterLimit) + ".... Read full ↗";

  const parsedBody = parseText(visibleText, tweet?.entities);
  const highlightedBody = highlightInReactTree(parsedBody, highlightQuery);

  const handleCardNavigate = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const interactive = target.closest(
      "a,button,[role=button],video,media-chrome"
    ) as HTMLElement | null;
    if (interactive && interactive !== e.currentTarget) return;
    e.stopPropagation();

    const id =
      tweet?.conversation_id_str || tweet?.id_str || String(tweet?.id || "");
    if (!id) return;
    router.push(`/home/threads/${id}`);
  };

  if (loading) {
    return (
      <div
        className={cn(
          "group block w-full cursor-pointer rounded-xl border p-2 transition-colors",
          className
        )}
        aria-label="Loading quoted thread"
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
      role="link"
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
        "group block w-full cursor-pointer rounded-xl border transition-colors",
        paddingClass,
        borderRadiusClass,
        className
      )}
      aria-label={`View post by ${tweet?.user?.name ?? tweet?.user?.screen_name ?? "user"}`}
    >
      <div className="flex flex-col">
        <header className="mb-1 flex items-center gap-2">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`View ${tweet?.user?.name ?? tweet?.user?.screen_name ?? "user"}'s profile`}
          >
            <Avatar className={cn(avatarClass, "ring-1 ring-border")}>
              <AvatarImage
                src={tweet?.user?.profile_image_url_https}
                alt={`Avatar of ${tweet?.user?.name}`}
              />
              <AvatarFallback>
                {tweet?.user?.name?.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          </a>

          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <ThreadHeader
              size={size === "lg" ? "md" : "sm"}
              name={tweet?.user?.name}
              screenName={tweet?.user?.screen_name}
              verified={Boolean(tweet?.user?.verified)}
              className={undefined}
            >
              <time
                className={cn(timeClass, "shrink-0 text-muted-foreground")}
                dateTime={tweet?.tweet_created_at}
                title={
                  tweet?.tweet_created_at
                    ? new Date(tweet.tweet_created_at).toLocaleString()
                    : undefined
                }
              >
                · {formatRelativeTime(tweet?.tweet_created_at)}
              </time>
            </ThreadHeader>
            <ThreadMenu tweetUrl={tweetUrl} profileUrl={profileUrl} />
          </div>
        </header>

        <p
          lang="auto"
          className={cn(
            bodyClass,
            "word-break mb-1 hyphens-auto whitespace-pre-line [&_a]:text-muted-foreground hover:[&_a]:underline dark:[&_a]:text-neutral-400"
          )}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest("a")) {
              e.stopPropagation();
            }
          }}
        >
          {highlightedBody}
        </p>

        {media && (
          <div className="mt-2 block shrink-0">
            <TweetMedia media={media} />
          </div>
        )}
      </div>
    </div>
  );
};

QuoteThreadCard.displayName = "QuoteThreadCard";
