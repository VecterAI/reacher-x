import type { ModelMessage } from "ai";
import { isRecord } from "./typeGuards";

export const OUTREACH_RECENT_MESSAGE_LIMIT = 8;
export const OUTREACH_HISTORY_SEARCH_LIMIT = 4;
export const OUTREACH_MIN_MESSAGES_FOR_HISTORY_SEARCH = 8;

const MAX_OUTREACH_SESSION_ID_CHARACTERS = 240;
const OPENROUTER_REASONING_METADATA_KEYS = new Set([
  "encrypted_content",
  "encryptedContent",
  "reasoning_details",
  "reasoningDetails",
]);

function stripOpenRouterReasoningMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripOpenRouterReasoningMetadata);
  }
  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !OPENROUTER_REASONING_METADATA_KEYS.has(key))
      .map(([key, entryValue]) => [
        key,
        stripOpenRouterReasoningMetadata(entryValue),
      ])
  );
}

function stripCompletedTurnReasoning(message: ModelMessage): ModelMessage {
  const providerOptions = message.providerOptions
    ? (stripOpenRouterReasoningMetadata(
        message.providerOptions
      ) as ModelMessage["providerOptions"])
    : undefined;

  if (typeof message.content === "string") {
    return {
      ...message,
      ...(providerOptions ? { providerOptions } : {}),
    };
  }

  const content = (message.content as unknown[]).flatMap((part) => {
    if (
      isRecord(part) &&
      (part.type === "reasoning" || part.type === "redacted-reasoning")
    ) {
      return [];
    }

    if (!isRecord(part) || !part.providerOptions) {
      return [part];
    }

    return [
      {
        ...part,
        providerOptions: stripOpenRouterReasoningMetadata(part.providerOptions),
      },
    ];
  });

  return {
    ...message,
    content,
    ...(providerOptions ? { providerOptions } : {}),
  } as ModelMessage;
}

/**
 * Builds the context for a new outreach generation. Completed prior turns are
 * reduced to portable text/tool history because OpenRouter's encrypted
 * reasoning is bound to the model/provider that created it. Responses on the
 * current prompt order stay byte-for-byte intact so an active tool call can
 * continue with the reasoning sequence required by the provider.
 */
export function buildSafeOutreachContext(args: {
  search: ModelMessage[];
  recent: ModelMessage[];
  inputMessages: ModelMessage[];
  inputPrompt: ModelMessage[];
  existingResponses: ModelMessage[];
}): ModelMessage[] {
  return [
    ...args.search.map(stripCompletedTurnReasoning),
    ...args.recent.map(stripCompletedTurnReasoning),
    ...args.inputMessages,
    ...args.inputPrompt,
    ...args.existingResponses,
  ];
}

export function buildOutreachModelSessionId(threadId: string): string {
  const normalizedThreadId = threadId.replace(/\s+/g, " ").trim();
  return `reacherx:prospect:${normalizedThreadId}`.slice(
    0,
    MAX_OUTREACH_SESSION_ID_CHARACTERS
  );
}
