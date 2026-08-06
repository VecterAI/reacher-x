import type { LandingPromptHandoff } from "../../landing/lib/landingPromptStorage";
import { getUrlFromWholeValue } from "../../../shared/lib/urls/urlParsing";

export interface LandingSetupHandoffRequest {
  threadId: string;
  prompt: string;
  setupSourceUrl?: string;
  expectedSurface: "setup";
}

type SetupSessionMode = "first_workspace" | "new_workspace";

type StartSetupSession = (args: { mode: SetupSessionMode }) => Promise<{
  threadId: string;
}>;

type SubmitSetupMessage = (
  args: LandingSetupHandoffRequest
) => Promise<{ messageId: string; order: number }>;

export async function submitLandingSetupHandoffToThread({
  threadId,
  handoff,
  submitSetupMessage,
}: {
  threadId: string;
  handoff: LandingPromptHandoff;
  submitSetupMessage: SubmitSetupMessage;
}): Promise<LandingPromptHandoff> {
  const submittedMessage = await submitSetupMessage(
    buildLandingSetupHandoffRequest(threadId, handoff)
  );

  return {
    prompt: handoff.prompt,
    sourceUrl: handoff.sourceUrl,
    submittedTurn: {
      threadId,
      messageId: submittedMessage.messageId,
      order: submittedMessage.order,
    },
  };
}

/**
 * Build the guarded setup mutation input for the `/home` prompt handoff.
 * Keeping this path explicit prevents it from silently becoming a generic
 * agent message, which would skip setup-session input capture.
 */
export function buildLandingSetupHandoffRequest(
  threadId: string,
  handoff: LandingPromptHandoff
): LandingSetupHandoffRequest {
  const setupSourceUrl =
    handoff.sourceUrl ?? getUrlFromWholeValue(handoff.prompt);

  return {
    threadId,
    prompt: handoff.prompt,
    ...(setupSourceUrl ? { setupSourceUrl } : {}),
    expectedSurface: "setup",
  };
}

/**
 * Authenticated `/home` submissions become durable setup turns before the
 * document navigation begins. This prevents the destination page from racing
 * sessionStorage against setup bootstrap and agent execution.
 */
export async function submitAuthenticatedLandingSetupHandoff({
  handoff,
  mode,
  startSetupSession,
  submitSetupMessage,
}: {
  handoff: LandingPromptHandoff;
  mode: SetupSessionMode;
  startSetupSession: StartSetupSession;
  submitSetupMessage: SubmitSetupMessage;
}): Promise<{ threadId: string; handoff: LandingPromptHandoff }> {
  const setupSession = await startSetupSession({ mode });
  const submittedHandoff = await submitLandingSetupHandoffToThread({
    threadId: setupSession.threadId,
    handoff,
    submitSetupMessage,
  });

  return {
    threadId: setupSession.threadId,
    handoff: submittedHandoff,
  };
}
