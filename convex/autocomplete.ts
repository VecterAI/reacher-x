"use node";

import { generateText } from "ai";
import { v } from "convex/values";
import { action } from "./lib/functionBuilders";
import { internal } from "./_generated/api";
import {
  AUTOCOMPLETE_MODEL,
  AUTOCOMPLETE_PROVIDER_OPTIONS,
  createAIProvider,
  extractJsonPayload,
  extractUsage,
} from "./lib/ai";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { getWorkspaceUseCase } from "../shared/lib/workspaceUseCases";
import {
  clampInlineAutocompleteSuggestion,
  getInlineAutocompletePromptWindow,
  INLINE_AUTOCOMPLETE_MAX_OUTPUT_TOKENS,
  INLINE_AUTOCOMPLETE_MAX_RECENT_MESSAGE_CHARS,
  INLINE_AUTOCOMPLETE_MAX_RECENT_MESSAGES,
  INLINE_AUTOCOMPLETE_NO_SUGGESTION,
  type InlineAutocompleteMessage,
  type InlineAutocompleteResponse,
  normalizeInlineAutocompleteSuggestion,
  shouldRequestInlineAutocomplete,
} from "../shared/lib/autocomplete/inlineAutocomplete";
import { isInlineAutocompleteEnabled } from "./lib/runtimeConfigHelpers";
import { getXPostWeightedLength } from "../shared/lib/twitter/xPostTextLimit";

const MAX_STYLE_PROFILE_CHARS = 500;
const MAX_REPLY_CONTEXT_CHARS = 900;
const MAX_TONE_HINT_CHARS = 120;
const REASONING_OVERRIDE_MAX_OUTPUT_TOKENS = 160;

type WorkspaceSummary = {
  id: string;
  name: string;
  description?: string;
  useCaseKey?: string;
};

type ProspectSummary = {
  displayName?: string;
  title?: string;
  company?: string;
  briefIntro?: string;
  location?: string;
  matchedKeywords?: string[];
};

const recentMessageValidator = v.object({
  role: v.union(
    v.literal("user"),
    v.literal("assistant"),
    v.literal("prospect")
  ),
  author: v.optional(v.string()),
  text: v.string(),
});

/**
 * Extracts a single-line continuation from raw text (or unwraps JSON if a
 * custom `AI_AUTOCOMPLETE_MODEL` override still returns `{"completion":...}`).
 */
function extractAutocompleteCompletion(text: string): string {
  const rawText = text.trim();
  if (!rawText) {
    return "";
  }

  if (rawText.startsWith("{") || rawText.startsWith("```")) {
    try {
      const parsed = JSON.parse(extractJsonPayload(rawText)) as {
        completion?: unknown;
      };
      if (typeof parsed.completion === "string") {
        return parsed.completion;
      }
    } catch {
      // Not valid JSON; treat as plain continuation text.
    }
  }

  const firstLine = rawText.split(/\r?\n/)[0] ?? "";
  return firstLine
    .replace(/^(?:Continuation(?: at <CURSOR>)?|Completion):\s*/i, "")
    .replace(/^<CURSOR>/, "");
}

function buildEmptyInlineAutocompleteResponse(): InlineAutocompleteResponse {
  return {
    suggestion: "",
    latencyMs: 0,
    model: AUTOCOMPLETE_MODEL,
    workspaceId: undefined,
    styleProfileCategory: undefined,
    styleProfileApplied: false,
  };
}

function truncateContext(value: string | null | undefined, maxChars: number) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
}

function buildWorkspaceContext(workspace: WorkspaceSummary | null) {
  if (!workspace) {
    return null;
  }

  const useCase = getWorkspaceUseCase(workspace.useCaseKey);
  const details = [
    `Workspace name: ${workspace.name}`,
    workspace.description
      ? `Workspace description: ${workspace.description}`
      : null,
    `Primary outcome: ${useCase.promptContext.outreachGoal}`,
    `Audience label: ${useCase.profileLabelPlural}`,
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n");

  return {
    useCase,
    details,
  };
}

function buildProspectContext(prospect: ProspectSummary | null) {
  if (!prospect) {
    return null;
  }

  return [
    prospect.displayName ? `Prospect name: ${prospect.displayName}` : null,
    prospect.title ? `Prospect title: ${prospect.title}` : null,
    prospect.company ? `Prospect company: ${prospect.company}` : null,
    prospect.briefIntro ? `Prospect summary: ${prospect.briefIntro}` : null,
    prospect.location ? `Prospect location: ${prospect.location}` : null,
    prospect.matchedKeywords?.length
      ? `Matched keywords: ${prospect.matchedKeywords.join(", ")}`
      : null,
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n");
}

function buildRecentMessagesContext(args: {
  recentMessages?: InlineAutocompleteMessage[];
  surfaceLabel?: string;
  platform?: "twitter" | "linkedin" | "generic";
}) {
  if (!args.recentMessages || args.recentMessages.length === 0) {
    return null;
  }

  const recent = args.recentMessages.slice(
    -INLINE_AUTOCOMPLETE_MAX_RECENT_MESSAGES
  );
  const isAgentChat =
    args.platform === "generic" || args.surfaceLabel === "agent_chat";
  const label = isAgentChat ? "Recent thread messages" : "Recent DM messages";

  const lines = recent
    .map((message) => {
      const speaker =
        message.role === "user"
          ? "Me"
          : message.role === "assistant"
            ? "Agent"
            : (truncateContext(message.author, 48) ?? "Prospect");
      const text = truncateContext(
        message.text,
        INLINE_AUTOCOMPLETE_MAX_RECENT_MESSAGE_CHARS
      );
      return text ? `${speaker}: ${text}` : null;
    })
    .filter((line): line is string => line !== null);

  if (lines.length === 0) {
    return null;
  }

  return `${label}:\n${lines.join("\n")}`;
}

function buildBudgetContext(args: {
  maxLength?: number;
  characterCountMode?: "raw" | "x_post";
  beforeCursor: string;
  afterCursor?: string;
}) {
  if (!args.maxLength || args.maxLength <= 0) {
    return null;
  }

  const currentText = `${args.beforeCursor}${args.afterCursor ?? ""}`;
  const remaining =
    args.characterCountMode === "x_post"
      ? args.maxLength - getXPostWeightedLength(currentText)
      : args.maxLength - currentText.length;

  return `Remaining length budget: ${Math.max(0, remaining)} (${args.characterCountMode ?? "raw"} mode)`;
}

function getAutocompleteMaxOutputTokens(model: string): number {
  // Mandatory-reasoning overrides (for example gpt-oss) need extra output
  // tokens to emit thinking tokens before the final continuation.
  if (model.includes("gpt-oss")) {
    return REASONING_OVERRIDE_MAX_OUTPUT_TOKENS;
  }
  return INLINE_AUTOCOMPLETE_MAX_OUTPUT_TOKENS;
}

export const getInlineSuggestion = action({
  args: {
    enabled: v.optional(v.boolean()),
    surface: v.optional(
      v.union(v.literal("composer"), v.literal("prompt_input"))
    ),
    surfaceLabel: v.optional(v.string()),
    platform: v.optional(
      v.union(v.literal("twitter"), v.literal("linkedin"), v.literal("generic"))
    ),
    workspaceId: v.optional(v.string()),
    prospectId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    maxLength: v.optional(v.number()),
    characterCountMode: v.optional(
      v.union(v.literal("raw"), v.literal("x_post"))
    ),
    replyToText: v.optional(v.string()),
    replyToAuthorHandle: v.optional(v.string()),
    recentMessages: v.optional(v.array(recentMessageValidator)),
    useCaseKey: v.optional(v.string()),
    toneHint: v.optional(v.string()),
    beforeCursor: v.string(),
    afterCursor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<InlineAutocompleteResponse> => {
    if (!isInlineAutocompleteEnabled()) {
      return buildEmptyInlineAutocompleteResponse();
    }

    if (!shouldRequestInlineAutocomplete(args)) {
      return buildEmptyInlineAutocompleteResponse();
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const startedAt = getCurrentUTCTimestamp();

    // Single consolidated Convex query for auth, stream guard, workspace,
    // prospect, and social style memory.
    const resolvedContext = await ctx.runQuery(
      internal.autocompleteControl.resolveAutocompleteContextInternal,
      {
        workosUserId: identity.subject,
        workspaceId: args.workspaceId,
        prospectId: args.prospectId,
        threadId: args.threadId,
        platform: args.platform,
      }
    );

    if (resolvedContext.blockedByActiveStream) {
      return buildEmptyInlineAutocompleteResponse();
    }

    const { workspace, prospect, styleProfile } = resolvedContext;
    const provider = createAIProvider();
    const promptWindow = getInlineAutocompletePromptWindow({
      beforeCursor: args.beforeCursor,
      afterCursor: args.afterCursor,
    });
    const workspaceContext = buildWorkspaceContext(workspace);
    const prospectContext = buildProspectContext(prospect);
    const recentMessagesContext = buildRecentMessagesContext({
      recentMessages: args.recentMessages,
      surfaceLabel: args.surfaceLabel,
      platform: args.platform,
    });
    const budgetContext = buildBudgetContext(args);
    const replyTargetText = truncateContext(
      args.replyToText,
      MAX_REPLY_CONTEXT_CHARS
    );
    const toneHint = truncateContext(args.toneHint, MAX_TONE_HINT_CHARS);

    const systemPrompt = `You are an ultra-fast inline ghost-text autocomplete engine inside ReacherX.
Output ONLY the exact continuation text to insert at <CURSOR>, with no quotes, no JSON, no markdown, and no explanation.

Rules:
- Use the conversation history, post being replied to, and prospect context to predict the exact continuation the user intends to type next.
- Continue seamlessly from the text before <CURSOR> and fit naturally before the text after <CURSOR>.
- Never repeat words already right before <CURSOR> or right after <CURSOR>.
- Output a single line, completing the current phrase or clause naturally (typically 4 to 14 words, stopping at a clean word or sentence boundary).
- Respect any remaining character budget strictly.
- Match the user's voice on social posts and DMs; stay direct and clear in agent chat instructions.
- Avoid robotic filler, corporate buzzwords, or sycophancy.
- If the text before <CURSOR> is already a complete finished message or no continuation is helpful, output ONLY: ${INLINE_AUTOCOMPLETE_NO_SUGGESTION}`;

    // Keep the stable context prefix first so repeated keystrokes in the same
    // thread, DM, or reply hit provider prompt caching.
    const stablePrefix = [
      `Surface: ${args.surfaceLabel ?? args.surface ?? "composer"} (${args.platform ?? "generic"})`,
      workspaceContext ? `Workspace:\n${workspaceContext.details}` : null,
      prospectContext ? `Prospect:\n${prospectContext}` : null,
      args.replyToAuthorHandle
        ? `Replying to: ${args.replyToAuthorHandle}`
        : null,
      replyTargetText ? `Post being replied to:\n${replyTargetText}` : null,
      recentMessagesContext,
      toneHint ? `Tone hint: ${toneHint}` : null,
      styleProfile
        ? `User writing voice:\n${truncateContext(styleProfile.narrative, MAX_STYLE_PROFILE_CHARS)}`
        : null,
    ]
      .filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0
      )
      .join("\n\n");

    const dynamicSuffix = [
      budgetContext,
      `Draft:\n${promptWindow.beforeCursor}<CURSOR>${promptWindow.afterCursor}`,
      "Continuation at <CURSOR>:",
    ]
      .filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0
      )
      .join("\n\n");

    const result = await generateText({
      model: provider(AUTOCOMPLETE_MODEL),
      system: systemPrompt,
      prompt: `${stablePrefix}\n\n${dynamicSuffix}`,
      temperature: 0.15,
      maxOutputTokens: getAutocompleteMaxOutputTokens(AUTOCOMPLETE_MODEL),
      stopSequences: ["\n"],
      providerOptions: AUTOCOMPLETE_PROVIDER_OPTIONS,
    });

    const completionText = extractAutocompleteCompletion(result.text);

    const normalizedSuggestion = normalizeInlineAutocompleteSuggestion({
      suggestion: completionText,
      beforeCursor: args.beforeCursor,
      afterCursor: args.afterCursor,
    });
    const suggestion = clampInlineAutocompleteSuggestion({
      suggestion: normalizedSuggestion,
      beforeCursor: args.beforeCursor,
      afterCursor: args.afterCursor,
      maxLength: args.maxLength,
      characterCountMode: args.characterCountMode,
    });
    const usage = extractUsage(result);
    const latencyMs = getCurrentUTCTimestamp() - startedAt;
    const model = usage.modelSelected ?? AUTOCOMPLETE_MODEL;

    return {
      suggestion,
      latencyMs,
      model,
      workspaceId: workspace?.id,
      styleProfileCategory: styleProfile?.category,
      styleProfileApplied: Boolean(styleProfile),
    };
  },
});
