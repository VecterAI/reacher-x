import { describe, expect, it } from "vitest";
import {
  applyLinkedInViewerReaction,
  isViewerReactionSelected,
} from "./conversationReactionHelpers";

describe("LinkedIn conversation reactions", () => {
  it("adds a viewer reaction and removes the viewer's previous selection", () => {
    expect(
      applyLinkedInViewerReaction(
        [
          { emoji: "👍", count: 2, reactedByViewer: true },
          { emoji: "👏", count: 3 },
        ],
        "👏"
      )
    ).toEqual([
      { emoji: "👍", count: 1, reactedByViewer: false },
      { emoji: "👏", count: 4, reactedByViewer: true },
    ]);
  });

  it("keeps an already selected reaction unchanged", () => {
    expect(
      applyLinkedInViewerReaction(
        [
          { emoji: "❤️", count: 1, reactedByViewer: true },
          { emoji: "👍", count: 2 },
        ],
        "❤️"
      )
    ).toEqual([
      { emoji: "❤️", count: 1, reactedByViewer: true },
      { emoji: "👍", count: 2, reactedByViewer: undefined },
    ]);
  });

  it("detects only the viewer's selected reaction", () => {
    const reactions = [
      { emoji: "👍", count: 2 },
      { emoji: "👏", count: 1, reactedByViewer: true },
    ];

    expect(isViewerReactionSelected(reactions, "👍")).toBe(false);
    expect(isViewerReactionSelected(reactions, "👏")).toBe(true);
  });
});
