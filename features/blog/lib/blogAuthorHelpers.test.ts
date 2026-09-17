import { describe, expect, test } from "vitest";
import {
  BLOG_AUTHOR_FALLBACK,
  resolveBlogAuthorProfile,
} from "./blogAuthorHelpers";
const profile = {
  name: "New author name",
  screen_name: "ReacherXfounder",
  profile_image_url_https: "https://pbs.twimg.com/profile_images/new/photo.jpg",
  verified: true,
};
describe("public blog author profile", () => {
  test("uses current provider name, image, handle and verification", () => {
    expect(resolveBlogAuthorProfile(profile)).toEqual({
      name: profile.name,
      image: profile.profile_image_url_https,
      url: "https://x.com/ReacherXfounder",
      verified: true,
    });
  });
  test.each([
    null,
    {},
    [],
    { ...profile, name: " " },
    { ...profile, screen_name: "../../evil" },
    { ...profile, screen_name: "bad?handle" },
  ])("falls back for malformed identity %j", (raw) => {
    expect(resolveBlogAuthorProfile(raw)).toEqual(BLOG_AUTHOR_FALLBACK);
  });
  test.each([
    undefined,
    "javascript:alert(1)",
    "http://pbs.twimg.com/photo.jpg",
    "https://evil.test/photo.jpg",
    "https://pbs.twimg.com.evil.test/photo.jpg",
    "https://user:password@pbs.twimg.com/photo.jpg",
  ])("rejects unsupported avatar %s", (image) => {
    expect(
      resolveBlogAuthorProfile({ ...profile, profile_image_url_https: image })
        .image
    ).toBe(BLOG_AUTHOR_FALLBACK.image);
  });
  test.each([false, undefined, "true", 1])(
    "does not invent verification for %s",
    (verified) => {
      expect(resolveBlogAuthorProfile({ ...profile, verified }).verified).toBe(
        false
      );
    }
  );
});
