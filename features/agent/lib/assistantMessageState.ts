import type { UIMessage } from "@convex-dev/agent/react";
import {
  extractAssistantReasoning,
  extractAssistantSources,
} from "./messageMetadata";
import { getUIMessageDisplayText } from "./uiMessageText";
import { isToolPart } from "./toolParts";

type AssistantMessageLike = {
  role?: string;
  status?: string;
  text?: string | null;
  parts?: Array<{ type?: string; [key: string]: unknown }> | null;
  reasoning?: string | null;
  reasoningDetails?: unknown;
  sources?: unknown;
};

/**
 * A streamed assistant message can exist before it has any renderable content.
 * Treat those transport-only shells as placeholders so the UI can keep showing
 * a single stable pending row instead of two competing loading states.
 */
export function isAssistantPlaceholderMessage(
  message: AssistantMessageLike,
  options?: { showReasoning?: boolean }
): boolean {
  if (message.role !== "assistant") {
    return false;
  }

  if (message.status !== "pending" && message.status !== "streaming") {
    return false;
  }

  if (getUIMessageDisplayText(message).trim().length > 0) {
    return false;
  }

  if ((message.parts ?? []).some(isToolPart)) {
    return false;
  }

  const showReasoning = options?.showReasoning ?? true;
  if (
    showReasoning &&
    Boolean(extractAssistantReasoning(message as UIMessage))
  ) {
    return false;
  }

  return extractAssistantSources(message as UIMessage).length === 0;
}
