import {
  INLINE_AUTOCOMPLETE_MAX_SUGGESTION_CHARS,
  INLINE_AUTOCOMPLETE_MAX_SUGGESTION_WORDS,
  INLINE_AUTOCOMPLETE_NO_SUGGESTION,
  getInlineAutocompletePromptWindow,
  normalizeInlineAutocompleteSuggestion,
} from "../../shared/lib/autocomplete/inlineAutocomplete";
import { getXPostWeightedLength } from "../../shared/lib/twitter/xPostTextLimit";
import type { AutocompleteCase, ConversationTurn, PromptMode } from "./types";

const MAX_LEGACY_REPLY_CHARS = 320;
const MAX_IMPROVED_REPLY_CHARS = 900;
const MAX_HISTORY_TURNS = 6;
const MAX_TURN_CHARS = 280;
const MAX_STYLE_PROFILE_CHARS = 500;

export type BuiltAutocompletePrompt = Readonly<{
  system: string;
  prompt: string;
}>;

function truncate(value: string | undefined, maxChars: number): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
}

function buildWorkspaceBlock(testCase: AutocompleteCase): string {
  return [
    `Workspace name: ${testCase.workspace.name}`,
    `Workspace description: ${testCase.workspace.description}`,
    `Primary outcome: ${testCase.workspace.outreachGoal}`,
    `Audience label: ${testCase.workspace.audienceLabel}`,
  ].join("\n");
}

function buildProspectBlock(testCase: AutocompleteCase): string | null {
  const prospect = testCase.prospect;
  if (!prospect) return null;
  return [
    `Prospect name: ${prospect.displayName}`,
    prospect.title ? `Prospect title: ${prospect.title}` : null,
    prospect.company ? `Prospect company: ${prospect.company}` : null,
    prospect.briefIntro ? `Prospect summary: ${prospect.briefIntro}` : null,
    prospect.location ? `Prospect location: ${prospect.location}` : null,
    prospect.matchedKeywords?.length
      ? `Matched keywords: ${prospect.matchedKeywords.join(", ")}`
      : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function buildBudgetLine(testCase: AutocompleteCase): string | null {
  if (!testCase.maxLength || testCase.maxLength <= 0) return null;
  const currentText = `${testCase.beforeCursor}${testCase.afterCursor ?? ""}`;
  const remaining =
    testCase.characterCountMode === "x_post"
      ? testCase.maxLength - getXPostWeightedLength(currentText)
      : testCase.maxLength - currentText.length;
  return `Remaining length budget: ${Math.max(0, remaining)} (${testCase.characterCountMode ?? "raw"} mode)`;
}

function formatConversationHistory(
  turns: readonly ConversationTurn[] | undefined,
  surface: AutocompleteCase["surface"]
): string | null {
  if (!turns || turns.length === 0) return null;
  const recent = turns.slice(-MAX_HISTORY_TURNS);
  const label =
    surface === "agent_chat" ? "Recent thread messages" : "Recent DM messages";
  const lines = recent
    .map((turn) => {
      const speaker =
        turn.role === "user"
          ? "Me"
          : turn.role === "assistant"
            ? "Agent"
            : (turn.author ?? "Prospect");
      const text = truncate(turn.text, MAX_TURN_CHARS);
      return text ? `${speaker}: ${text}` : null;
    })
    .filter((line): line is string => line !== null);
  if (lines.length === 0) return null;
  return `${label}:\n${lines.join("\n")}`;
}

/**
 * Mirrors today's production prompt in `convex/autocomplete.ts`:
 * no thread/DM history, no LinkedIn reply target, JSON wrapper, 2-3 word cap,
 * and Twitter/LinkedIn style fallback even inside agent chat.
 */
export function buildLegacyPrompt(
  testCase: AutocompleteCase
): BuiltAutocompletePrompt {
  const promptWindow = getInlineAutocompletePromptWindow({
    beforeCursor: testCase.beforeCursor,
    afterCursor: testCase.afterCursor,
  });

  // Today only X replies pass replyToText; LinkedIn comments do not.
  const legacyReplyText =
    testCase.surface === "x_reply"
      ? truncate(testCase.replyToText, MAX_LEGACY_REPLY_CHARS)
      : null;
  const legacyReplyHandle =
    testCase.surface === "x_reply" ? testCase.replyToAuthorHandle : undefined;

  const system = `You generate inline autocomplete continuations for ReacherX.

Return ONLY JSON in this exact shape: {"completion":"text to insert"}.

Rules:
- Continue the user's exact train of thought instead of rewriting it.
- Match the user's voice when style guidance is provided.
- The completion value must be a single-line continuation only.
- Never include line breaks, bullets, labels, or multiple options.
- Keep completions short and tab-accept friendly.
- Prefer 2-3 words only. Never exceed 4 words.
- End on a natural word boundary.
- Do not repeat the provided prefix.
- Do not repeat text that already appears after the cursor.
- Do not add explanations, markdown, or multiple options.
- For chat and prompt inputs, prefer giving a small useful continuation when the text is an ordinary unfinished thought.
- Set completion to ${INLINE_AUTOCOMPLETE_NO_SUGGESTION} only when the cursor context is not a natural-language continuation, the text is already complete, or any completion would be misleading.
- Avoid generic AI phrasing, filler, and corporate language unless the user's style clearly does that.`;

  const prospectBlock = buildProspectBlock(testCase);
  const budgetLine = buildBudgetLine(testCase);

  const prompt = [
    `Surface: ${testCase.surfaceLabel}`,
    `Platform: ${testCase.platform}`,
    budgetLine,
    `Workspace context:\n${buildWorkspaceBlock(testCase)}`,
    prospectBlock ? `Prospect context:\n${prospectBlock}` : null,
    legacyReplyHandle ? `Reply target handle: @${legacyReplyHandle}` : null,
    legacyReplyText ? `Reply target text:\n${legacyReplyText}` : null,
    testCase.styleProfile
      ? `User writing voice:\n${truncate(testCase.styleProfile, MAX_STYLE_PROFILE_CHARS)}`
      : "No trusted style profile is available. Stay concise and neutral.",
    `Text before cursor:\n"""${promptWindow.beforeCursor}"""`,
    promptWindow.afterCursor
      ? `Text after cursor:\n"""${promptWindow.afterCursor}"""`
      : "Text after cursor: <empty>",
    `Generate the single most likely continuation as JSON. Keep completion to 2-3 words. For ordinary unfinished chat text, return a continuation rather than ${INLINE_AUTOCOMPLETE_NO_SUGGESTION}.`,
  ]
    .filter((block): block is string => block !== null && block.length > 0)
    .join("\n\n");

  return { system, prompt };
}

/**
 * Context-aware, cache-friendly, raw-text continuation prompt:
 * 1. Stable prefix first (system -> workspace -> prospect -> history/post -> voice)
 *    so repeated keystrokes in the same thread or DM hit provider prompt cache.
 * 2. Dynamic caret window (`beforeCursor`, `afterCursor`) at the very end.
 * 3. Plain continuation text only (no JSON wrapper tokens wasted).
 * 4. Skips social writing-style profile in agent chat.
 */
export function buildContextAwarePrompt(
  testCase: AutocompleteCase
): BuiltAutocompletePrompt {
  const promptWindow = getInlineAutocompletePromptWindow({
    beforeCursor: testCase.beforeCursor,
    afterCursor: testCase.afterCursor,
  });

  const system = `You are an ultra-fast inline ghost-text autocomplete engine inside ReacherX.
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

  const prospectBlock = buildProspectBlock(testCase);
  const historyBlock = formatConversationHistory(
    testCase.conversationHistory,
    testCase.surface
  );
  const replyText = truncate(testCase.replyToText, MAX_IMPROVED_REPLY_CHARS);
  const applyVoice =
    testCase.surface !== "agent_chat" && Boolean(testCase.styleProfile);

  // Keep the stable context prefix identical across keystrokes for cache hits.
  const stablePrefix = [
    `Surface: ${testCase.surfaceLabel} (${testCase.platform})`,
    `Workspace:\n${buildWorkspaceBlock(testCase)}`,
    prospectBlock ? `Prospect:\n${prospectBlock}` : null,
    testCase.replyToAuthorHandle
      ? `Replying to: ${testCase.replyToAuthorHandle}`
      : null,
    replyText ? `Post being replied to:\n${replyText}` : null,
    historyBlock,
    applyVoice
      ? `User writing voice:\n${truncate(testCase.styleProfile, MAX_STYLE_PROFILE_CHARS)}`
      : null,
  ]
    .filter((block): block is string => block !== null && block.length > 0)
    .join("\n\n");

  const budgetLine = buildBudgetLine(testCase);
  const dynamicSuffix = [
    budgetLine,
    `Draft:\n${promptWindow.beforeCursor}<CURSOR>${promptWindow.afterCursor}`,
    `Continuation at <CURSOR>:`,
  ]
    .filter((block): block is string => block !== null && block.length > 0)
    .join("\n\n");

  return {
    system,
    prompt: `${stablePrefix}\n\n${dynamicSuffix}`,
  };
}

export function buildPromptForMode(
  testCase: AutocompleteCase,
  mode: PromptMode
): BuiltAutocompletePrompt {
  return mode === "legacy_json_no_history"
    ? buildLegacyPrompt(testCase)
    : buildContextAwarePrompt(testCase);
}

/** Extracts raw completion text from either legacy JSON or plain text output. */
export function extractCompletionText(
  rawText: string,
  mode: PromptMode
): string {
  const trimmed = rawText.trim();
  if (!trimmed) return "";

  if (mode === "legacy_json_no_history") {
    const cleaned = trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
          completion?: unknown;
        };
        if (typeof parsed.completion === "string") {
          return parsed.completion;
        }
      } catch {
        // Fall through to raw text if model returned malformed JSON.
      }
    }
  }

  // Only take the first line for raw single-line continuations.
  const firstLine = trimmed.split(/\r?\n/)[0] ?? "";
  return firstLine
    .replace(/^(?:Continuation(?: at <CURSOR>)?|Completion):\s*/i, "")
    .replace(/^<CURSOR>/, "");
}

function trimToNaturalBoundary(text: string, maxChars: number): string {
  if (!text || maxChars <= 0) return "";
  if (text.length <= maxChars) return text.trimEnd();
  const slice = text.slice(0, maxChars);
  const lastBoundary = Math.max(
    slice.lastIndexOf(" "),
    slice.lastIndexOf("."),
    slice.lastIndexOf(","),
    slice.lastIndexOf("!"),
    slice.lastIndexOf("?"),
    slice.lastIndexOf(";"),
    slice.lastIndexOf(":")
  );
  if (lastBoundary >= Math.max(12, maxChars - 24)) {
    return slice.slice(0, lastBoundary).trimEnd();
  }
  return slice.trimEnd();
}

function trimToWordLimit(text: string, maxWords: number): string {
  if (!text || maxWords <= 0) return "";
  const leadingSpace = text.startsWith(" ") ? " " : "";
  const trimmed = text.trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) {
    return `${leadingSpace}${trimmed}`;
  }
  return `${leadingSpace}${words.slice(0, maxWords).join(" ")}`;
}

/**
 * Normalizes and clamps a model completion using the shared autocomplete
 * normalizer, with configurable length bounds so legacy (24 chars / 4 words)
 * and improved (clause-length) modes can be benchmarked side by side.
 */
export function finalizeCandidateSuggestion(args: {
  rawText: string;
  mode: PromptMode;
  testCase: AutocompleteCase;
  maxSuggestionChars?: number;
  maxSuggestionWords?: number;
}): string {
  const extracted = extractCompletionText(args.rawText, args.mode);
  const normalized = normalizeInlineAutocompleteSuggestion({
    suggestion: extracted,
    beforeCursor: args.testCase.beforeCursor,
    afterCursor: args.testCase.afterCursor,
  });
  if (!normalized) return "";

  const charLimit =
    args.maxSuggestionChars ?? INLINE_AUTOCOMPLETE_MAX_SUGGESTION_CHARS;
  const wordLimit =
    args.maxSuggestionWords ?? INLINE_AUTOCOMPLETE_MAX_SUGGESTION_WORDS;

  let clamped = trimToWordLimit(
    trimToNaturalBoundary(normalized, charLimit),
    wordLimit
  );

  const maxLength = args.testCase.maxLength;
  if (!maxLength || maxLength <= 0 || !clamped) {
    return clamped;
  }

  const before = args.testCase.beforeCursor;
  const after = args.testCase.afterCursor ?? "";
  const currentText = `${before}${after}`;

  if (args.testCase.characterCountMode === "x_post") {
    if (getXPostWeightedLength(currentText) >= maxLength) return "";
    let accepted = "";
    for (const char of clamped) {
      if (
        getXPostWeightedLength(`${before}${accepted}${char}${after}`) >
        maxLength
      ) {
        break;
      }
      accepted += char;
    }
    clamped = accepted.trimEnd();
    return clamped;
  }

  const remaining = maxLength - currentText.length;
  if (remaining <= 0) return "";
  return trimToWordLimit(trimToNaturalBoundary(clamped, remaining), wordLimit);
}
