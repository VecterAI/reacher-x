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

const icpsSchema = z
  .array(icpSchema)
  .min(2)
  .max(4)
  .describe("2-4 distinct Ideal Customer Profile segments");

const improvedDescriptionAndIcpsSchema = z.strictObject({
  improvedDescription: z
    .string()
    .min(1)
    .describe(
      "A light, factual edit of the user description that preserves every material detail and does not add claims"
    ),
  icps: icpsSchema,
});

const revisedIcpsSchema = z.strictObject({
  icps: icpsSchema,
});

type SetupGenerationUsage = ReturnType<typeof extractUsage>;

export type SetupGenerationTelemetry = {
  model: string;
  providerHint: string;
  providerMetadata?: ProviderMetadata;
  routing: "fast";
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
  };
};

export type SetupGenerationDraft = {
  improvedDescription: string;
  icps: ICP[];
  telemetry: SetupGenerationTelemetry;
};

export type SetupProfileRevision = {
  icps: ICP[];
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

  return `Lightly improve the user's description and create 2-4 ${useCase.profileLabelPlural}.

${buildGroundedDescriptionContext(args)}

Create:
1. A lightly edited improved description. Preserve all material meaning and facts; do not add or infer anything.
2. 2-4 distinct profiles with pain points and preferred social channels.`;
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

Return a full replacement set of 2-4 ${useCase.profileLabelPlural.toLowerCase()} only. Do not return a description field.`;

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
  const routing = "fast" as const;
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
  const routing = "fast" as const;

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
    telemetry: buildTelemetry({
      model,
      providerMetadata: providerMetadata as ProviderMetadata | undefined,
      prompt,
      response: {
        icpCount: object.icps.length,
        icpTitles: object.icps.map((profile) => profile.title),
        improvedDescription: object.improvedDescription,
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
  const routing = "fast" as const;

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
    telemetry: buildTelemetry({
      model,
      providerMetadata: providerMetadata as ProviderMetadata | undefined,
      prompt,
      response: {
        icpCount: object.icps.length,
        icpTitles: object.icps.map((profile) => profile.title),
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
    telemetry: revision.telemetry,
  };
}
