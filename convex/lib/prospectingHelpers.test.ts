import { describe, expect, it } from "vitest";
import { buildDiscoveryBusinessContext } from "./prospectingHelpers";

describe("discovery business context", () => {
  it("supplies the original audience request as the source of truth", () => {
    const context = buildDiscoveryBusinessContext({
      description: "Find hiring decision-makers who need recruiting software.",
      improvedDescription:
        "Find hiring decision-makers who need recruiting software.",
      rawUserDescription:
        "I want to reach hiring managers who could buy our recruiting product.",
    });

    expect(context).toContain("Original audience request (source of truth)");
    expect(context).toContain("hiring managers who could buy");
    expect(context).toContain("Current workspace description");
  });

  it("does not duplicate identical descriptions", () => {
    expect(
      buildDiscoveryBusinessContext({
        description: "Find doctors providing free consultations.",
        improvedDescription: "Find doctors providing free consultations.",
        rawUserDescription: "Find doctors providing free consultations.",
      })
    ).toBe("Find doctors providing free consultations.");
  });
});
