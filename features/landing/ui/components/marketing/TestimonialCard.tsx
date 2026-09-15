import type { Tweet } from "@/features/threads/types";

/**
 * Minimal quote card for the testimonials marquee. Presentation only:
 * profile data and post text still come from the curated public X feed.
 * Everything that is not the quote itself (timestamps, engagement counts,
 * quoted-post embeds) is intentionally left out.
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

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="focus-visible:outline-ring flex h-full flex-col focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <article className="border-border flex h-full flex-col border p-6 transition-colors duration-200 hover:border-neutral-50 hover:bg-neutral-50 motion-reduce:transition-none dark:hover:border-neutral-900 dark:hover:bg-neutral-900">
        <span
          aria-hidden="true"
          className="text-foreground -mb-2 block text-6xl leading-none font-medium select-none"
        >
          “
        </span>
        <p className="text-foreground mt-4 text-xl leading-8 font-normal tracking-tight text-pretty">
          {text}
        </p>
        <footer className="mt-auto flex items-center gap-3 pt-8">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              className="size-10 shrink-0 rounded-full object-cover"
            />
          ) : null}
          <span className="min-w-0">
            {name ? (
              <span className="text-foreground block truncate text-sm font-medium">
                {name}
              </span>
            ) : null}
            <span className="text-muted-foreground block truncate text-sm">
              @{handle}
            </span>
          </span>
        </footer>
      </article>
    </a>
  );
}
