// @vitest-environment node
import { describe, expect, test } from "vitest";
import {
  createBlogCardArtifact,
  createBlogDemoArtifact,
  validateAgentArtifactEnvelope,
} from "../../../shared/lib/json-render/agentArtifacts";
import { getAgentArtifactsFromToolResult } from "../../../features/agent/lib/toolArtifacts";
import { getWebResearchModelOutput } from "./webResearch";

describe("web research model output", () => {
  test("persists a metadata-only artifact for the inline UI", () => {
    const artifact = createBlogCardArtifact({
      slug: "reach-out-and-get-replies",
      title: "How to reach out and actually get replies",
      sourceUrl: "https://reacherx.com/blog/reach-out-and-get-replies",
    });

    expect(artifact).toBeDefined();
    expect(validateAgentArtifactEnvelope(artifact)).toEqual(artifact);

    const output = getWebResearchModelOutput({
      success: true,
      operation: "show",
      artifact,
    });

    expect(output.type).toBe("json");
    expect(getAgentArtifactsFromToolResult(output.value)).toEqual([artifact]);
    expect(JSON.stringify(output.value)).not.toMatch(/<iframe|<svg|<html/i);
  });

  test("reconstructs show artifacts for older saved tool results", () => {
    const articleArtifact = createBlogCardArtifact({
      slug: "reach-out-and-get-replies",
      sourceUrl: "https://www.reacherx.com/blog/reach-out-and-get-replies",
    });
    const demoArtifact = createBlogDemoArtifact({
      scenario: "reach-out-writing-preferences",
      title: "Interactive walkthrough",
      caption: "Explore this workflow in ReacherX.",
      sourceUrl: "https://www.reacherx.com",
    });

    expect(
      getAgentArtifactsFromToolResult(
        JSON.stringify({ success: true, operation: "show" }),
        {
          operation: "show",
          resourceType: "article",
          slug: "reach-out-and-get-replies",
          sourceUrl: "https://www.reacherx.com/blog/reach-out-and-get-replies",
        }
      )
    ).toEqual([articleArtifact]);
    expect(
      getAgentArtifactsFromToolResult(
        JSON.stringify({ success: true, operation: "show" }),
        {
          operation: "show",
          resourceType: "article",
          slug: "Guide",
          sourceUrl: "https://reacherx.com/blog/Guide",
        }
      )
    ).toEqual([
      createBlogCardArtifact({
        slug: "guide",
        sourceUrl: "https://reacherx.com/blog/Guide",
      }),
    ]);
    expect(
      getAgentArtifactsFromToolResult(
        JSON.stringify({ success: true, operation: "show" }),
        {
          operation: "show",
          resourceType: "demo",
          demoId: "reach-out-writing-preferences",
          sourceUrl: "https://www.reacherx.com",
        }
      )
    ).toEqual([demoArtifact]);
  });
});
