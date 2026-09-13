import Image from "next/image";
import Link from "next/link";
import { cn } from "@/shared/lib/utils";
import { blogHref, type BlogPostSummary } from "../../lib/blogHelpers";
import { BlogMetadata } from "./BlogMetadata";
import { BlogAuthor } from "./BlogAuthor";
import { BlogGradientCover } from "./BlogGradientCover";

export function BlogCard({
  post,
  featured = false,
  showImage = false,
}: {
  post: BlogPostSummary;
  featured?: boolean;
  showImage?: boolean;
}) {
  const cover = showImage && post.image;
  return (
    <article className="min-w-0">
      <Link
        href={blogHref(post.slug)}
        className={cn(
          "blog-card focus-visible:outline-ring flex h-full flex-col focus-visible:outline-2 focus-visible:outline-offset-4",
          featured &&
            "bg-muted/25 hover:bg-muted/50 transition-colors duration-200 motion-reduce:transition-none"
        )}
      >
        {cover ? (
          <Image
            src={cover}
            alt={post.imageAlt ?? ""}
            width={1200}
            height={630}
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="aspect-[1200/630] w-full object-cover"
          />
        ) : showImage ? (
          <BlogGradientCover slug={post.slug} />
        ) : null}
        <div
          className={cn(
            "flex flex-1 flex-col",
            featured ? "p-6" : "py-4",
            showImage && !featured && "pt-5"
          )}
        >
          <BlogMetadata post={post} />
          <h2
            className={cn(
              "mt-5 font-normal text-balance",
              featured
                ? "text-2xl leading-8 lg:text-3xl lg:leading-9"
                : "text-xl leading-7"
            )}
          >
            {post.title}
          </h2>
          {featured && (
            <p className="text-muted-foreground mt-auto pt-6 text-sm leading-5 text-pretty">
              {post.description}
            </p>
          )}
          <footer className={cn("pt-6", !featured && "mt-auto")}>
            <BlogAuthor />
          </footer>
        </div>
      </Link>
    </article>
  );
}
