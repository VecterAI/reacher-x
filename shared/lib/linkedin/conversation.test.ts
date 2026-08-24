import { describe, expect, it } from "vitest";
import { isLinkedInConversationFeatureDisabled } from "./conversation";

describe("LinkedIn conversation feature flags", () => {
  it("recognizes singular and plural v1 capability names", () => {
    expect(isLinkedInConversationFeatureDisabled(["reply"], "reply")).toBe(
      true
    );
    expect(isLinkedInConversationFeatureDisabled(["replies"], "reply")).toBe(
      true
    );
    expect(
      isLinkedInConversationFeatureDisabled(["reactions"], "reaction")
    ).toBe(true);
  });
});
