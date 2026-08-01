import { describe, expect, it } from "vitest";
import { buildSetupAgentPrompt } from "./prompts";

describe("chat-driven setup agent prompt", () => {
  const prompt = buildSetupAgentPrompt("general_outreach");

  it("uses agent tools for validated input and profile revisions", () => {
    expect(prompt).toContain("call submitSetupAudience");
    expect(prompt).toContain("call reviseSetupAudience");
    expect(prompt).toContain("structured LLM validation/classification");
  });

  it("does not describe onboarding as panel-first or expose preferences", () => {
    expect(prompt).not.toContain("panel-first");
    expect(prompt).not.toContain("connections/plan/preferences");
    expect(prompt).toContain("There is no manual use-case question");
    expect(prompt).toContain("no preferences step");
  });
});
