"use node";

import { generateText } from "ai";
import { v } from "convex/values";
import { action } from "./lib/functionBuilders";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { AUTOCOMPLETE_MODEL, createAIProvider, extractUsage } from "./lib/ai";
import { getStyleMemoryCategory } from "./lib/styleSourceCore";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { getWorkspaceUseCase } from "../shared/lib/workspaceUseCases";
import {
  clampInlineAutocompleteSuggestion,
  getInlineAutocompletePromptWindow,
  INLINE_AUTOCOMPLETE_MAX_OUTPUT_TOKENS,
  INLINE_AUTOCOMPLETE_NO_SUGGESTION,
  type InlineAutocompleteResponse,
  normalizeInlineAutocompleteSuggestion,
  shouldRequestInlineAutocomplete,
} from "../shared/lib/autocomplete/inlineAutocomplete";
import { getXPostWeightedLength } from "../shared/lib/twitter/xPostTextLimit";

type ViewerUser = Doc<"users">;
type WorkspaceDoc = Doc<"workspaces">;
type ProspectDoc = Doc<"prospects">;

const MAX_STYLE_PROFILE_CHARS = 700;
const MAX_REPLY_CONTEXT_CHARS = 320;
const MAX_TONE_HINT_CHARS = 120;

async function getCurrentUser(ctx: any): Promise<ViewerUser> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.runQuery(internal.users.getUserByWorkosIdInternal, {
    workosUserId: identity.subject,
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

function getPlatformCandidates(
  platform: "twitter" | "linkedin" | "generic" | undefined
) {
  if (platform === "linkedin") {
    return ["linkedin"] as const;
  }

  if (platform === "twitter") {
    return ["twitter"] as const;
  }

  return ["twitter", "linkedin"] as const;
}

function buildWorkspaceContext(workspace: WorkspaceDoc | null | undefined) {
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

function buildProspectContext(prospect: ProspectDoc | null | undefined) {
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

async function resolveWorkspaceAndProspectContext(args: {
  ctx: any;
  user: ViewerUser;
  workspaceId?: string;
  prospectId?: string;
}): Promise<{
  workspace: WorkspaceDoc | null;
  prospect: ProspectDoc | null;
}> {
  let prospect: ProspectDoc | null = null;
  let workspace: WorkspaceDoc | null = null;

  if (args.prospectId) {
    const nextProspect: ProspectDoc | null = await args.ctx.runQuery(
      internal.prospects.getProspectInternal,
      {
        prospectId: args.prospectId as Id<"prospects">,
      }
    );

    if (nextProspect && nextProspect.userId === args.user._id) {
      prospect = nextProspect;
    }
  }

  const resolvedWorkspaceId = args.workspaceId ?? prospect?.workspaceId;
  if (resolvedWorkspaceId) {
    const nextWorkspace: WorkspaceDoc | null = await args.ctx.runQuery(
      internal.workspaces.getWorkspaceInternal,
      {
        workspaceId: resolvedWorkspaceId as Id<"workspaces">,
      }
    );

    if (nextWorkspace && nextWorkspace.userId === args.user._id) {
      workspace = nextWorkspace;
    }
  }

  if (!workspace) {
    const nextWorkspace: WorkspaceDoc | null = await args.ctx.runQuery(
      internal.workspaces.getDefaultWorkspaceInternal,
      {
        userId: args.user._id,
      }
    );
    workspace = nextWorkspace;
  }

  return { workspace, prospect };
}

async function resolveStyleProfile(args: {
  ctx: any;
  user: ViewerUser;
  workspace: WorkspaceDoc | null | undefined;
  platform?: "twitter" | "linkedin" | "generic";
}): Promise<{
  category: "writing_style_profile_twitter" | "writing_style_profile_linkedin";
  narrative: string;
} | null> {
  if (!args.workspace) {
    return null;
  }

  for (const platform of getPlatformCandidates(args.platform)) {
    const category = getStyleMemoryCategory(platform) as
      | "writing_style_profile_twitter"
      | "writing_style_profile_linkedin";
    const memories: Array<{
      parsed?: { narrative?: string } | null;
      promptLine?: string;
    }> = await args.ctx.runQuery(
      internal.memory.findRelevantBuiltInAgentMemoriesInternal,
      {
        userId: String(args.user._id),
        workspaceId: String(args.workspace._id),
        query: "writing style profile voice",
        categories: [category],
        limit: 1,
      }
    );

    const memory = memories[0];
    const narrative: string =
      memory?.parsed?.narrative || memory?.promptLine || "";

    if (narrative) {
      return {
        category,
        narrative,
      };
    }
  }

  return null;
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
    useCaseKey: v.optional(v.string()),
    toneHint: v.optional(v.string()),
    beforeCursor: v.string(),
    afterCursor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<InlineAutocompleteResponse> => {
    if (!shouldRequestInlineAutocomplete(args)) {
      return {
        suggestion: "",
        latencyMs: 0,
        model: AUTOCOMPLETE_MODEL,
        workspaceId: undefined,
        styleProfileCategory: undefined,
        styleProfileApplied: false,
      };
    }

    const startedAt = getCurrentUTCTimestamp();
    const user = await getCurrentUser(ctx);
    const { workspace, prospect } = await resolveWorkspaceAndProspectContext({
      ctx,
      user,
      workspaceId: args.workspaceId,
      prospectId: args.prospectId,
    });
    const styleProfile = await resolveStyleProfile({
      ctx,
      user,
      workspace,
      platform: args.platform,
    });

    const provider = createAIProvider();
    const promptWindow = getInlineAutocompletePromptWindow({
      beforeCursor: args.beforeCursor,
      afterCursor: args.afterCursor,
    });
    const workspaceContext = buildWorkspaceContext(workspace);
    const prospectContext = buildProspectContext(prospect);
    const budgetContext = buildBudgetContext(args);

    const systemPrompt = `You generate inline autocomplete continuations for ReacherX.

Return ONLY the text that should be inserted at the cursor.
If confidence is low, return exactly ${INLINE_AUTOCOMPLETE_NO_SUGGESTION}.

Rules:
- Optimize for precision over recall.
- Continue the user's exact train of thought instead of rewriting it.
- Match the user's voice when style guidance is provided.
- Return a single-line continuation only.
- Never include line breaks, bullets, labels, or multiple options.
- Keep completions short and tab-accept friendly.
- Prefer 2-3 words only. Never exceed 4 words.
- End on a natural word boundary.
- Do not repeat the provided prefix.
- Do not repeat text that already appears after the cursor.
- Do not add labels, explanations, markdown, quotes, or multiple options.
- If the best continuation would require multiple lines or a bigger rewrite, return ${INLINE_AUTOCOMPLETE_NO_SUGGESTION}.
- Avoid generic AI phrasing, filler, and corporate language unless the user's style clearly does that.`;

    const prompt = [
      `Surface: ${args.surfaceLabel ?? args.surface ?? "composer"}`,
      `Platform: ${args.platform ?? "generic"}`,
      budgetContext,
      workspaceContext
        ? `Workspace context:\n${workspaceContext.details}`
        : null,
      prospectContext ? `Prospect context:\n${prospectContext}` : null,
      args.replyToAuthorHandle
        ? `Reply target handle: @${args.replyToAuthorHandle}`
        : null,
      truncateContext(args.replyToText, MAX_REPLY_CONTEXT_CHARS)
        ? `Reply target text:\n${truncateContext(args.replyToText, MAX_REPLY_CONTEXT_CHARS)}`
        : null,
      truncateContext(args.toneHint, MAX_TONE_HINT_CHARS)
        ? `Tone hint: ${truncateContext(args.toneHint, MAX_TONE_HINT_CHARS)}`
        : null,
      styleProfile
        ? `User writing voice:\n${truncateContext(styleProfile.narrative, MAX_STYLE_PROFILE_CHARS)}`
        : "No trusted style profile is available. Stay concise and neutral.",
      `Text before cursor:\n"""${promptWindow.beforeCursor}"""`,
      promptWindow.afterCursor
        ? `Text after cursor:\n"""${promptWindow.afterCursor}"""`
        : "Text after cursor: <empty>",
      `Generate the single most likely continuation. Keep it to 2-3 words. If uncertain, output ${INLINE_AUTOCOMPLETE_NO_SUGGESTION}.`,
    ]
      .filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0
      )
      .join("\n\n");

    const result = await generateText({
      model: provider(AUTOCOMPLETE_MODEL) as any,
      system: systemPrompt,
      prompt,
      temperature: 0.15,
      maxOutputTokens: INLINE_AUTOCOMPLETE_MAX_OUTPUT_TOKENS,
    });

    const normalizedSuggestion = normalizeInlineAutocompleteSuggestion({
      suggestion: result.text,
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

    console.info(
      `[Autocomplete] Completed in ${latencyMs}ms model=${model} styleApplied=${Boolean(styleProfile)} surface=${args.surfaceLabel ?? args.surface ?? "composer"}`
    );

    return {
      suggestion,
      latencyMs,
      model,
      workspaceId: workspace ? String(workspace._id) : undefined,
      styleProfileCategory: styleProfile?.category,
      styleProfileApplied: Boolean(styleProfile),
    };
  },
});
