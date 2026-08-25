import { describe, expect, it } from "vitest";
import {
  buildInitialSetupGenerationUserPrompt,
  buildSetupProfileRevisionUserPrompt,
} from "./setupGenerationCore";
import {
  buildProfileGenerationPrompt,
  buildProfileRevisionPrompt,
} from "../agents/prompts";

const sourceDescription =
  "ReacherX is an open-source agent that searches X and LinkedIn for relevant people. I am building it solo and need contributors who want to work on open source.";

describe("setup generation boundaries", () => {
  it("grounds the initial improvement in the full user-authored description", () => {
    const prompt = buildInitialSetupGenerationUserPrompt({
      seedDescription: sourceDescription,
      useCaseKey: "recruiting",
    });
    const system = buildProfileGenerationPrompt("recruiting");

    expect(prompt).toContain(sourceDescription);
    expect(prompt).toContain("Original user description (source of truth)");
    expect(system).toContain("Description Fidelity Rules (NON-NEGOTIABLE)");
    expect(system).toContain("Never invent, infer, exaggerate, or add");
    expect(system).not.toContain("2-3 sentences");
    expect(system).toContain("at least 2 strict posts");
    expect(system).toContain("at least 2 balanced posts");
    expect(system).toContain("at least 1 broad but accurate post");
    expect(system).toContain("Final qualification must verify");
  });

  it("asks an ICP revision for profiles only", () => {
    const prompt = buildSetupProfileRevisionUserPrompt({
      seedDescription: sourceDescription,
      currentImprovedDescription: sourceDescription,
      currentProfiles: [
        {
          title: "React contributors",
          description: "Developers looking for open-source projects.",
          painPoints: ["Want a meaningful project"],
          channels: ["X/Twitter"],
        },
      ],
      revisionFeedback: "Remove React Native and focus on Next.js.",
      useCaseKey: "recruiting",
    });
    const system = buildProfileRevisionPrompt("recruiting");

    expect(prompt).toContain(
      "Current improved description (context only; do not edit or return it)"
    );
    expect(prompt).toContain("Do not return a description field.");
    expect(system).toContain("Return profiles only.");
    expect(system.toLowerCase()).toContain(
      "do not write, summarize, improve, replace"
    );
  });
});
