import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { robustGenerateObject } from "./ai";
import { syntheticProfileExamplesSchema } from "../agents/tools/schemas";
import { syntheticExamples } from "../../test/syntheticProfiles";

const { generateTextMock } = vi.hoisted(() => ({ generateTextMock: vi.fn() }));
vi.mock("ai", async (original) => ({
  ...(await original<typeof import("ai")>()),
  generateText: generateTextMock,
}));
vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: () => () => ({ specificationVersion: "v3" }),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

const valid = syntheticExamples;
test.each([
  [valid[0], valid[0]],
  [{ ...valid[0], bio: "x".repeat(161) }, valid[1]],
  [{ ...valid[0], displayName: "   " }, valid[1]],
])(
  "invalid synthetic examples retry before leaving structured generation",
  async (first, second) => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    generateTextMock
      .mockResolvedValueOnce({
        text: JSON.stringify({ examples: [first, second] }),
        usage: {},
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({ examples: valid }),
        usage: {},
      });
    const result = await robustGenerateObject({
      operation: "synthetic-validation-regression",
      schema: z.object({ examples: syntheticProfileExamplesSchema }),
      system: "Generate examples",
      prompt: "Find founders",
      routing: "onboarding",
      maxRetries: 2,
      initialDelayMs: 0,
    });
    expect(result.object.examples).toEqual(valid);
    expect(generateTextMock).toHaveBeenCalledTimes(2);
  }
);
