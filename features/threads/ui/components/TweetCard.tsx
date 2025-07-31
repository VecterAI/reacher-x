// features/landing/ui/components/TweetCard.tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { formatRelativeTime } from "@/shared/lib/utils/format";
import { cn } from "@/shared/lib/utils/utils";
import { Separator } from "@/shared/ui/components/Separator";
import { TweetMedia } from "@/features/threads/ui/components/TweetMedia";
import { parseText } from "@/shared/lib/utils/parseText";
import { highlightInReactTree } from "@/shared/lib/utils/highlighting";
import { TweetHeader } from "./TweetHeader";
import { TweetFooter } from "./TweetFooter";
import { TweetMenu } from "./TweetMenu";
import { Tweet } from "@/features/threads/types";
import Link from "next/link";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { LinkWrapper } from "../../../landing/ui/components/LinkWrapper";

const tweetCardVariants = cva(
  "flex gap-4 w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background transition-colors",
  {
    variants: {
      bordered: {
        true: "border-b border-muted",
        false: "",
      },
    },
    defaultVariants: {
      bordered: false,
    },
  }
);

export interface TweetCardProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children">,
    VariantProps<typeof tweetCardVariants> {
  size?: "sm" | "md" | "lg";
  threadId: string;
  staticTweet: Tweet;
  bordered?: boolean;
  className?: string;
  characterLimit?: number;
  showFullContent?: boolean;
  showThread?: boolean;
  // Voting context for tweet performance tracking
  votingContext?: {
    keywordId: string;
    searchQuery: string;
  };
}

export const TweetCard = React.forwardRef<HTMLElement, TweetCardProps>(
  (
    {
      threadId,
      staticTweet,
      size = "md",
      bordered = false,
      className,
      characterLimit = 280,
      showFullContent = false,
      showThread = false,
      votingContext,
      ...props
    },
    ref
  ) => {
    const fullText = staticTweet?.full_text || "Tweet text unavailable";
    const isTextLong = fullText.length > characterLimit;
    const visibleText =
      showFullContent || !isTextLong
        ? fullText
        : fullText.substring(0, characterLimit) + ".... Read full ↗";
    const parsedBody = parseText(visibleText, staticTweet?.entities);
    const highlightedBody = highlightInReactTree(
      parsedBody,
      votingContext?.searchQuery
    );
    const media = staticTweet?.entities?.media;
    const tweetUrl = `https://x.com/${staticTweet?.user?.screen_name}/status/${staticTweet?.id_str}`;
    const profileUrl = `https://x.com/${staticTweet?.user?.screen_name}`;

    const avatarClass = cn(
      "h-8 w-8",
      size === "sm" && "md:h-8 md:w-8",
      size === "md" && "md:h-9 md:w-9",
      size === "lg" && "md:h-10 md:w-10"
    );

    const rightColumnClass = cn(
      bordered ? "pb-0" : "pb-4",
      !bordered && "pb-4",
      !bordered && size === "sm" && "md:pb-4",
      !bordered && size === "md" && "md:pb-6",
      !bordered && size === "lg" && "md:pb-12"
    );

    const timeClass = cn(
      "text-sm",
      size === "sm" && "md:text-sm",
      size === "md" && "md:text-base",
      size === "lg" && "md:text-lg"
    );

    const inReplyingToScreenNameClass = cn(
      "text-sm",
      size === "sm" && "md:text-sm",
      size === "md" && "md:text-sm",
      size === "lg" && "md:text-base"
    );

    const bodyClass = cn(
      "text-base",
      size === "sm" && "md:text-base",
      size === "md" && "md:text-xl",
      size === "lg" && "md:text-2xl"
    );

    const hasAdditionalContent = Boolean(media);

    return (
      <article ref={ref} {...props}>
        <div
          className={cn(tweetCardVariants({ bordered }), className, "group")}
          aria-label={`View post by ${staticTweet?.user?.name ?? staticTweet?.user?.screen_name ?? "user"}`}
        >
          <div className="grid grid-rows-[auto_1fr] place-items-center gap-2">
            <LinkWrapper
              href={`https://x.com/${staticTweet?.user?.screen_name}`}
              isExternal={true}
            >
              <Avatar className={cn(avatarClass, "ring-1 ring-border")}>
                <AvatarImage
                  src={staticTweet?.user?.profile_image_url_https}
                  alt={`Avatar of ${staticTweet?.user?.name}`}
                />
                <AvatarFallback>
                  {staticTweet?.user?.name?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </LinkWrapper>

            {!showThread && bordered === false && (
              <Separator orientation="vertical" className="w-[2px]" />
            )}
          </div>

          <div
            className={cn(
              "grid w-full gap-12",
              hasAdditionalContent
                ? "grid-cols-1 @[1100px]:grid-cols-[calc(33.53%-1.5rem)_calc(66.47%-1.5rem)]"
                : "grid-cols-1"
            )}
          >
            <section className={cn(rightColumnClass, "flex flex-col gap-4")}>
              <header className="mt-1 flex items-center justify-between gap-4">
                <TweetHeader
                  threadId={threadId}
                  tweetId={staticTweet?.id_str}
                  size="lg"
                  staticUser={staticTweet?.user}
                >
                  <time
                    className={cn(
                      timeClass,
                      "ease-[cubic-bezier(0.25, 1, 0.5, 1)] truncate text-muted-foreground duration-300"
                    )}
                    dateTime={staticTweet?.tweet_created_at}
                  >
                    · {formatRelativeTime(staticTweet?.tweet_created_at)}
                  </time>
                </TweetHeader>

                <TweetMenu tweetUrl={tweetUrl} profileUrl={profileUrl} />
              </header>

              {staticTweet?.in_reply_to_screen_name && (
                <p
                  className={cn(
                    inReplyingToScreenNameClass,
                    "ease-[cubic-bezier(0.25, 1, 0.5, 1)] whitespace-pre-line font-medium text-muted-foreground duration-300"
                  )}
                >
                  Replying to{" "}
                  <Link
                    className="font-mono text-foreground hover:underline"
                    href={`https://x.com/${staticTweet?.in_reply_to_screen_name}`}
                  >
                    @{staticTweet?.in_reply_to_screen_name}
                  </Link>
                </p>
              )}

              <p
                lang="auto"
                className={cn(
                  bodyClass,
                  "word-break hyphens-auto whitespace-pre-line [&_a]:text-muted-foreground hover:[&_a]:underline dark:[&_a]:text-neutral-400"
                )}
              >
                {highlightedBody}
              </p>

              {hasAdditionalContent && (
                <div className="block shrink-0 @[1100px]:hidden">
                  {media && <TweetMedia media={media} />}
                </div>
              )}

              <TweetFooter
                threadId={threadId}
                tweetId={staticTweet?.id_str}
                tweetUrl={tweetUrl}
                staticTweet={staticTweet}
                votingContext={votingContext}
              />
            </section>

            {hasAdditionalContent && (
              <aside className="mt-4 hidden @[1100px]:block">
                {media && <TweetMedia media={media} />}
              </aside>
            )}
          </div>
        </div>
      </article>
    );
  }
);

TweetCard.displayName = "TweetCard";
