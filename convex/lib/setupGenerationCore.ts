"use node";

import type { ProviderMetadata } from "ai";
import { z } from "zod";
import {
  buildProfileGenerationPrompt,
  buildProfileRevisionPrompt,
} from "../agents/prompts";
import { icpSchema, type ICP } from "../agents/tools/schemas";
import {
  getWorkspaceUseCase,
  type WorkspaceUseCaseKey,
} from "../../shared/lib/workspaceUseCases";
import { extractUsage, getRoutingTelemetry, robustGenerateObject } from "./ai";
import {
  normalizeWorkspaceTargetingSpec,
  type WorkspaceTargetingSpec,
} from "./targetingSpecCore";

const icpsSchema = z
  .array(icpSchema)
  .min(3)
  .max(4)
  .describe("3-4 distinct Ideal Customer Profile segments");

/**
 * NOTE: This Zod schema intentionally mirrors workspaceTargetingSpecValidator.
 * AI SDK structured output requires Zod; Convex persistence uses validators.ts.
 */
const workspaceTargetingSpecSchema = z.strictObject({
  version: z.literal(1),
  summary: z.string().min(1).max(600),
  criteria: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(48),
        label: z.string().min(1).max(120),
        description: z.string().min(1).max(500),
        sourceQuote: z
          .string()
          .min(1)
          .max(1000)
          .describe(
            "Exact passage from the original user input or their revision feedback that grounds this criterion."
          ),
        importanceReason: z
          .string()
          .min(1)
          .max(500)
          .describe(
            "Explain whether this is the core reason the person is useful, an ordinary targeting preference, or an explicit non-negotiable restriction. Ordinary descriptive wording alone is not mandatory."
          ),
        kind: z
          .enum(["required", "preferred", "exclusion"])
          .describe(
            "required: essential underlying intent or an explicit non-negotiable; preferred: ordinary attributes even when phrased as 'Find ...'; exclusion: explicit refusal only."
          ),
        category: z.enum(["profile_fit", "intent", "timing"]),
        evidence: z.enum(["profile", "activity", "either"]),
        weight: z.number().int().min(1).max(5),
        terms: z.array(z.string().min(1).max(120)).max(12),
      })
    )
    .min(1)
    .max(12),
  searchHints: z.strictObject({
    entities: z.array(z.string().min(1).max(120)).max(20),
    activityPhrases: z.array(z.string().min(1).max(120)).max(20),
    roleTitles: z.array(z.string().min(1).max(120)).max(20),
    locations: z.array(z.string().min(1).max(120)).max(20),
    industries: z.array(z.string().min(1).max(120)).max(20),
    companyNames: z.array(z.string().min(1).max(120)).max(20),
    languageCodes: z.array(z.string().min(2).max(12)).max(20),
    exclusionTerms: z.array(z.string().min(1).max(120)).max(20),
  }),
  searchFilters: z.strictObject({
    twitter: z.strictObject({
      language: z.string().min(2).max(12).optional(),
      location: z.string().min(1).max(120).optional(),
    }),
    linkedinPeople: z.strictObject({
      location: z.string().min(1).max(120).optional(),
      profileLanguage: z.string().min(2).max(12).optional(),
    }),
    linkedinPosts: z.strictObject({
      authorJobTitle: z.string().min(1).max(120).optional(),
      datePosted: z
        .enum(["past-24h", "past-week", "past-month", "past-year"])
        .optional(),
    }),
  }),
});

const improvedDescriptionAndIcpsSchema = z.strictObject({
  improvedDescription: z
    .string()
    .min(1)
    .describe(
      "A light, factual edit of the user description that preserves every material detail and does not add claims"
    ),
  icps: icpsSchema,
  targetingSpec: workspaceTargetingSpecSchema,
});

const revisedIcpsSchema = z.strictObject({
  icps: icpsSchema,
  targetingSpec: workspaceTargetingSpecSchema,
});

type SetupGenerationUsage = ReturnType<typeof extractUsage>;

export type SetupGenerationTelemetry = {
  model: string;
  providerHint: string;
  providerMetadata?: ProviderMetadata;
  routing: "onboarding";
  timeoutMs: number;
  usage: SetupGenerationUsage;
  request: {
    prompt: string;
    system: string;
  };
  response: {
    icpCount: number;
    icpTitles: string[];
    improvedDescription?: string;
    targetingCriterionCount: number;
  };
};

export type SetupGenerationDraft = {
  improvedDescription: string;
  icps: ICP[];
  targetingSpec: WorkspaceTargetingSpec;
  telemetry: SetupGenerationTelemetry;
};

export type SetupProfileRevision = {
  icps: ICP[];
  targetingSpec: WorkspaceTargetingSpec;
  telemetry: SetupGenerationTelemetry;
};

export type GenerateSetupDraftArgs = {
  currentProfiles?: Array<{
    channels: string[];
    description: string;
    painPoints: string[];
    title: string;
  }> | null;
  currentImprovedDescription?: string | null;
  keyProblems?: string[];
  operation?: string;
  /**
   * Kept for backwards compatibility. New callers should use
   * generateSetupProfileRevision so the description is never model-rewritten.
   */
  revisionFeedback?: string | null;
  seedDescription: string;
  targetAudience?: string[];
  useCaseKey?: WorkspaceUseCaseKey | null;
};

export type GenerateSetupProfileRevisionArgs = Pick<
  GenerateSetupDraftArgs,
  | "currentImprovedDescription"
  | "currentProfiles"
  | "operation"
  | "seedDescription"
  | "useCaseKey"
> & {
  revisionFeedback: string;
};

function formatCurrentProfiles(
  profiles: NonNullable<GenerateSetupDraftArgs["currentProfiles"]>
): string {
  return profiles
    .map(
      (profile, index) =>
        `${index + 1}. ${profile.title}
Description: ${profile.description}
Pain points: ${profile.painPoints.join("; ")}
Channels: ${profile.channels.join(", ")}`
    )
    .join("\n\n");
}

function getCurrentProfiles(args: GenerateSetupDraftArgs) {
  return (
    args.currentProfiles?.filter(
      (profile) => profile.title.trim().length > 0
    ) ?? []
  );
}

function buildGroundedDescriptionContext(args: GenerateSetupDraftArgs): string {
  const useCase = getWorkspaceUseCase(args.useCaseKey);
  let prompt = `**Original user description (source of truth):**
<original_description>
${args.seedDescription.trim()}
</original_description>`;

  if (args.targetAudience?.length) {
    prompt += `\n\n**Known target audience from the supplied source:** ${args.targetAudience.join(", ")}`;
  }

  if (args.keyProblems?.length) {
    prompt += `\n\n**Known problems from the supplied source:** ${args.keyProblems.join(", ")}`;
  }

  prompt += `\n\nUse the original description as the authoritative account of this ${useCase.displayName} workspace.`;
  return prompt;
}

export function buildInitialSetupGenerationUserPrompt(
  args: GenerateSetupDraftArgs
): string {
  const useCase = getWorkspaceUseCase(args.useCaseKey);

  let prompt = `Lightly improve the user's description and create 3-4 ${useCase.profileLabelPlural}.

${buildGroundedDescriptionContext(args)}

Create:
1. A lightly edited improved description. Preserve all material meaning and facts; do not add or infer anything.
2. 3-4 distinct profiles with pain points and preferred social channels.
3. A machine-readable targetingSpec that preserves the user's exact requirements, preferences, exclusions, named products/companies, and observable intent.`;

  const preservedProfiles = getCurrentProfiles(args);
  if (preservedProfiles.length > 0) {
    prompt += `\n\nThese manually maintained profiles will remain in the workspace. Create complementary profiles and do not duplicate their names or audiences:\n${formatCurrentProfiles(preservedProfiles)}`;
  }

  return prompt;
}

export function buildSetupProfileRevisionUserPrompt(
  args: GenerateSetupProfileRevisionArgs
): string {
  const useCase = getWorkspaceUseCase(args.useCaseKey);
  const currentProfiles = getCurrentProfiles(args);
  const currentImprovedDescription =
    args.currentImprovedDescription?.trim() || args.seedDescription.trim();

  let prompt = `Revise only the ${useCase.profileLabelPlural.toLowerCase()} to address the user's feedback.

${buildGroundedDescriptionContext(args)}

**Current improved description (context only; do not edit or return it):**
<current_improved_description>
${currentImprovedDescription}
</current_improved_description>`;

  if (currentProfiles.length > 0) {
    prompt += `\n\n**Current ${useCase.profileLabelPlural}:**\n${formatCurrentProfiles(currentProfiles)}`;
  }

  prompt += `\n\n**Revision feedback:**
<revision_feedback>
${args.revisionFeedback.trim()}
</revision_feedback>

Return a full replacement set of 3-4 ${useCase.profileLabelPlural.toLowerCase()} plus an updated targetingSpec. Do not return a description field.`;

  return prompt;
}

function buildTelemetry(args: {
  model: string;
  providerMetadata: ProviderMetadata | undefined;
  prompt: string;
  response: SetupGenerationTelemetry["response"];
  system: string;
  usage: SetupGenerationUsage;
}): SetupGenerationTelemetry {
  const routing = "onboarding" as const;
  const routingTelemetry = getRoutingTelemetry(routing);

  return {
    model: args.model,
    providerHint: routingTelemetry.providerLabel,
    providerMetadata: args.providerMetadata,
    routing,
    timeoutMs: routingTelemetry.timeoutMs,
    usage: args.usage,
    request: {
      prompt: args.prompt,
      system: args.system,
    },
    response: args.response,
  };
}

/**
 * Generates the initial workspace description and ICP set. The description
 * model is intentionally constrained to a light grounded edit of user text.
 */
export async function generateInitialSetupDraft(
  args: GenerateSetupDraftArgs
): Promise<SetupGenerationDraft> {
  const system = buildProfileGenerationPrompt(args.useCaseKey);
  const prompt = buildInitialSetupGenerationUserPrompt(args);
  const routing = "onboarding" as const;

  const { object, model, usage, providerMetadata } = await robustGenerateObject(
    {
      operation: args.operation ?? "generateImprovedDescriptionAndICPs",
      schema: improvedDescriptionAndIcpsSchema,
      system,
      prompt,
      temperature: 0.2,
      maxRetries: 2,
      routing,
    }
  );

  return {
    improvedDescription: object.improvedDescription,
    icps: object.icps,
    targetingSpec: normalizeWorkspaceTargetingSpec(object.targetingSpec),
    telemetry: buildTelemetry({
      model,
      providerMetadata: providerMetadata as ProviderMetadata | undefined,
      prompt,
      response: {
        icpCount: object.icps.length,
        icpTitles: object.icps.map((profile) => profile.title),
        improvedDescription: object.improvedDescription,
        targetingCriterionCount: object.targetingSpec.criteria.length,
      },
      system,
      usage,
    }),
  };
}

/**
 * Generates an ICP-only revision. Its schema deliberately excludes
 * improvedDescription, preventing profile feedback from changing the workspace
 * description even if the model attempts to do so.
 */
export async function generateSetupProfileRevision(
  args: GenerateSetupProfileRevisionArgs
): Promise<SetupProfileRevision> {
  const system = buildProfileRevisionPrompt(args.useCaseKey);
  const prompt = buildSetupProfileRevisionUserPrompt(args);
  const routing = "onboarding" as const;

  const { object, model, usage, providerMetadata } = await robustGenerateObject(
    {
      operation: args.operation ?? "reviseSetupProfiles",
      schema: revisedIcpsSchema,
      system,
      prompt,
      temperature: 0.35,
      maxRetries: 2,
      routing,
    }
  );

  return {
    icps: object.icps,
    targetingSpec: normalizeWorkspaceTargetingSpec(object.targetingSpec),
    telemetry: buildTelemetry({
      model,
      providerMetadata: providerMetadata as ProviderMetadata | undefined,
      prompt,
      response: {
        icpCount: object.icps.length,
        icpTitles: object.icps.map((profile) => profile.title),
        targetingCriterionCount: object.targetingSpec.criteria.length,
      },
      system,
      usage,
    }),
  };
}

/**
 * Backwards-compatible entry point for callers that historically passed
 * revisionFeedback. New code should call generateSetupProfileRevision directly.
 */
export async function generateSetupDraft(
  args: GenerateSetupDraftArgs
): Promise<SetupGenerationDraft> {
  const revisionFeedback = args.revisionFeedback?.trim();
  if (!revisionFeedback) {
    return await generateInitialSetupDraft(args);
  }

  const revision = await generateSetupProfileRevision({
    currentImprovedDescription: args.currentImprovedDescription,
    currentProfiles: args.currentProfiles,
    operation: args.operation,
    revisionFeedback,
    seedDescription: args.seedDescription,
    useCaseKey: args.useCaseKey,
  });

  return {
    improvedDescription:
      args.currentImprovedDescription?.trim() || args.seedDescription.trim(),
    icps: revision.icps,
    targetingSpec: revision.targetingSpec,
    telemetry: revision.telemetry,
  };
}
