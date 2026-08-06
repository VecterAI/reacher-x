import { describe, expect, it } from "vitest";
import { buildSetupAgentPrompt } from "./prompts";

describe("chat-driven setup agent prompt", () => {
  const prompt = buildSetupAgentPrompt("general_outreach");

  it("uses agent tools for validated input and profile revisions", () => {
    expect(prompt).toContain("call submitSetupAudience");
    expect(prompt).toContain("call reviseSetupAudience");
    expect(prompt).toContain("call approveSetupIdealProfiles");
    expect(prompt).toContain("structured LLM validation/classification");
  });

  it("limits setup approval to ideal profiles", () => {
    expect(prompt).toContain("Approval applies to profiles only");
    expect(prompt).toContain("improved description is background-only");
    expect(prompt).not.toContain("suggested description and ideal profiles");
  });

  it("does not describe onboarding as panel-first or expose preferences", () => {
    expect(prompt).not.toContain("panel-first");
    expect(prompt).not.toContain("connections/plan/preferences");
    expect(prompt).toContain("There is no manual use-case question");
    expect(prompt).toContain("no preferences step");
  });

  it("keeps generated profiles in the inline setup UI", () => {
    expect(prompt).toContain("respond with one short acknowledgment");
    expect(prompt).toContain("do not enumerate, restate, or invent profiles");
    expect(prompt).toContain("Let the inline setup card present");
  });
});
