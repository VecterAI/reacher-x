import { describe, expect, it } from "vitest";
import { USER_FACING_LANGUAGE_RULES } from "./agentLanguageHelpers";
import {
  WORKSPACE_USE_CASE_KEYS,
  getWorkspaceUseCase,
  getWorkspaceStageActionLabel,
} from "./workspaceUseCases";
import {
  buildMainAgentPrompt,
  buildSetupAgentPrompt,
  buildOutreachAgentPrompt,
  buildProfileGenerationPrompt,
  buildProfileRevisionPrompt,
  buildQualificationPrompt,
  URL_ANALYSIS_PROMPT,
} from "../../convex/agents/prompts";
import {
  resolvePricingFeatureCopy,
  resolvePlanFeatureEntityCopy,
} from "../../features/landing/lib/pricingUseCaseCopy";

describe("shared human-facing vocabulary", () => {
  it.each(WORKSPACE_USE_CASE_KEYS)(
    "keeps prompts and UI consistent for %s",
    (key) => {
      const useCase = getWorkspaceUseCase(key);
      for (const build of [
        buildMainAgentPrompt,
        buildSetupAgentPrompt,
        buildOutreachAgentPrompt,
        buildProfileGenerationPrompt,
        buildProfileRevisionPrompt,
        buildQualificationPrompt,
      ]) {
        const prompt = build(key);
        expect(prompt).toContain(USER_FACING_LANGUAGE_RULES);
        expect(prompt).toContain(
          `User-facing target label: ${useCase.entityPlural}`
        );
        expect(prompt).toContain(
          "enum values, database fields, IDs, routes, and evaluation criteria unchanged"
        );
      }
    }
  );
  it("uses people for old workspaces without a goal and preserves their URLs", () => {
    expect(getWorkspaceUseCase(undefined)).toMatchObject({
      entitySingular: "Person",
      entityPlural: "People",
      routeSlugs: { entity: "prospects", success: "converts" },
      stageLabels: { converted: "Customer" },
    });
    expect(getWorkspaceStageActionLabel(undefined, "converted")).toBe(
      'Mark "Customer"'
    );
    expect(getWorkspaceUseCase("recruiting").stageLabels.converted).toBe(
      "Hired"
    );
    expect(
      getWorkspaceUseCase("podcast_speaker_sourcing").stageLabels.converted
    ).toBe("Booked");
    expect(getWorkspaceUseCase("general_outreach").stageLabels.converted).toBe(
      "Converted"
    );
  });
  it("translates existing pricing strings without rewriting stored plans", () => {
    expect(
      resolvePricingFeatureCopy(
        "100 qualified prospects per workspace / month",
        "customer_prospecting"
      )
    ).toBe("100 people who match per workspace / month");
    expect(
      resolvePricingFeatureCopy(
        "100 qualified prospects per workspace / month",
        "recruiting"
      )
    ).toBe("100 candidates who match per workspace / month");
    expect(
      resolvePricingFeatureCopy("Unlimited workspaces", "recruiting")
    ).toBe("Unlimited workspaces");
  });
  it("applies plain language to website analysis too", () => {
    expect(URL_ANALYSIS_PROMPT).toContain(USER_FACING_LANGUAGE_RULES);
  });
});

it("uses current pricing copy when no goal or an older backend label is supplied", () => {
  expect(
    resolvePlanFeatureEntityCopy(
      "100 qualified prospects per workspace / month"
    )
  ).toBe("100 people who match per workspace / month");
  expect(
    resolvePlanFeatureEntityCopy(
      "100 qualified prospects per workspace / month",
      "Prospects"
    )
  ).toBe("100 people who match per workspace / month");
});
