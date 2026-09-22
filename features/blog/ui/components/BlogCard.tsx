import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/shared/lib/utils";
import { blogHref, type BlogPostSummary } from "../../lib/blogHelpers";
import { BlogMetadata } from "./BlogMetadata";
import { BlogAuthorDetails } from "./BlogAuthorDetails";
import { BlogGradientCover } from "./BlogGradientCover";

export function BlogCard({
  author,
  post,
  featured = false,
  showImage = false,
}: {
  author?: ReactNode;
  post: BlogPostSummary;
  featured?: boolean;
  showImage?: boolean;
}) {
  const cover = showImage && post.image;
  return (
    <article className="h-full min-w-0">
      <div
        className={cn(
          "blog-card relative flex h-full flex-col",
          featured &&
            "bg-background transition-colors duration-200 hover:bg-neutral-50 motion-reduce:transition-none dark:bg-neutral-950 dark:hover:bg-neutral-900"
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
            <Link
              href={blogHref(post.slug)}
              className="focus-visible:outline-ring after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              {post.title}
            </Link>
          </h2>
          {featured && (
            <p className="text-muted-foreground mt-auto pt-6 text-sm leading-5 text-pretty">
              {post.description}
            </p>
          )}
          <footer className={cn("pt-6", !featured && "mt-auto")}>
            {author ?? <BlogAuthorDetails />}
          </footer>
        </div>
      </div>
    </article>
  );
}
