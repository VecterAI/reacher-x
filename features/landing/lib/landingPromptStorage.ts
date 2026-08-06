/** One-shot sessionStorage key for `/home` → `/agent/setup` prompt handoff. */
export const LANDING_PROMPT_STORAGE_KEY = "reacherx:landing-prompt";

export type LandingPromptSubmittedTurn = {
  threadId: string;
  messageId: string;
  order: number;
};

export type LandingPromptHandoff = {
  prompt: string;
  sourceUrl: string | null;
  /**
   * Landing submissions represent a request to start a workspace. When this is
   * set, setup must resolve an existing draft before presenting or delivering
   * the prompt.
   */
  requiresNewWorkspaceDecision?: boolean;
  /**
   * Present when an authenticated landing submission was saved before
   * navigation. The setup page uses it for immediate presentation only and
   * must not submit the prompt a second time.
   */
  submittedTurn?: LandingPromptSubmittedTurn;
};

type LandingPromptStorageReader = Pick<Storage, "getItem">;
type LandingPromptSessionStorage = Pick<Storage, "getItem" | "removeItem">;

export function serializeLandingPromptHandoff(
  handoff: LandingPromptHandoff
): string {
  return JSON.stringify({
    prompt: handoff.prompt,
    sourceUrl: handoff.sourceUrl?.trim() || null,
    ...(handoff.requiresNewWorkspaceDecision
      ? { requiresNewWorkspaceDecision: true }
      : {}),
    ...(handoff.submittedTurn
      ? {
          submittedTurn: {
            threadId: handoff.submittedTurn.threadId,
            messageId: handoff.submittedTurn.messageId,
            order: handoff.submittedTurn.order,
          },
        }
      : {}),
  });
}

function parseSubmittedTurn(value: unknown): LandingPromptSubmittedTurn | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("threadId" in value) ||
    typeof value.threadId !== "string" ||
    !("messageId" in value) ||
    typeof value.messageId !== "string" ||
    !("order" in value) ||
    typeof value.order !== "number"
  ) {
    return null;
  }

  const threadId = value.threadId.trim();
  const messageId = value.messageId.trim();
  if (!threadId || !messageId || !Number.isFinite(value.order)) {
    return null;
  }

  return { threadId, messageId, order: value.order };
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
      const prompt = parsed.prompt;
      if (!prompt.trim()) return null;
      const submittedTurn =
        "submittedTurn" in parsed
          ? parseSubmittedTurn(parsed.submittedTurn)
          : null;
      return {
        prompt,
        sourceUrl:
          "sourceUrl" in parsed && typeof parsed.sourceUrl === "string"
            ? parsed.sourceUrl.trim() || null
            : null,
        ...("requiresNewWorkspaceDecision" in parsed &&
        parsed.requiresNewWorkspaceDecision === true
          ? { requiresNewWorkspaceDecision: true }
          : {}),
        ...(submittedTurn ? { submittedTurn } : {}),
      };
    }
  } catch {
    // Backward compatibility for handoffs saved before the structured payload.
  }

  return { prompt: storedValue, sourceUrl: null };
}

type LandingPromptStorageWriter = Pick<Storage, "setItem">;
type LandingPromptStorageRemover = Pick<Storage, "removeItem">;

/** Store a handoff without weakening its exact prompt or decision metadata. */
export function writeStoredLandingPromptHandoff(
  storage: LandingPromptStorageWriter,
  handoff: LandingPromptHandoff
): boolean {
  if (!handoff.prompt.trim()) {
    return false;
  }

  try {
    storage.setItem(
      LANDING_PROMPT_STORAGE_KEY,
      serializeLandingPromptHandoff(handoff)
    );
    return true;
  } catch {
    return false;
  }
}

/** Clear a cancelled or superseded handoff so it can never auto-fire later. */
export function clearStoredLandingPromptHandoff(
  storage: LandingPromptStorageRemover
): void {
  try {
    storage.removeItem(LANDING_PROMPT_STORAGE_KEY);
  } catch {
    // Cleanup is best-effort when browser storage is unavailable.
  }
}

/** Read the one-shot handoff without consuming it. */
export function readStoredLandingPromptHandoff(
  storage: LandingPromptStorageReader
): LandingPromptHandoff | null {
  try {
    const storedValue = storage.getItem(LANDING_PROMPT_STORAGE_KEY);
    return storedValue ? parseLandingPromptHandoff(storedValue) : null;
  } catch {
    return null;
  }
}

/**
 * Delivers a stored prompt before removing it, so a transient submit failure
 * leaves the one-shot handoff available for reload/retry instead of losing it.
 */
export async function deliverStoredLandingPromptHandoff(
  storage: LandingPromptSessionStorage,
  deliver: (handoff: LandingPromptHandoff) => Promise<void>
): Promise<"delivered" | "missing"> {
  const handoff = readStoredLandingPromptHandoff(storage);
  if (!handoff) {
    return "missing";
  }

  await deliver(handoff);
  clearStoredLandingPromptHandoff(storage);
  return "delivered";
}
