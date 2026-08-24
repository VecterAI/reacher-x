import { describe, expect, test } from "vitest";
import {
  buildLinkdApiProfilePostsQuery,
  limitLinkdApiProfilePosts,
} from "./linkdApiProfilePostsCore";

describe("LinkdAPI profile post pagination", () => {
  test("always sends start zero with the profile URN", () => {
    expect(buildLinkdApiProfilePostsQuery("ACoAA-profile")).toEqual({
      urn: "ACoAA-profile",
      start: 0,
    });
  });

  test("keeps start zero when sending a cursor", () => {
    expect(
      buildLinkdApiProfilePostsQuery("ACoAA-profile", " next-page ")
    ).toEqual({
      urn: "ACoAA-profile",
      start: 0,
      cursor: "next-page",
    });
  });

  test("returns a complete provider page when no result limit is requested", () => {
    const posts = Array.from({ length: 100 }, (_, index) => index);

    expect(limitLinkdApiProfilePosts(posts)).toEqual(posts);
    expect(limitLinkdApiProfilePosts(posts, 10)).toEqual(posts.slice(0, 10));
  });

  test("treats invalid explicit limits as empty instead of slicing backwards", () => {
    expect(limitLinkdApiProfilePosts([1, 2, 3], -1)).toEqual([]);
    expect(limitLinkdApiProfilePosts([1, 2, 3], Number.NaN)).toEqual([]);
  });
});
