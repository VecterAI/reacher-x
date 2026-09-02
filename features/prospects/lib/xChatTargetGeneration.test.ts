import { describe, expect, it } from "vitest";
import {
  advanceXChatTargetGeneration,
  createXChatTargetGeneration,
  isCurrentXChatTargetGeneration,
} from "./xChatTargetGeneration";

describe("X/Twitter Chat target generations", () => {
  it("invalidates an in-flight result when the connected account changes", async () => {
    let current = createXChatTargetGeneration(
      "prospect-1:viewer-old:participant-1"
    );
    const oldRequest = current;
    let visibleState = "checking-new-target";

    const oldResult = Promise.resolve().then(() => {
      if (isCurrentXChatTargetGeneration(current, oldRequest)) {
        visibleState = "old-result-applied";
      }
    });

    current = advanceXChatTargetGeneration(
      current,
      "prospect-1:viewer-new:participant-1"
    );
    await oldResult;

    expect(visibleState).toBe("checking-new-target");
    expect(isCurrentXChatTargetGeneration(current, oldRequest)).toBe(false);
  });

  it("keeps concurrent work valid while the full target is unchanged", () => {
    const current = createXChatTargetGeneration(
      "prospect-1:viewer-1:participant-1"
    );

    expect(
      isCurrentXChatTargetGeneration(
        advanceXChatTargetGeneration(current, current.targetKey),
        current
      )
    ).toBe(true);
  });
});
