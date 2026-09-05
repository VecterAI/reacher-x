import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { generateTextWithJsonParse } from "./ai";

const { generateTextMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: generateTextMock,
}));

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: () => () => ({ specificationVersion: "v3" }),
}));

describe("onboarding generation timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.spyOn(AbortSignal, "timeout").mockImplementation((delay) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new Error("request timed out")), delay);
      return controller.signal;
    });
    generateTextMock.mockImplementation(
      ({ abortSignal }: { abortSignal: AbortSignal }) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => resolve({ text: '{"audience":"creators"}', usage: {} }),
            60_000
          );
          abortSignal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(abortSignal.reason);
            },
            { once: true }
          );
        })
    );
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    generateTextMock.mockReset();
  });

  const generate = (routing: "onboarding" | "reasoning") =>
    generateTextWithJsonParse({
      operation: "regenerateWorkspaceTargeting",
      schema: z.object({ audience: z.string() }),
      system: "Return the requested audience.",
      prompt: "Find creators.",
      routing,
      maxRetries: 1,
    });

  it("accepts a valid targeting response that takes longer than 45 seconds", async () => {
    const result = generate("onboarding");
    const assertion = expect(result).resolves.toMatchObject({
      object: { audience: "creators" },
    });
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it("keeps qualification requests on their existing shorter timeout", async () => {
    const assertion = expect(generate("reasoning")).rejects.toThrow(
      "request timed out"
    );
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
  });

  it("still aborts an onboarding provider that never returns", async () => {
    generateTextMock.mockImplementation(
      ({ abortSignal }: { abortSignal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          abortSignal.addEventListener(
            "abort",
            () => reject(abortSignal.reason),
            {
              once: true,
            }
          );
        })
    );
    const assertion = expect(generate("onboarding")).rejects.toThrow(
      "request timed out"
    );
    await vi.advanceTimersByTimeAsync(120_000);
    await assertion;
  });
});
