// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));
import { BlogAuthorDetails } from "./BlogAuthorDetails";
import { BlogCard } from "./BlogCard";
import { BLOG_AUTHOR_FALLBACK } from "../../lib/blogAuthorHelpers";
const profile = {
  ...BLOG_AUTHOR_FALLBACK,
  name: "Current author",
  image: "https://pbs.twimg.com/current.jpg",
  verified: true,
};
afterEach(() => {
  document.body.innerHTML = "";
});
test("avatar and name share the X profile link and existing verification icon", () => {
  document.body.innerHTML = renderToStaticMarkup(
    <BlogAuthorDetails profile={profile} />
  );
  const link = document.querySelector("a")!;
  expect(link.href).toBe(profile.url);
  expect(link.textContent).toBe(profile.name);
  expect(link.querySelector("img")?.src).toBe(profile.image);
  expect(link.target).toBe("_blank");
  expect(link.rel).toContain("noopener");
  expect(link.querySelector('[aria-label="Verified on X"]')).not.toBeNull();
});
test("fallback identity does not display verification", () => {
  expect(renderToStaticMarkup(<BlogAuthorDetails />)).not.toContain(
    'aria-label="Verified on X"'
  );
});
test("article link and author link are independent without nested anchors", () => {
  const html = renderToStaticMarkup(
    <BlogCard
      post={{
        slug: "test",
        title: "Article",
        description: "Description",
        date: "2026-09-15",
        category: "engineering",
        tags: [],
        related: [],
        draft: false,
        featured: false,
        readingMinutes: 1,
      }}
      author={<BlogAuthorDetails profile={profile} />}
      featured
    />
  );
  expect(html).toContain('href="/blog/test"');
  expect(html).toContain(`href="${profile.url}"`);
  expect(html).not.toMatch(/<a[ >][^>]*>(?:(?!<\/a>)[\s\S])*<a[ >]/);
});
test("broken remote image shows a skeleton without losing the author link", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<BlogAuthorDetails profile={profile} />));
  await act(async () =>
    host.querySelector("img")!.dispatchEvent(new Event("error"))
  );
  expect(host.querySelector("img")).toBeNull();
  expect(host.querySelector(".animate-skeleton-shimmer")).not.toBeNull();
  expect(host.querySelector("a")!.href).toBe(profile.url);
  await act(async () => root.unmount());
});

test("pending profile shows an avatar skeleton, never the old fallback photo", () => {
  const html = renderToStaticMarkup(<BlogAuthorDetails />);
  expect(html).toContain("animate-skeleton-shimmer");
  expect(html).not.toContain("<img");
  expect(html).not.toContain("founder-3.webp");
});

test("avatar skeleton persists until image load and resets for a new image", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<BlogAuthorDetails profile={profile} />));
  expect(host.querySelector(".animate-skeleton-shimmer")).not.toBeNull();
  expect(host.querySelector("img")!.className).toContain("opacity-0");
  await act(async () =>
    host.querySelector("img")!.dispatchEvent(new Event("load"))
  );
  expect(host.querySelector(".animate-skeleton-shimmer")).toBeNull();
  expect(host.querySelector("img")!.className).toContain("opacity-100");
  await act(async () =>
    root.render(
      <BlogAuthorDetails
        profile={{ ...profile, image: "https://pbs.twimg.com/updated.jpg" }}
      />
    )
  );
  expect(host.querySelector(".animate-skeleton-shimmer")).not.toBeNull();
  expect(host.querySelector("img")!.className).toContain("opacity-0");
  await act(async () => root.unmount());
});

test.each([undefined, { ...profile, verified: false }, profile])(
  "reserves the badge slot for pending, unverified and verified profiles",
  (value) => {
    document.body.innerHTML = renderToStaticMarkup(
      <BlogAuthorDetails profile={value} />
    );
    const slot = document.querySelector("[data-blog-author-badge]");
    expect(slot).not.toBeNull();
    expect(!!slot?.querySelector('[aria-label="Verified on X"]')).toBe(
      value?.verified === true
    );
  }
);
