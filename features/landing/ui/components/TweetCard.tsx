// features/landing/ui/components/TweetCard.tsx
import * as React from "react";
import { Suspense } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { formatRelativeTime } from "@/shared/lib/utils/format";
import { cn } from "@/shared/lib/utils/utils";
import { Separator } from "@/shared/ui/components/Separator";
import { TweetMedia } from "@/features/landing/ui/components/TweetMedia";
import { parseText } from "@/shared/lib/utils/parseText";
import { TweetHeader } from "./TweetHeader";
import { TweetFooter } from "./TweetFooter";
import { TweetMenu } from "./TweetMenu";
import { Tweet } from "@/app/(landing)/threads/types";
import { ReplyLink } from "./ReplyLink";

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
  isLast?: boolean;
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
      isLast = false,
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
            <Suspense
              fallback={
                <div className={cn(avatarClass, "ring-1 ring-border")}>
                  Loading...
                </div>
              }
            >
              <TweetHeader
                threadId={threadId}
                tweetId={staticTweet?.id_str}
                avatarClass={avatarClass}
              />
            </Suspense>
            {!isLast && (
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
                <Suspense fallback={<div>Loading...</div>}>
                  <TweetHeader
                    threadId={threadId}
                    tweetId={staticTweet?.id_str}
                    size="lg"
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
                </Suspense>

                <TweetMenu tweetUrl={tweetUrl} profileUrl={profileUrl} />
              </header>

              {staticTweet?.in_reply_to_screen_name && (
                <p
                  className={cn(
                    "text-sm",
                    size === "sm" && "md:text-sm",
                    size === "md" && "md:text-sm",
                    size === "lg" && "md:text-base",
                    "whitespace-pre-line font-medium text-muted-foreground"
                  )}
                >
                  Replying to{" "}
                  <ReplyLink screenName={staticTweet.in_reply_to_screen_name} />
                </p>
              )}

              <p
                lang="auto"
                className={cn(
                  bodyClass,
                  "word-break hyphens-auto whitespace-pre-line [&_a]:text-muted-foreground hover:[&_a]:underline dark:[&_a]:text-neutral-400"
                )}
                dangerouslySetInnerHTML={{ __html: parsedBody }}
              />

              {hasAdditionalContent && (
                <div className="block shrink-0 @[1100px]:hidden">
                  {media && <TweetMedia media={media} />}
                </div>
              )}

              <Suspense fallback={<footer>Loading...</footer>}>
                <TweetFooter
                  threadId={threadId}
                  tweetId={staticTweet?.id_str}
                  tweetUrl={tweetUrl}
                />
              </Suspense>
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
