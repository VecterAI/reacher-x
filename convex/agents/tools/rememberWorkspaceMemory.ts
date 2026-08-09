"use node";

// convex/agents/tools/rememberWorkspaceMemory.ts
// Agent tool to persist operator-sourced workspace memories from chat.
//
// Thin Layer-1 wrapper:
// - Validates structured memory args from the LLM
// - Resolves workspace + prospect from thread context
// - Calls the canonical idempotent persistence + RAG indexing action
// - Returns a compact summary suitable for inline confirmation UI

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";
import {
  WORKSPACE_MEMORY_CATEGORIES,
  type WorkspaceMemorySource,
  type WorkspaceMemoryCategory,
} from "../../lib/agentMemoryCore";
import type { DistilledMemoryDraft } from "../../lib/learningCore";
import { distillOperatorLearningDetailed } from "../../lib/learningCore";
import { getLatestPlanBatchUserPrompt } from "../../lib/planBatchCore";
import {
  getToolPromptMessageId,
  resolveWorkspaceMemoryContext,
  type WorkspaceMemoryContext,
} from "./workspaceMemoryHelpers";
import { createMemoryArtifact } from "../../../shared/lib/json-render/agentArtifacts";
import { runLoggedAgentTool } from "./logging";

const workspaceMemoryCategoryEnum = z.enum(WORKSPACE_MEMORY_CATEGORIES);

export const rememberWorkspaceMemory = createTool({
  description:
    "Save a reusable workspace memory based on what the user just told you. Use this when the user says things like 'remember this', 'save this as a pattern', or 'never do this again'. The tool automatically scopes the memory to the current workspace and, when relevant, links it to the current prospect.",
  inputSchema: z.object({
    memoryKey: z
      .string()
      .min(3)
      .max(120)
      .describe(
        "Stable topic key for this instruction, such as outreach.copy_length. Reuse the same key when the user corrects or replaces this instruction."
      ),
    kind: z
      .string()
      .min(3)
      .max(80)
      .describe(
        "Open-ended instruction kind, such as writing_preference, resource, business_rule, or workflow_preference."
      ),
    category: workspaceMemoryCategoryEnum
      .default("operator_instruction")
      .describe(
        "Memory category that best describes this lesson (e.g. qualification_win_pattern, outreach_winning_pattern)."
      ),
    title: z
      .string()
      .min(6)
      .max(120)
      .describe("Short, human-readable title for this memory."),
    summary: z
      .string()
      .min(20)
      .max(320)
      .describe(
        "1–3 sentence summary of the lesson in plain language, focused on what to repeat or avoid."
      ),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .default(0.8)
      .describe(
        "How confident you are that this lesson is generally true for this workspace (0–1)."
      ),
    impactScore: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(
        "How important this memory is for outcomes like qualified leads or replies (0–1). If unsure, omit."
      ),
    signals: z
      .array(z.string())
      .max(8)
      .optional()
      .describe(
        "Optional bullet points capturing signals that predict this pattern (e.g. 'mentions GTM execution struggles')."
      ),
    evidence: z
      .array(z.string())
      .max(8)
      .optional()
      .describe(
        "Optional bullet points with concrete evidence for this lesson (e.g. links, paraphrased posts, outcomes)."
      ),
    relatedQueries: z
      .array(z.string())
      .max(8)
      .optional()
      .describe(
        "Optional keywords or queries that should retrieve this memory later."
      ),
    narrative: z
      .string()
      .max(2000)
      .optional()
      .describe(
        "Optional longer narrative giving richer context. If omitted, the system will build one from title, summary, signals, and evidence."
      ),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        "Optional open-ended structured metadata needed to apply this instruction later, such as URLs, labels, or constraints."
      ),
    scope: z
      .enum(["workspace", "prospect"])
      .default("workspace")
      .describe(
        "Use workspace unless the instruction applies only to the prospect linked to this thread."
      ),
    surfaces: z
      .array(z.string().min(1).max(80))
      .max(12)
      .optional()
      .describe(
        "Optional agent surfaces where this applies, such as main, setup, manual_prospect, qualification, auto_plan, or adaptive_outreach."
      ),
    channels: z
      .array(z.string().min(1).max(80))
      .max(12)
      .optional()
      .describe(
        "Optional outreach channels where this applies, such as twitter or linkedin."
      ),
    mode: z
      .enum(["manual", "auto"])
      .default("manual")
      .describe(
        'Use "auto" when you only have a raw note and want the system to distill 1–2 memories from it. Use "manual" when you are already providing a clean title and summary.'
      )
      .optional(),
    noteText: z
      .string()
      .max(4000)
      .optional()
      .describe(
        'Optional raw note text to distill into 1–2 reusable memories when mode="auto".'
      ),
  }),
  execute: async (
    ctx,
    args,
    options
  ): Promise<{
    success: boolean;
    message: string;
    workspaceId?: string;
    prospectId?: string;
    memoryId?: string;
    category?: WorkspaceMemoryCategory;
    source?: WorkspaceMemorySource;
    title?: string;
    summary?: string;
    confidence?: number;
    impactScore?: number;
    artifact?: ReturnType<typeof createMemoryArtifact>;
  }> =>
    runLoggedAgentTool(
      ctx,
      {
        moduleName: "rememberWorkspaceMemory",
        args,
      },
      async (logEvent) => {
        const context: WorkspaceMemoryContext =
          await resolveWorkspaceMemoryContext(
            ctx,
            "rememberWorkspaceMemory",
            logEvent
          );

        if (!context.userId) {
          return {
            success: false,
            message:
              "Unable to save memory because the user is not authenticated in this thread.",
          };
        }

        if (!context.workspaceId) {
          return {
            success: false,
            message:
              "I couldn't determine which workspace to attach this memory to. Please make sure you're in a valid setup or outreach conversation.",
          };
        }

        if (args.scope === "prospect" && !context.prospectId) {
          return {
            success: false,
            message:
              "This memory was requested as prospect-specific, but this conversation is not linked to a prospect.",
          };
        }

        try {
          const mode = args.mode ?? "manual";
          const verbatimInstruction =
            getLatestPlanBatchUserPrompt(options.messages) ??
            args.noteText?.trim() ??
            args.summary.trim();
          const scopedProspectId =
            args.scope === "prospect"
              ? (context.prospectId ?? undefined)
              : undefined;
          const provenanceMessageId = getToolPromptMessageId(ctx);
          const openMetadata = {
            ...args.metadata,
            signals: args.signals ?? [],
            evidence: args.evidence ?? [],
            relatedQueries: args.relatedQueries ?? [],
            narrative: args.narrative ?? null,
          };

          // Manual mode: single structured memory from explicit fields
          if (mode === "manual" || !args.noteText) {
            const result = await ctx.runAction(
              internal.memory.persistCanonicalWorkspaceMemoryInternal,
              {
                userId: String(context.userId),
                workspaceId: context.workspaceId,
                category: args.category,
                source: "operator",
                title: args.title,
                summary: args.summary,
                confidence: args.confidence ?? 0.8,
                impactScore: args.impactScore,
                prospectId: scopedProspectId,
                threadId: ctx.threadId ?? undefined,
                signals: args.signals,
                evidence: args.evidence,
                relatedQueries: args.relatedQueries,
                narrative: args.narrative,
                instruction: verbatimInstruction,
                canonicalContent: verbatimInstruction,
                conflictKey: args.memoryKey,
                metadata: openMetadata,
                kind: args.kind,
                surfaces: args.surfaces,
                channels: args.channels,
                provenanceKind: "user_instruction",
                provenanceMessageId,
              }
            );

            const artifact =
              createMemoryArtifact({
                memoryId: result.memoryId,
                workspaceId: context.workspaceId,
                prospectId: scopedProspectId ?? null,
                title: result.parsed.title,
                category: result.parsed.category,
                source: result.parsed.source,
                confidence: result.parsed.confidence,
                impactScore: result.parsed.impactScore,
              }) ?? undefined;

            logEvent.set({
              memory: {
                category: result.parsed.category,
                id: result.memoryId,
                mode,
              },
              workspace: {
                id: context.workspaceId,
              },
            });

            return {
              success: true,
              message:
                "Saved this as a reusable workspace memory so future qualification, enrichment, and outreach can rely on it.",
              workspaceId: context.workspaceId,
              prospectId: scopedProspectId,
              memoryId: result.memoryId,
              category: result.parsed.category,
              source: result.parsed.source,
              title: result.parsed.title,
              summary: result.parsed.summary,
              confidence: result.parsed.confidence,
              impactScore: result.parsed.impactScore,
              artifact,
            };
          }

          // Auto mode: distill 1–2 drafts from a raw operator note
          const distillation = await distillOperatorLearningDetailed({
            workspaceName: "Workspace",
            workspaceDescription: args.summary,
            useCaseKey: undefined,
            noteText: args.noteText,
            contextSnippets: args.signals ?? args.evidence,
          });

          const drafts: DistilledMemoryDraft[] = distillation.drafts;
          if (drafts.length === 0) {
            logEvent.warn("No durable lesson extracted from operator note");
            return {
              success: false,
              message:
                "I couldn't find a durable lesson in this note to save as workspace memory.",
            };
          }

          // Persist each draft as a separate operator memory
          const inserted = [];
          for (const draft of drafts) {
            const result = await ctx.runAction(
              internal.memory.persistCanonicalWorkspaceMemoryInternal,
              {
                userId: String(context.userId),
                workspaceId: context.workspaceId,
                category: draft.category,
                source: "operator",
                title: draft.title,
                summary: draft.summary,
                confidence: draft.confidence,
                impactScore: draft.impactScore,
                prospectId: scopedProspectId,
                threadId: ctx.threadId ?? undefined,
                signals: draft.signals,
                evidence: draft.evidence,
                relatedQueries: draft.relatedQueries,
                narrative: draft.narrative,
                instruction: verbatimInstruction,
                canonicalContent: verbatimInstruction,
                conflictKey: `${args.memoryKey}:${draft.category}`,
                metadata: {
                  ...openMetadata,
                  distilledTitle: draft.title,
                  distilledSummary: draft.summary,
                },
                kind: args.kind,
                surfaces: args.surfaces,
                channels: args.channels,
                provenanceKind: "user_instruction",
                provenanceMessageId,
              }
            );
            inserted.push(result);
          }

          const primary = inserted[0];
          const artifact =
            createMemoryArtifact({
              memoryId: primary.memoryId,
              workspaceId: context.workspaceId,
              prospectId: scopedProspectId ?? null,
              title: primary.parsed.title,
              category: primary.parsed.category,
              source: primary.parsed.source,
              confidence: primary.parsed.confidence,
              impactScore: primary.parsed.impactScore,
            }) ?? undefined;

          logEvent.set({
            memory: {
              category: primary.parsed.category,
              draft_count: drafts.length,
              id: primary.memoryId,
              mode,
            },
            workspace: {
              id: context.workspaceId,
            },
          });

          return {
            success: true,
            message:
              drafts.length === 1
                ? "Saved this note as a reusable workspace memory."
                : `Saved ${drafts.length} reusable workspace memories distilled from this note.`,
            workspaceId: context.workspaceId,
            prospectId: scopedProspectId,
            memoryId: primary.memoryId,
            category: primary.parsed.category,
            source: primary.parsed.source,
            title: primary.parsed.title,
            summary: primary.parsed.summary,
            confidence: primary.parsed.confidence,
            impactScore: primary.parsed.impactScore,
            artifact,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          logEvent.error(error);
          return {
            success: false,
            message: `Unable to save this as workspace memory: ${errorMessage}`,
          };
        }
      }
    ),
});
