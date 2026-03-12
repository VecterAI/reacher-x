import type { UIMessage } from "@convex-dev/agent/react";
import {
  getToolNameFromPart,
  isCompletedToolPart,
  isToolPart,
} from "./toolParts";

export type SetupInputMode = "url" | "manual";

export interface SetupICPPreview {
  title: string;
  description: string;
  painPoints: string[];
  channels: string[];
}

export interface SetupAnalysisResult {
  order: number;
  businessName: string | null;
  seedDescription: string | null;
  targetAudience: string[];
  keyProblems: string[];
  uniqueValue: string | null;
  sourceUrl: string | null;
}

export interface SetupGeneratedResult {
  order: number;
  improvedDescription: string;
  icps: SetupICPPreview[];
  seedDescription: string | null;
  descriptionSource: SetupInputMode;
  sourceUrl: string | null;
  suggestedWorkspaceName: string | null;
}

export interface SetupWorkspaceMutationResult {
  order: number;
  workspaceId: string;
  workspaceName: string | null;
  isUpdate: boolean;
}

export interface SetupConversationSnapshot {
  latestUserMessage: string | null;
  analysis: SetupAnalysisResult | null;
  generation: SetupGeneratedResult | null;
  workspaceMutation: SetupWorkspaceMutationResult | null;
  isGeneratingProfiles: boolean;
  isSavingWorkspace: boolean;
  lastGenerationError: string | null;
  lastWorkspaceError: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is string => typeof item === "string");
}

function getOrder(message: UIMessage, fallbackOrder: number): number {
  return typeof message.order === "number" ? message.order : fallbackOrder;
}

export function extractSetupConversationSnapshot(
  messages: UIMessage[]
): SetupConversationSnapshot {
  let latestUserMessage: string | null = null;
  let analysis: SetupAnalysisResult | null = null;
  let generation: SetupGeneratedResult | null = null;
  let workspaceMutation: SetupWorkspaceMutationResult | null = null;
  let isGeneratingProfiles = false;
  let isSavingWorkspace = false;
  let lastGenerationError: string | null = null;
  let lastWorkspaceError: string | null = null;

  for (const [index, message] of messages.entries()) {
    if (
      message.role === "user" &&
      message.text &&
      message.text !== "__INIT__" &&
      message.text.trim().length > 0
    ) {
      latestUserMessage = message.text;
    }

    for (const part of message.parts ?? []) {
      if (!isToolPart(part)) {
        continue;
      }

      const toolName = getToolNameFromPart(part);
      const input = asRecord(part.input);
      const output = asRecord(part.output);
      const order = getOrder(message, index);
      const completed = isCompletedToolPart(part);

      if (!completed) {
        if (
          toolName === "analyzeUrl" ||
          toolName === "generateImprovedDescriptionAndICPs"
        ) {
          isGeneratingProfiles = true;
        }
        if (toolName === "createWorkspace" || toolName === "updateWorkspace") {
          isSavingWorkspace = true;
        }
        continue;
      }

      const success = output?.success === true;
      const error = getString(output?.error);

      if (toolName === "analyzeUrl") {
        if (success) {
          analysis = {
            order,
            businessName: getString(output?.businessName),
            seedDescription: getString(output?.seedDescription),
            targetAudience: getStringArray(output?.targetAudience),
            keyProblems: getStringArray(output?.keyProblems),
            uniqueValue: getString(output?.uniqueValue),
            sourceUrl: getString(input?.url),
          };
          continue;
        }

        lastGenerationError = error ?? lastGenerationError;
        continue;
      }

      if (toolName === "generateImprovedDescriptionAndICPs") {
        if (success) {
          const icps = Array.isArray(output?.icps)
            ? output.icps
                .map((candidate) => {
                  const record = asRecord(candidate);
                  if (!record) return null;

                  return {
                    title: getString(record.title) ?? "Untitled profile",
                    description: getString(record.description) ?? "",
                    painPoints: getStringArray(record.painPoints),
                    channels: getStringArray(record.channels),
                  } satisfies SetupICPPreview;
                })
                .filter((candidate): candidate is SetupICPPreview =>
                  Boolean(candidate)
                )
            : [];

          generation = {
            order,
            improvedDescription:
              getString(output?.improvedDescription) ??
              analysis?.seedDescription ??
              "",
            icps,
            seedDescription:
              getString(input?.seedDescription) ??
              analysis?.seedDescription ??
              null,
            descriptionSource: analysis?.sourceUrl ? "url" : "manual",
            sourceUrl: analysis?.sourceUrl ?? null,
            suggestedWorkspaceName: analysis?.businessName ?? null,
          };
          continue;
        }

        lastGenerationError = error ?? lastGenerationError;
        continue;
      }

      if (toolName === "createWorkspace" || toolName === "updateWorkspace") {
        if (success) {
          const workspaceId = getString(output?.workspaceId);
          if (workspaceId) {
            workspaceMutation = {
              order,
              workspaceId,
              workspaceName: getString(output?.workspaceName),
              isUpdate:
                toolName === "updateWorkspace" || output?.isUpdate === true,
            };
          }
          continue;
        }

        lastWorkspaceError = error ?? lastWorkspaceError;
      }
    }
  }

  return {
    latestUserMessage,
    analysis,
    generation,
    workspaceMutation,
    isGeneratingProfiles,
    isSavingWorkspace,
    lastGenerationError,
    lastWorkspaceError,
  };
}
