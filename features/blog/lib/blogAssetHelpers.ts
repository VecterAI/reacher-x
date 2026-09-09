import { access } from "node:fs/promises";
import path from "node:path";
import type { BlogPostSummary } from "./blogHelpers";

/** Validate static assets before deployment, never while serving a request. */
export async function validateBlogAssets(
  posts: Pick<BlogPostSummary, "slug" | "image" | "ogImage">[],
  publicDirectory = path.join(process.cwd(), "public")
) {
  await Promise.all(
    posts.flatMap((post) =>
      [post.image, post.ogImage].map(async (image) => {
        if (!image) return;
        try {
          await access(path.join(publicDirectory, image));
        } catch {
          throw new Error(`[BlogAssets] ${post.slug}: missing asset ${image}`);
        }
      })
    )
  );
}
