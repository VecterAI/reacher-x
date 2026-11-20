import {
  shouldIgnorePostCardClick,
  shouldIgnorePostCardKeyDown,
} from "@/features/webapp/lib/postNavigation";
import { parseText } from "@/shared/lib/utils";
import type { Tweet } from "@/features/threads/types";

/**
 * Minimal quote card for the testimonials marquee. Presentation only:
 * profile data and post text still come from the curated public feed.
 * Everything that is not the quote itself (timestamps, engagement counts,
 * quoted-post embeds) is intentionally left out.
 *
 * The body reuses the app's rich post formatting (parseText) so @mentions,
 * hashtags, and links render like they do in post cards. Because the body
 * can contain its own anchors, the card navigates via a role="link" wrapper
 * instead of a wrapping <a> (nested anchors are invalid HTML).
 */

function testimonialPermalink(tweet: Tweet): string | undefined {
  const { id_str: id, user } = tweet;
  const screenName = user?.screen_name;
  return id && screenName
    ? `https://x.com/${screenName}/status/${id}`
    : undefined;
}

/** Visible post text: respects display_text_range, drops t.co short links. */
function testimonialText(tweet: Tweet): string {
  const source = tweet.full_text ?? tweet.text ?? "";
  const range = tweet.display_text_range;
  const sliced = Array.isArray(range)
    ? source.slice(range[0], range[1] ?? undefined)
    : source;
  return sliced
    .replace(/https:\/\/t\.co\/\w+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function TestimonialCard({ tweet }: { tweet: Tweet }) {
  const href = testimonialPermalink(tweet);
  const text = testimonialText(tweet);
  const name = tweet.user?.name;
  const handle = tweet.user?.screen_name;
  const avatar = tweet.user?.profile_image_url_https;
  if (!href || !text || !handle) return null;

  const openPost = () => {
    if (typeof window !== "undefined") {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`View post by ${name ?? `@${handle}`}`}
      onClick={(event) => {
        if (shouldIgnorePostCardClick(event)) return;
        openPost();
      }}
      onKeyDown={(event) => {
        if (shouldIgnorePostCardKeyDown(event)) return;
        event.preventDefault();
        openPost();
      }}
      className="focus-visible:outline-ring group flex h-full cursor-pointer flex-col rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <article className="flex h-full flex-col gap-8">
        <div>
          <span
            aria-hidden="true"
            className="text-muted-foreground -mb-1 block text-3xl leading-none font-medium select-none"
          >
            “
          </span>
          <p
            lang="auto"
            className="text-foreground word-break [&_a]:text-muted-foreground mt-3 text-lg/7 font-normal text-pretty hyphens-auto [&_a]:hover:underline dark:[&_a]:text-neutral-400"
          >
            {parseText(text)}
          </p>
        </div>
        <footer className="mt-auto flex items-center gap-3">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              width={36}
              height={36}
              loading="lazy"
              className="bg-muted outline-foreground/5 size-9 shrink-0 rounded-full object-cover outline-1 -outline-offset-1 grayscale transition duration-200 group-hover:grayscale-0 motion-reduce:transition-none"
            />
          ) : null}
          <span className="min-w-0">
            {name ? (
              <span className="text-foreground block truncate text-sm/5">
                {name}
              </span>
            ) : null}
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground block truncate text-[13px]/4 hover:underline"
            >
              @{handle}
            </a>
          </span>
        </footer>
      </article>
    </div>
  );
}
