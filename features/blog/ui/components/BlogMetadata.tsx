import {
  formatBlogDate,
  getBlogCategory,
  type BlogPostSummary,
} from "../../lib/blogHelpers";
export function BlogMetadata({
  post,
  readingTime = false,
  truncate = false,
}: {
  post: BlogPostSummary;
  readingTime?: boolean;
  truncate?: boolean;
}) {
  return (
    <div
      className={`text-muted-foreground flex items-center gap-x-2 text-sm ${truncate ? "min-w-0 flex-nowrap whitespace-nowrap" : "flex-wrap gap-y-1"}`}
    >
      <time
        dateTime={post.date}
        className={`${truncate ? "shrink-0" : ""}font-mono tabular-nums`}
      >
        {formatBlogDate(post.date)}
      </time>
      <span aria-hidden="true" className={truncate ? "shrink-0" : undefined}>
        ·
      </span>
      {readingTime ? (
        <span className={`${truncate ? "shrink-0" : ""}font-mono tabular-nums`}>
          {post.readingMinutes} min read
        </span>
      ) : (
        <span className={truncate ? "min-w-0 truncate" : undefined}>
          {getBlogCategory(post.category)?.label}
        </span>
      )}
      {readingTime && post.updated && (
        <>
          <span
            aria-hidden="true"
            className={truncate ? "shrink-0" : undefined}
          >
            ·
          </span>
          <span className={truncate ? "min-w-0 truncate" : undefined}>
            Updated{" "}
            <time className="font-mono tabular-nums" dateTime={post.updated}>
              {formatBlogDate(post.updated)}
            </time>
          </span>
        </>
      )}
    </div>
  );
}
