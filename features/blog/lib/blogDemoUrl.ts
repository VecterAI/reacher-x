import type { BlogDemoId } from "./blogDemoHelpers";
import { getBlogDemoInitialPath } from "./blogDemoCatalog";

/** The isolated app is deployed separately; no mock services enter this bundle. */
export function getBlogDemoUrl(
  scenario: BlogDemoId,
  origin = process.env.NEXT_PUBLIC_BLOG_DEMO_ORIGIN,
  parentOrigin?: string
) {
  if (!origin)
    throw new Error(
      "Set NEXT_PUBLIC_BLOG_DEMO_ORIGIN to the isolated demo app URL before building the blog."
    );
  const base = new URL(origin);
  if (parentOrigin && base.origin === new URL(parentOrigin).origin)
    throw new Error("The demo app must use a different origin from the blog.");
  if (
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw new Error(
      "Use a bare demo app origin without credentials, path, query or fragment."
    );
  const url = new URL(getBlogDemoInitialPath(scenario), base);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error(
      "The demo app URL must use HTTPS, or loopback HTTP for development."
    );
  url.searchParams.set("scenario", scenario);
  return url.href;
}
