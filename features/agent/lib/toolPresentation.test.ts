import { describe, expect, it } from "vitest";
import {
  getToolIconKey,
  getToolLabel,
  isInlineWebResearchCall,
} from "./toolPresentation";

describe("agent tool presentation", () => {
  it("uses readable labels for known and unknown tools", () => {
    expect(getToolLabel("refinePlan")).toBe("Refine plan");
    expect(getToolLabel("getProspectInteractionHistory")).toBe(
      "Read conversation history"
    );
    expect(getToolLabel("newToolName")).toBe("New tool name");
  });

  it("changes web research labels by operation", () => {
    expect(getToolLabel("webResearch", { operation: "search" })).toBe(
      "Search the web"
    );
    expect(getToolLabel("webResearch", { operation: "read" })).toBe(
      "Read web page"
    );
    expect(
      getToolLabel("webResearch", {
        operation: "show",
        resourceType: "demo",
      })
    ).toBe("Search the web");
  });

  it("marks source show calls for direct inline rendering", () => {
    expect(
      isInlineWebResearchCall("webResearch", {
        operation: "show",
        resourceType: "demo",
      })
    ).toBe(true);
    expect(
      isInlineWebResearchCall("webResearch", { operation: "search" })
    ).toBe(false);
  });

  it("uses the globe icon for every web research operation", () => {
    expect(getToolIconKey("webResearch")).toBe("globe");
    expect(getToolIconKey("unregisteredTool")).toBe("change");
  });

  it("renders workspace tools with the folder icon", () => {
    expect(getToolIconKey("queryWorkspace")).toBe("folder");
    expect(getToolIconKey("inspectWorkspace")).toBe("folder");
    expect(getToolIconKey("createWorkspace")).toBe("folder");
    expect(getToolIconKey("updateWorkspace")).toBe("folder");
  });

  it("keeps memory tools cognitively themed", () => {
    expect(getToolIconKey("searchWorkspaceMemories")).toBe("brain");
    expect(getToolIconKey("rememberWorkspaceMemory")).toBe("cognition");
  });

  it("renders research and proposal tools as prospect profiles", () => {
    expect(getToolIconKey("researchProspect")).toBe("framePerson");
    expect(getToolIconKey("proposeWorkspaceProfiles")).toBe("framePerson");
  });

  it("resolves social context icons from the requested platform", () => {
    expect(getToolIconKey("getSocialContext", { platform: "twitter" })).toBe(
      "twitter"
    );
    expect(getToolIconKey("getSocialContext", { platform: "linkedin" })).toBe(
      "linkedin"
    );
    expect(getToolIconKey("getSocialContext", { platform: "auto" })).toBe(
      "change"
    );
    expect(getToolIconKey("getSocialContext")).toBe("change");
  });

  it("keeps prospect enrichment on the activity search icon", () => {
    expect(getToolIconKey("enrichProspect")).toBe("searchActivity");
  });

  it("separates search preparation from the primary search", () => {
    expect(getToolIconKey("searchProspects")).toBe("search");
    expect(getToolIconKey("generateSeedKeywords")).toBe("search");
    expect(getToolIconKey("convertToSocialQueries")).toBe("swap");
  });

  it("distinguishes plan authoring from plan reading", () => {
    expect(getToolIconKey("generatePlan")).toBe("draft");
    expect(getToolIconKey("refinePlan")).toBe("edit");
    expect(getToolIconKey("getProspectPlan")).toBe("document");
    expect(getToolIconKey("listProspectPlans")).toBe("document");
    expect(getToolIconKey("managePlanBatch")).toBe("document");
  });

  it("renders audience definition as a group", () => {
    expect(getToolIconKey("generateImprovedDescriptionAndICPs")).toBe("group");
  });
});
