import type { ModelMessage } from "ai";
import {
  getLatestPlanBatchUserPrompt,
  getRecentPlanBatchUserPrompts,
} from "./planBatchCore";

const REFERENTIAL_MEMORY_REQUEST_PATTERN =
  /\b(?:remember|save|use)\s+(?:that|it)\b|\b(?:above|previous|earlier)\b|\bthe\s+(?:link|url|video|resource)\s+i\s+shared\b/i;
const URL_PATTERN = /https?:\/\/\S+/i;

export function resolveWorkspaceMemoryInstruction(args: {
  messages: ModelMessage[];
  sourceExcerpt?: string;
  fallback: string;
}): string {
  const latestPrompt = getLatestPlanBatchUserPrompt(args.messages);
  const excerpt = args.sourceExcerpt?.trim();
  if (excerpt) {
    const recentPrompts = getRecentPlanBatchUserPrompts(args.messages, 20);
    if (!recentPrompts.some((prompt) => prompt.includes(excerpt))) {
      throw new Error(
        "Memory source excerpt must be copied verbatim from a recent user message."
      );
    }
    return latestPrompt && latestPrompt !== excerpt
      ? `${excerpt}\n\n${latestPrompt}`
      : excerpt;
  }

  if (
    latestPrompt &&
    !URL_PATTERN.test(latestPrompt) &&
    REFERENTIAL_MEMORY_REQUEST_PATTERN.test(latestPrompt) &&
    getRecentPlanBatchUserPrompts(args.messages, 2).length > 1
  ) {
    throw new Error(
      "This memory request refers to an earlier message. Copy the exact relevant user text into sourceExcerpt."
    );
  }

  return latestPrompt ?? args.fallback.trim();
}
