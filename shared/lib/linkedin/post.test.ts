import { describe, expect, it } from "vitest";
import { isRenderableLinkedInMediaUrl } from "./post";

describe("LinkedIn media URL validation", () => {
  it("accepts HTTPS provider media and rejects insecure or active schemes", () => {
    expect(
      isRenderableLinkedInMediaUrl("https://media.licdn.com/example.mp4")
    ).toBe(true);
    expect(
      isRenderableLinkedInMediaUrl("http://media.licdn.com/example.mp4")
    ).toBe(false);
    expect(isRenderableLinkedInMediaUrl("javascript:alert(1)")).toBe(false);
  });
});
