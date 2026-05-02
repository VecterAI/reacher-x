import { getXPostWeightedLength } from "@/shared/lib/twitter/xPostTextLimit";

export type InlineAutocompleteSurface = "composer" | "prompt_input";
export type InlineAutocompletePlatform = "twitter" | "linkedin" | "generic";
export type InlineAutocompleteCharacterCountMode = "raw" | "x_post";

export type InlineAutocompleteContext = {
  enabled?: boolean;
  surface?: InlineAutocompleteSurface;
  surfaceLabel?: string;
  platform?: InlineAutocompletePlatform;
  workspaceId?: string;
  prospectId?: string;
  threadId?: string;
  maxLength?: number;
  characterCountMode?: InlineAutocompleteCharacterCountMode;
  replyToText?: string;
  replyToAuthorHandle?: string;
  useCaseKey?: string;
  toneHint?: string;
};

export type InlineAutocompleteRequest = InlineAutocompleteContext & {
  beforeCursor: string;
  afterCursor?: string;
};

export type InlineAutocompleteResponse = {
  suggestion: string;
  latencyMs: number;
  model: string;
  workspaceId?: string;
  styleProfileCategory?: string;
  styleProfileApplied: boolean;
};

export const INLINE_AUTOCOMPLETE_MIN_PREFIX_CHARS = 8;
export const INLINE_AUTOCOMPLETE_MAX_PREFIX_CHARS = 600;
export const INLINE_AUTOCOMPLETE_MAX_SUFFIX_CHARS = 96;
export const INLINE_AUTOCOMPLETE_MAX_SUGGESTION_CHARS = 24;
export const INLINE_AUTOCOMPLETE_MAX_OUTPUT_TOKENS = 10;
export const INLINE_AUTOCOMPLETE_DEBOUNCE_MS = 140;
export const INLINE_AUTOCOMPLETE_NO_SUGGESTION = "__NO_COMPLETION__";

const URL_LIKE_REGEX = /https?:\/\/\S*$/i;
const EMAIL_LIKE_REGEX = /\S+@\S*$/i;
const TRAILING_TRIGGER_REGEX = /[@#/]$/;
const SUGGESTION_NO_LEADING_SPACE_REGEX = /^[,.;:!?%)\]}'"’]/;
const BEFORE_CURSOR_ATTACH_REGEX = /[\s([{/'"“‘@#._/-]$/;

export function shouldRequestInlineAutocomplete(
  request: InlineAutocompleteRequest | null | undefined
): request is InlineAutocompleteRequest {
  if (!request || request.enabled === false) {
    return false;
  }

  const beforeCursor = normalizeInlineAutocompleteWhitespace(
    request.beforeCursor
  );
  const afterCursor = normalizeInlineAutocompleteWhitespace(
    request.afterCursor ?? ""
  );

  if (beforeCursor.trim().length < INLINE_AUTOCOMPLETE_MIN_PREFIX_CHARS) {
    return false;
  }

  if (
    /\w$/.test(beforeCursor) &&
    afterCursor.length > 0 &&
    /^\w/.test(afterCursor)
  ) {
    return false;
  }

  if (
    URL_LIKE_REGEX.test(beforeCursor) ||
    EMAIL_LIKE_REGEX.test(beforeCursor) ||
    TRAILING_TRIGGER_REGEX.test(beforeCursor)
  ) {
    return false;
  }

  return true;
}

export function buildInlineAutocompleteRequestSignature(
  request: InlineAutocompleteRequest | null | undefined
): string {
  if (!request) {
    return "";
  }

  return JSON.stringify({
    ...request,
    beforeCursor: normalizeInlineAutocompleteWhitespace(request.beforeCursor),
    afterCursor: normalizeInlineAutocompleteWhitespace(
      request.afterCursor ?? ""
    ),
  });
}

export function getInlineAutocompletePromptWindow(args: {
  beforeCursor: string;
  afterCursor?: string;
}) {
  const beforeCursor = normalizeInlineAutocompleteWhitespace(args.beforeCursor);
  const afterCursor = normalizeInlineAutocompleteWhitespace(
    args.afterCursor ?? ""
  );

  return {
    beforeCursor: beforeCursor.slice(-INLINE_AUTOCOMPLETE_MAX_PREFIX_CHARS),
    afterCursor: afterCursor.slice(0, INLINE_AUTOCOMPLETE_MAX_SUFFIX_CHARS),
  };
}

export function normalizeInlineAutocompleteWhitespace(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

export function normalizeInlineAutocompleteSuggestion(args: {
  suggestion: string;
  beforeCursor: string;
  afterCursor?: string;
}) {
  let nextSuggestion = normalizeInlineAutocompleteWhitespace(args.suggestion)
    .replace(/^["'`]+/, "")
    .replace(/["'`]+$/, "")
    .replace(/^\s*```(?:\w+)?/i, "")
    .replace(/```\s*$/i, "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\t+/g, " ")
    .replace(/ {2,}/g, " ")
    .trimEnd();

  if (!nextSuggestion) {
    return "";
  }

  if (
    nextSuggestion === INLINE_AUTOCOMPLETE_NO_SUGGESTION ||
    nextSuggestion.includes(INLINE_AUTOCOMPLETE_NO_SUGGESTION)
  ) {
    return "";
  }

  nextSuggestion = trimSuggestionOverlapWithBeforeCursor(
    args.beforeCursor,
    nextSuggestion
  );
  nextSuggestion = trimSuggestionOverlapWithAfterCursor(
    nextSuggestion,
    args.afterCursor ?? ""
  );

  if (nextSuggestion.startsWith(" ") && /[\s\n]$/.test(args.beforeCursor)) {
    nextSuggestion = nextSuggestion.replace(/^ +/, "");
  }

  return getInlineAutocompleteInsertionText({
    beforeCursor: args.beforeCursor,
    suggestion: nextSuggestion.trimEnd(),
  });
}

export function clampInlineAutocompleteSuggestion(args: {
  suggestion: string;
  beforeCursor: string;
  afterCursor?: string;
  maxLength?: number;
  characterCountMode?: InlineAutocompleteCharacterCountMode;
}) {
  const suggestion = trimSuggestionToNaturalBoundary(
    args.suggestion,
    INLINE_AUTOCOMPLETE_MAX_SUGGESTION_CHARS
  );
  const maxLength = args.maxLength;

  if (!maxLength || maxLength <= 0 || !suggestion) {
    return suggestion;
  }

  const beforeCursor = args.beforeCursor;
  const afterCursor = args.afterCursor ?? "";
  const currentText = `${beforeCursor}${afterCursor}`;

  if (args.characterCountMode === "x_post") {
    if (getXPostWeightedLength(currentText) >= maxLength) {
      return "";
    }

    let accepted = "";
    for (const char of suggestion) {
      const candidate = `${beforeCursor}${accepted}${char}${afterCursor}`;
      if (getXPostWeightedLength(candidate) > maxLength) {
        break;
      }
      accepted += char;
    }
    return accepted;
  }

  const remaining = maxLength - currentText.length;
  if (remaining <= 0) {
    return "";
  }

  return trimSuggestionToNaturalBoundary(suggestion, remaining);
}

export function getInlineAutocompleteInsertionText(args: {
  beforeCursor: string;
  suggestion: string;
}) {
  const suggestion = args.suggestion.trimEnd();

  if (!suggestion) {
    return "";
  }

  if (!args.beforeCursor) {
    return suggestion.replace(/^ +/, "");
  }

  if (/[\s\n]$/.test(args.beforeCursor)) {
    return suggestion.replace(/^ +/, "");
  }

  if (suggestion.startsWith(" ")) {
    return suggestion;
  }

  if (
    BEFORE_CURSOR_ATTACH_REGEX.test(args.beforeCursor) ||
    SUGGESTION_NO_LEADING_SPACE_REGEX.test(suggestion)
  ) {
    return suggestion;
  }

  return ` ${suggestion}`;
}

function trimSuggestionOverlapWithBeforeCursor(
  beforeCursor: string,
  suggestion: string
) {
  const maxOverlap = Math.min(beforeCursor.length, suggestion.length, 80);

  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (beforeCursor.slice(-overlap) === suggestion.slice(0, overlap)) {
      return suggestion.slice(overlap);
    }
  }

  return suggestion;
}

function trimSuggestionOverlapWithAfterCursor(
  suggestion: string,
  afterCursor: string
) {
  const maxOverlap = Math.min(afterCursor.length, suggestion.length, 80);

  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (suggestion.slice(-overlap) === afterCursor.slice(0, overlap)) {
      return suggestion.slice(0, suggestion.length - overlap);
    }
  }

  return suggestion;
}

function trimSuggestionToNaturalBoundary(suggestion: string, limit: number) {
  if (!suggestion || limit <= 0) {
    return "";
  }

  if (suggestion.length <= limit) {
    return suggestion.trimEnd();
  }

  const slice = suggestion.slice(0, limit);
  const lastBoundary = Math.max(
    slice.lastIndexOf(" "),
    slice.lastIndexOf("."),
    slice.lastIndexOf(","),
    slice.lastIndexOf("!"),
    slice.lastIndexOf("?"),
    slice.lastIndexOf(";"),
    slice.lastIndexOf(":")
  );

  if (lastBoundary >= Math.max(12, limit - 18)) {
    return slice.slice(0, lastBoundary).trimEnd();
  }

  return slice.trimEnd();
}
