import { describe, expect, test } from "vitest";
import { normalizeTwitterSearchCursor } from "./twitterSearchResultCore";

describe("normalizeTwitterSearchCursor", () => {
  test.each([null, undefined, "", "   "])(
    "normalizes an absent provider cursor (%s) to undefined",
    (cursor) => {
      expect(normalizeTwitterSearchCursor(cursor)).toBeUndefined();
    }
  );

  test("preserves a valid provider cursor", () => {
    expect(normalizeTwitterSearchCursor(" cursor-token ")).toBe("cursor-token");
  });
});
