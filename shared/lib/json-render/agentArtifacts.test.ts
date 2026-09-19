import { describe, expect, it } from "vitest";
import {
  createBlogCardArtifact,
  createBlogDemoArtifact,
  getAgentArtifactSemanticKey,
  validateAgentArtifactEnvelope,
} from "./agentArtifacts";

describe("blog agent artifacts", () => {
  it("validates a ReacherX blog card reference without embedding content", () => {
    const artifact = createBlogCardArtifact({
      slug: "reach-out-and-get-replies",
      title: "Reach out and get replies",
      sourceUrl: "https://reacherx.com/blog/reach-out-and-get-replies",
    });

    expect(artifact).toBeDefined();
    expect(validateAgentArtifactEnvelope(artifact)).toEqual(artifact);
    expect(getAgentArtifactSemanticKey(artifact!)).toBe(
      "BlogCardArtifact:reach-out-and-get-replies"
    );
    expect(JSON.stringify(artifact)).not.toMatch(/<iframe|<svg|<html/i);
  });

  it("validates a demo reference using metadata only", () => {
    const artifact = createBlogDemoArtifact({
      scenario: "reach-out-writing-preferences",
      title: "Set writing preferences",
      caption: "See how the workflow keeps outreach in your voice.",
      sceneRange: [0, 2],
      sourceUrl: "https://reacherx.com/blog/reach-out-and-get-replies",
    });

    expect(artifact).toBeDefined();
    expect(validateAgentArtifactEnvelope(artifact)).toEqual(artifact);
    expect(getAgentArtifactSemanticKey(artifact!)).toBe(
      "BlogDemoArtifact:reach-out-writing-preferences:0-2"
    );
    expect(JSON.stringify(artifact)).not.toMatch(/<iframe|<svg|<html/i);
  });

  it("rejects scene ranges outside the selected demo", () => {
    expect(
      createBlogDemoArtifact({
        scenario: "reach-out-writing-preferences",
        title: "Invalid walkthrough",
        caption: "This range is outside the demo.",
        sceneRange: [0, 999],
      })
    ).toBeUndefined();
  });
});
