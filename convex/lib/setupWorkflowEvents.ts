import { v } from "convex/values";
import {
  planTierValidator,
  setupSessionPreferenceValidator,
  workspaceUseCaseKeyValidator,
} from "../validators";

export type SetupWorkflowEventKind =
  | "useCaseSelected"
  | "inputSubmitted"
  | "generationApproved"
  | "generationFeedbackSubmitted"
  | "connectionsCompleted"
  | "planSelected"
  | "preferencesSelected"
  | "finalConfirmation"
  | "discardRequested"
  | "stateChanged";

const SETUP_EVENT_PREFIX = "setup-session";

export function getSetupWorkflowEventName(
  sessionId: string,
  eventKind: SetupWorkflowEventKind
): string {
  return `${SETUP_EVENT_PREFIX}:${sessionId}:${eventKind}`;
}

export const setupUseCaseSelectedEventValidator = v.object({
  useCaseKey: workspaceUseCaseKeyValidator,
});

export const setupInputSubmittedEventValidator = v.object({
  inputMode: v.union(v.literal("url"), v.literal("manual")),
  inputValue: v.string(),
  sourceUrl: v.optional(v.string()),
});

export const setupGenerationFeedbackSubmittedEventValidator = v.object({
  feedback: v.string(),
});

export const setupConnectionsCompletedEventValidator = v.object({
  connectedX: v.boolean(),
});

export const setupPlanSelectedEventValidator = v.object({
  planChoice: planTierValidator,
});

export const setupPreferencesSelectedEventValidator = v.object({
  preferenceChoice: setupSessionPreferenceValidator,
});

export const setupFinalConfirmationEventValidator = v.object({
  workspaceName: v.string(),
});
