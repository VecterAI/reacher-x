import { describe, expect, it } from "vitest";
import {
  deliverStoredLandingPromptHandoff,
  LANDING_PROMPT_STORAGE_KEY,
  parseLandingPromptHandoff,
  serializeLandingPromptHandoff,
} from "./landingPromptStorage";

describe("landing prompt handoff storage", () => {
  it("preserves extracted prompt text and its source URL", () => {
    const serialized = serializeLandingPromptHandoff({
      prompt: "  Find technical founders building AI developer tools.  ",
      sourceUrl: " https://example.com/product ",
    });

    expect(parseLandingPromptHandoff(serialized)).toEqual({
      prompt: "Find technical founders building AI developer tools.",
      sourceUrl: "https://example.com/product",
    });
  });

  it("reads pre-structured legacy prompt values", () => {
    expect(parseLandingPromptHandoff("  Find climate founders  ")).toEqual({
      prompt: "Find climate founders",
      sourceUrl: null,
    });
  });

  it("rejects empty or malformed structured handoffs", () => {
    expect(parseLandingPromptHandoff("   ")).toBeNull();
    expect(parseLandingPromptHandoff('{"prompt":""}')).toBeNull();
  });

  it("removes a handoff only after successful delivery", async () => {
    const values = new Map([
      [
        LANDING_PROMPT_STORAGE_KEY,
        serializeLandingPromptHandoff({
          prompt: "Find AI founders",
          sourceUrl: null,
        }),
      ],
    ]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => {
        values.delete(key);
      },
    };

    await deliverStoredLandingPromptHandoff(storage, async (handoff) => {
      expect(values.has(LANDING_PROMPT_STORAGE_KEY)).toBe(true);
      expect(handoff.prompt).toBe("Find AI founders");
    });

    expect(values.has(LANDING_PROMPT_STORAGE_KEY)).toBe(false);
  });

  it("preserves a handoff when delivery fails", async () => {
    const serialized = serializeLandingPromptHandoff({
      prompt: "Find climate founders",
      sourceUrl: null,
    });
    const values = new Map([[LANDING_PROMPT_STORAGE_KEY, serialized]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => {
        values.delete(key);
      },
    };

    await expect(
      deliverStoredLandingPromptHandoff(storage, async () => {
        throw new Error("temporary failure");
      })
    ).rejects.toThrow("temporary failure");
    expect(values.get(LANDING_PROMPT_STORAGE_KEY)).toBe(serialized);
  });
});
