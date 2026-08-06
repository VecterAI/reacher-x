import { describe, expect, it } from "vitest";
import {
  deliverStoredLandingPromptHandoff,
  LANDING_PROMPT_STORAGE_KEY,
  parseLandingPromptHandoff,
  readStoredLandingPromptHandoff,
  serializeLandingPromptHandoff,
} from "./landingPromptStorage";

describe("landing prompt handoff storage", () => {
  it("preserves the exact multiline prompt and its source URL", () => {
    const prompt =
      "  Find React and Next.js developers.\n\nThey should love open source.  ";
    const serialized = serializeLandingPromptHandoff({
      prompt,
      sourceUrl: " https://example.com/product ",
      requiresNewWorkspaceDecision: true,
    });

    expect(parseLandingPromptHandoff(serialized)).toEqual({
      prompt,
      sourceUrl: "https://example.com/product",
      requiresNewWorkspaceDecision: true,
    });
  });

  it("reads pre-structured legacy prompt values", () => {
    expect(parseLandingPromptHandoff("  Find climate founders  ")).toEqual({
      prompt: "  Find climate founders  ",
      sourceUrl: null,
    });
  });

  it("rejects empty or malformed structured handoffs", () => {
    expect(parseLandingPromptHandoff("   ")).toBeNull();
    expect(parseLandingPromptHandoff('{"prompt":""}')).toBeNull();
  });

  it("can prepare the stored prompt without consuming it", () => {
    const serialized = serializeLandingPromptHandoff({
      prompt: "Find open-source contributors",
      sourceUrl: null,
    });
    const storage = {
      getItem: () => serialized,
    };

    expect(readStoredLandingPromptHandoff(storage)).toEqual({
      prompt: "Find open-source contributors",
      sourceUrl: null,
    });
    expect(storage.getItem()).toBe(serialized);
  });

  it("round-trips an already durable turn for presentation without resubmission", () => {
    const serialized = serializeLandingPromptHandoff({
      prompt: "Find TypeScript maintainers",
      sourceUrl: null,
      submittedTurn: {
        threadId: "thread_saved",
        messageId: "message_saved",
        order: 4,
      },
    });

    expect(parseLandingPromptHandoff(serialized)).toEqual({
      prompt: "Find TypeScript maintainers",
      sourceUrl: null,
      submittedTurn: {
        threadId: "thread_saved",
        messageId: "message_saved",
        order: 4,
      },
    });
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
