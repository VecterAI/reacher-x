import { publicNotFoundHtml } from "@/shared/lib/urls/publicNotFoundHelpers";

export const BLOG_NOT_FOUND_TITLE = "Post not found";
export const BLOG_NOT_FOUND_DESCRIPTION =
  "This post may have moved or hasn’t been published yet.";

// Return a complete error document before the shared shell starts streaming.
export const BLOG_NOT_FOUND_HTML = publicNotFoundHtml("blog");
