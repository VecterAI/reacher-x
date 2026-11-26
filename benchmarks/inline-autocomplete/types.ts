import type {
  InlineAutocompleteCharacterCountMode,
  InlineAutocompletePlatform,
} from "../../shared/lib/autocomplete/inlineAutocomplete";

export type AutocompleteSurfaceKind =
  | "agent_chat"
  | "x_dm"
  | "linkedin_dm"
  | "x_reply"
  | "linkedin_comment";

export type ConversationTurn = Readonly<{
  role: "user" | "assistant" | "prospect";
  author?: string;
  text: string;
}>;

export type AutocompleteCase = Readonly<{
  id: string;
  surface: AutocompleteSurfaceKind;
  surfaceLabel: string;
  platform: InlineAutocompletePlatform;
  /** Cases sharing a cacheGroup run back-to-back with identical context prefix. */
  cacheGroup?: string;
  workspace: Readonly<{
    name: string;
    description: string;
    outreachGoal: string;
    audienceLabel: string;
  }>;
  prospect?: Readonly<{
    displayName: string;
    title?: string;
    company?: string;
    briefIntro?: string;
    location?: string;
    matchedKeywords?: readonly string[];
  }>;
  styleProfile?: string;
  replyToAuthorHandle?: string;
  replyToText?: string;
  conversationHistory?: readonly ConversationTurn[];
  beforeCursor: string;
  afterCursor?: string;
  maxLength?: number;
  characterCountMode?: InlineAutocompleteCharacterCountMode;
  /** True when the ideal UX is to show no ghost text at all. */
  expectEmpty?: boolean;
  /** Human/judge rubric note describing what a context-accurate completion looks like. */
  expectedIntent: string;
}>;

export type PromptMode = "legacy_json_no_history" | "context_raw";

export type OpenRouterReasoningOption = Readonly<
  | { enabled: false }
  | {
      effort: "none" | "minimal" | "low" | "medium";
      exclude?: boolean;
    }
>;

export type CandidateConfig = Readonly<{
  id: string;
  label: string;
  model: string;
  promptMode: PromptMode;
  maxOutputTokens: number;
  temperature: number;
  maxSuggestionChars: number;
  maxSuggestionWords: number;
  provider?: Readonly<{
    only?: readonly string[];
    order?: readonly string[];
    allow_fallbacks?: boolean;
    sort?: "latency" | "throughput" | "price";
  }>;
  reasoning?: OpenRouterReasoningOption;
  stopSequences?: readonly string[];
}>;

export type DeterministicChecks = Readonly<{
  noError: boolean;
  cleanFormat: boolean;
  noPrefixOverlap: boolean;
  noSuffixOverlap: boolean;
  emptyBehaviorOk: boolean;
  withinBudget: boolean;
  passedAll: boolean;
}>;

export type CaseRunResult = Readonly<{
  caseId: string;
  surface: AutocompleteSurfaceKind;
  cacheGroup?: string;
  isCacheFollowup: boolean;
  candidateId: string;
  rawText: string;
  suggestion: string;
  ttftMs: number | null;
  totalLatencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  costUsd: number;
  modelObserved: string;
  providerObserved: string;
  error?: string;
  checks: DeterministicChecks;
}>;

export type BlindJudgeVerdict = Readonly<{
  caseId: string;
  candidateId: string;
  /** 1 (random/wrong) to 5 (Cursor-level accurate and natural). */
  contextScore: number;
  /** 1 (awkward/robotic) to 5 (tab-accept worthy). */
  naturalnessScore: number;
  wouldTabAccept: boolean;
  reason: string;
}>;

export type CandidateSummary = Readonly<{
  candidateId: string;
  label: string;
  model: string;
  providerObserved: string;
  totalCases: number;
  errorCount: number;
  deterministicPassRate: number;
  emptyAccuracyRate: number;
  ttftP50Ms: number | null;
  ttftP95Ms: number | null;
  latencyP50Ms: number;
  latencyP95Ms: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgReasoningTokens: number;
  cacheHitRate: number;
  costPer1kUsd: number;
  cachedFollowupCostPer1kUsd: number | null;
  totalSpendUsd: number;
  judgeAvgScore: number | null;
  judgeTabAcceptRate: number | null;
}>;
