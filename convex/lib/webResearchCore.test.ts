import { describe, expect, it } from "vitest";
import {
  getReacherXBlogSlug,
  isHttpUrl,
  isReacherXUrl,
} from "./webResearchCore";

describe("web research URL boundaries", () => {
  it("accepts only http and https URLs", () => {
    expect(isHttpUrl("https://example.com/page")).toBe(true);
    expect(isHttpUrl("http://example.com/page")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isHttpUrl("not a URL")).toBe(false);
  });

  it("recognizes only the ReacherX host", () => {
    expect(
      isReacherXUrl("https://reacherx.com/blog/reach-out-and-get-replies")
    ).toBe(true);
    expect(isReacherXUrl("https://www.reacherx.com/blog/guide")).toBe(true);
    expect(isReacherXUrl("https://evil-reacherx.com/blog/guide")).toBe(false);
    expect(isReacherXUrl("https://reacherx.com.evil.test/blog/guide")).toBe(
      false
    );
  });

  it("extracts safe blog slugs from canonical and Markdown URLs", () => {
    expect(
      getReacherXBlogSlug(
        "https://www.reacherx.com/blog/reach-out-and-get-replies/markdown"
      )
    ).toBe("reach-out-and-get-replies");
    expect(
      getReacherXBlogSlug("https://reacherx.com/blog/Guide/?utm=agent")
    ).toBe("guide");
    expect(getReacherXBlogSlug("https://reacherx.com/blog")).toBeNull();
    expect(getReacherXBlogSlug("https://reacherx.com/blog/a/b")).toBeNull();
    expect(getReacherXBlogSlug("https://example.com/blog/guide")).toBeNull();
  });
});
