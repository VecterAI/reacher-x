/** One-shot sessionStorage key for `/home` → `/agent/setup` prompt handoff. */
export const LANDING_PROMPT_STORAGE_KEY = "reacherx:landing-prompt";

export type LandingPromptHandoff = {
  prompt: string;
  sourceUrl: string | null;
};

type LandingPromptSessionStorage = Pick<Storage, "getItem" | "removeItem">;

export function serializeLandingPromptHandoff(
  handoff: LandingPromptHandoff
): string {
  return JSON.stringify({
    prompt: handoff.prompt.trim(),
    sourceUrl: handoff.sourceUrl?.trim() || null,
  });
}

export function parseLandingPromptHandoff(
  storedValue: string
): LandingPromptHandoff | null {
  const trimmed = storedValue.trim();
  if (!trimmed) return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "prompt" in parsed &&
      typeof parsed.prompt === "string"
    ) {
      const prompt = parsed.prompt.trim();
      if (!prompt) return null;
      return {
        prompt,
        sourceUrl:
          "sourceUrl" in parsed && typeof parsed.sourceUrl === "string"
            ? parsed.sourceUrl.trim() || null
            : null,
      };
    }
  } catch {
    // Backward compatibility for handoffs saved before the structured payload.
  }

  return { prompt: trimmed, sourceUrl: null };
}

/**
 * Delivers a stored prompt before removing it, so a transient submit failure
 * leaves the one-shot handoff available for reload/retry instead of losing it.
 */
export async function deliverStoredLandingPromptHandoff(
  storage: LandingPromptSessionStorage,
  deliver: (handoff: LandingPromptHandoff) => Promise<void>
): Promise<"delivered" | "missing"> {
  let storedValue: string | null;
  try {
    storedValue = storage.getItem(LANDING_PROMPT_STORAGE_KEY);
  } catch {
    return "missing";
  }

  const handoff = storedValue ? parseLandingPromptHandoff(storedValue) : null;
  if (!handoff) {
    return "missing";
  }

  await deliver(handoff);
  try {
    storage.removeItem(LANDING_PROMPT_STORAGE_KEY);
  } catch {
    // Delivery succeeded; storage cleanup is best-effort.
  }
  return "delivered";
}
