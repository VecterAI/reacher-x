import {
  formatBlogDate,
  getBlogCategory,
  type BlogPostSummary,
} from "../../lib/blogHelpers";
export function BlogMetadata({
  post,
  readingTime = false,
}: {
  post: BlogPostSummary;
  readingTime?: boolean;
}) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <time dateTime={post.date} className="font-mono tabular-nums">
        {formatBlogDate(post.date)}
      </time>
      <span aria-hidden="true">·</span>
      {readingTime ? (
        <span className="font-mono tabular-nums">
          {post.readingMinutes} min read
        </span>
      ) : (
        <span>{getBlogCategory(post.category)?.label}</span>
      )}
      {readingTime && post.updated && (
        <>
          <span aria-hidden="true">·</span>
          <span>
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
