import { validateBlogAssets } from "../features/blog/lib/blogAssetHelpers";
import { getBlogPosts } from "../features/blog/lib/blogPosts";

getBlogPosts()
  .then(validateBlogAssets)
  .catch((error: unknown) => {
    console.error("[BlogAssets] Validation failed", error);
    process.exitCode = 1;
  });
