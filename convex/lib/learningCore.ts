"use node";

import { z } from "zod";
import {
  categoryToNamespace,
  type WorkspaceMemoryCategory,
} from "./agentMemoryCore";
import { robustGenerateObject } from "./ai";
import type { WorkspaceUseCaseKey } from "../../shared/lib/workspaceUseCases";
import { getWorkspaceUseCase } from "../../shared/lib/workspaceUseCases";

const distilledMemorySchema = z.object({
  memories: z
    .array(
      z.object({
        category: z.enum([
          "qualification_win_pattern",
          "qualification_false_positive_pattern",
          "enrichment_signal_pattern",
          "enrichment_role_pattern",
          "outreach_winning_pattern",
          "outreach_objection_pattern",
          "writing_style_profile_twitter",
          "writing_style_profile_linkedin",
        ]),
        title: z.string().min(6).max(120),
        summary: z.string().min(20).max(320),
        confidence: z.number().min(0).max(1),
        impactScore: z.number().min(0).max(1).optional(),
        signals: z.array(z.string()).max(5).optional(),
        evidence: z.array(z.string()).max(5).optional(),
        relatedQueries: z.array(z.string()).max(5).optional(),
        narrative: z.string().min(20).max(600).optional(),
      })
    )
    .max(2),
});

export type DistilledMemoryDraft = z.infer<
  typeof distilledMemorySchema
>["memories"][number] & {
  namespace: ReturnType<typeof categoryToNamespace>;
};

export type DistillationTelemetry = {
  operation: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost?: number;
    modelSelected?: string;
  };
  providerMetadata?: unknown;
  request: {
    system: string;
    prompt: string;
  };
  response: {
    draftCount: number;
    categories: WorkspaceMemoryCategory[];
    titles: string[];
  };
};

export type DistillationResult = {
  drafts: DistilledMemoryDraft[];
  telemetry: DistillationTelemetry;
};

type DistillBaseArgs = {
  workspaceName: string;
  workspaceDescription: string;
  useCaseKey?: WorkspaceUseCaseKey;
};

const DISTILLATION_OUTPUT_FORMAT = `Output format:
- Return a JSON object with shape {"memories": [...]}
- If there are no reusable lessons, return {"memories": []}
- Never return a bare array.`;

function buildUseCaseContext(useCaseKey?: WorkspaceUseCaseKey): string {
  const useCase = getWorkspaceUseCase(useCaseKey);
  return [
    `Use case: ${useCase.displayName}`,
    `Search intent: ${useCase.promptContext.searchIntent}`,
    `Qualification lens: ${useCase.promptContext.qualificationLens}`,
    `Outreach goal: ${useCase.promptContext.outreachGoal}`,
    `Success definition: ${useCase.promptContext.successDefinition}`,
  ].join("\n");
}

function toDrafts(
  memories: z.infer<typeof distilledMemorySchema>["memories"]
): DistilledMemoryDraft[] {
  return memories.map((memory) => ({
    ...memory,
    namespace: categoryToNamespace(memory.category as WorkspaceMemoryCategory),
    impactScore: memory.impactScore ?? 0.5,
    narrative:
      memory.narrative ??
      `${memory.title}. ${memory.summary} ${memory.signals?.length ? `Signals: ${memory.signals.join("; ")}.` : ""}`,
    category: memory.category as WorkspaceMemoryCategory,
  }));
}

async function runDistillation(args: {
  operation: string;
  system: string;
  prompt: string;
}): Promise<DistillationResult> {
  const { object, model, usage, providerMetadata } = await robustGenerateObject(
    {
      operation: args.operation,
      schema: distilledMemorySchema,
      system: `${args.system}\n\n${DISTILLATION_OUTPUT_FORMAT}`,
      prompt: args.prompt,
      temperature: 0.2,
      maxRetries: 2,
    }
  );
  const drafts = toDrafts(object.memories);

  return {
    drafts,
    telemetry: {
      operation: args.operation,
      model,
      usage,
      providerMetadata,
      request: {
        system: args.system,
        prompt: args.prompt,
      },
      response: {
        draftCount: drafts.length,
        categories: drafts.map((draft) => draft.category),
        titles: drafts.map((draft) => draft.title),
      },
    },
  };
}

export async function distillQualificationLearningDetailed(
  args: DistillBaseArgs & {
    prospectName: string;
    prospectTitle?: string;
    matchedKeywords: string[];
    score: number;
    qualified: boolean;
    reasoning: string;
    evidenceHighlights: string[];
    priorMemoryContext?: string[];
    similarQualifiedCases?: string[];
    similarDisqualifiedCases?: string[];
  }
): Promise<DistillationResult> {
  const system = `You distill reusable qualification lessons for a self-improving prospecting system.

Return only durable lessons that should be reused across future qualification decisions.
Do not return one-off facts about a single person.
If there is no reusable lesson, return {"memories": []}.

Memory categories:
- qualification_win_pattern: a positive signal that strongly predicts qualification
- qualification_false_positive_pattern: a misleading signal or false-positive pattern to avoid`;

  const prompt = `Workspace: ${args.workspaceName}
Workspace description:
${args.workspaceDescription}

${buildUseCaseContext(args.useCaseKey)}

Prospect:
- Name: ${args.prospectName}
- Title: ${args.prospectTitle || "Unknown"}
- Matched keywords: ${args.matchedKeywords.join(", ") || "None"}
- Qualification result: ${args.qualified ? "qualified" : "disqualified"}
- Score: ${args.score}
- Reasoning: ${args.reasoning}

Evidence highlights:
${args.evidenceHighlights.map((line) => `- ${line}`).join("\n") || "- None"}

Prior memory context:
${args.priorMemoryContext?.map((line) => `- ${line}`).join("\n") || "- None"}

Similar qualified cases:
${args.similarQualifiedCases?.map((line) => `- ${line}`).join("\n") || "- None"}

Similar disqualified cases:
${args.similarDisqualifiedCases?.map((line) => `- ${line}`).join("\n") || "- None"}

Distill up to 2 reusable qualification lessons. Prefer one strong lesson over two weak ones.`;

  return await runDistillation({
    operation: "distillQualificationLearning",
    system,
    prompt,
  });
}

export async function distillQualificationLearning(
  args: DistillBaseArgs & {
    prospectName: string;
    prospectTitle?: string;
    matchedKeywords: string[];
    score: number;
    qualified: boolean;
    reasoning: string;
    evidenceHighlights: string[];
    priorMemoryContext?: string[];
    similarQualifiedCases?: string[];
    similarDisqualifiedCases?: string[];
  }
): Promise<DistilledMemoryDraft[]> {
  const result = await distillQualificationLearningDetailed(args);
  return result.drafts;
}

export async function distillEnrichmentLearningDetailed(
  args: DistillBaseArgs & {
    prospectName: string;
    prospectTitle?: string;
    prospectType?: string;
    briefIntro?: string;
    financeSummary?: string;
    painPoints: string[];
    relatedMemoryContext?: string[];
  }
): Promise<DistillationResult> {
  const system = `You distill reusable enrichment lessons for a self-improving prospecting system.

Return only durable lessons that improve future enrichment, qualification, or outreach.
If there is no reusable lesson, return {"memories": []}.

Memory categories:
- enrichment_signal_pattern: recurring pain, finance, or operational signal worth remembering
- enrichment_role_pattern: recurring title, persona, or account pattern worth reusing`;

  const prompt = `Workspace: ${args.workspaceName}
Workspace description:
${args.workspaceDescription}

${buildUseCaseContext(args.useCaseKey)}

Enriched prospect:
- Name: ${args.prospectName}
- Title: ${args.prospectTitle || "Unknown"}
- Prospect type: ${args.prospectType || "unknown"}
- Intro: ${args.briefIntro || "None"}
- Finance: ${args.financeSummary || "None"}

Pain points:
${args.painPoints.map((line) => `- ${line}`).join("\n") || "- None"}

Related memory context:
${args.relatedMemoryContext?.map((line) => `- ${line}`).join("\n") || "- None"}

Distill up to 2 reusable enrichment lessons. Focus on signals and persona patterns that should influence future generation, qualification, or outreach.`;

  return await runDistillation({
    operation: "distillEnrichmentLearning",
    system,
    prompt,
  });
}

export async function distillEnrichmentLearning(
  args: DistillBaseArgs & {
    prospectName: string;
    prospectTitle?: string;
    prospectType?: string;
    briefIntro?: string;
    financeSummary?: string;
    painPoints: string[];
    relatedMemoryContext?: string[];
  }
): Promise<DistilledMemoryDraft[]> {
  const result = await distillEnrichmentLearningDetailed(args);
  return result.drafts;
}

export async function distillOutreachLearningDetailed(
  args: DistillBaseArgs & {
    prospectName: string;
    prospectTitle?: string;
    briefIntro?: string;
    financeSummary?: string;
    painPoints: string[];
    matchedKeywords: string[];
    outcome:
      | "plan_approved"
      | "plan_abandoned"
      | "task_approved"
      | "task_completed"
      | "task_failed"
      | "responded"
      | "converted"
      | "archived";
    planRationale?: string;
    planTone?: string;
    taskType?: string;
    taskContent?: string;
    responseText?: string;
    failureReason?: string;
    relevantMemories?: string[];
    winningPatterns?: string[];
    objections?: string[];
    similarCases?: string[];
  }
): Promise<DistillationResult> {
  const system = `You distill reusable outreach lessons for a self-improving prospecting system.

Return only durable lessons that improve future plan generation, message style, objection handling, or operator alignment.
If there is no reusable lesson, return {"memories": []}.

Memory categories:
- outreach_winning_pattern: a repeatable plan or messaging pattern that leads to replies, approvals, or conversions
- outreach_objection_pattern: an objection, weak angle, or style to avoid or handle differently`;

  const prompt = `Workspace: ${args.workspaceName}
Workspace description:
${args.workspaceDescription}

${buildUseCaseContext(args.useCaseKey)}

Prospect:
- Name: ${args.prospectName}
- Title: ${args.prospectTitle || "Unknown"}
- Intro: ${args.briefIntro || "None"}
- Finance: ${args.financeSummary || "None"}
- Pain points: ${args.painPoints.join("; ") || "None"}
- Matched keywords: ${args.matchedKeywords.join(", ") || "None"}

Outreach context:
- Outcome: ${args.outcome}
- Plan rationale: ${args.planRationale || "None"}
- Plan tone: ${args.planTone || "None"}
- Task type: ${args.taskType || "None"}
- Task content: ${args.taskContent || "None"}
- Prospect response: ${args.responseText || "None"}
- Failure reason: ${args.failureReason || "None"}

Relevant reusable memories:
${args.relevantMemories?.map((line) => `- ${line}`).join("\n") || "- None"}

Winning patterns:
${args.winningPatterns?.map((line) => `- ${line}`).join("\n") || "- None"}

Common objections:
${args.objections?.map((line) => `- ${line}`).join("\n") || "- None"}

Similar prior cases:
${args.similarCases?.map((line) => `- ${line}`).join("\n") || "- None"}

Distill up to 2 reusable outreach lessons. Prefer durable strategic learnings over one-off copy tweaks.`;

  return await runDistillation({
    operation: "distillOutreachLearning",
    system,
    prompt,
  });
}

export async function distillOutreachLearning(
  args: DistillBaseArgs & {
    prospectName: string;
    prospectTitle?: string;
    briefIntro?: string;
    financeSummary?: string;
    painPoints: string[];
    matchedKeywords: string[];
    outcome:
      | "plan_approved"
      | "plan_abandoned"
      | "task_approved"
      | "task_completed"
      | "task_failed"
      | "responded"
      | "converted"
      | "archived";
    planRationale?: string;
    planTone?: string;
    taskType?: string;
    taskContent?: string;
    responseText?: string;
    failureReason?: string;
    relevantMemories?: string[];
    winningPatterns?: string[];
    objections?: string[];
    similarCases?: string[];
  }
): Promise<DistilledMemoryDraft[]> {
  const result = await distillOutreachLearningDetailed(args);
  return result.drafts;
}

export async function distillOperatorLearningDetailed(
  args: DistillBaseArgs & {
    noteText: string;
    contextSnippets?: string[];
  }
): Promise<DistillationResult> {
  const system = `You turn raw operator notes into up to 2 reusable workspace memories, using the same categories as other memories.

Return only durable lessons that should influence future qualification, enrichment, or outreach decisions.
If the note does not contain a reusable lesson, return {"memories": []}.

Memory categories:
- qualification_win_pattern: a positive signal that strongly predicts a good fit
- qualification_false_positive_pattern: a misleading signal or false-positive pattern to avoid
- enrichment_signal_pattern: recurring enrichment signal (pain, finance, or operational pattern) worth remembering
- enrichment_role_pattern: recurring title, persona, or account pattern worth reusing
- outreach_winning_pattern: a repeatable outreach or messaging pattern that leads to replies, approvals, or conversions
- outreach_objection_pattern: an objection, weak angle, or style to avoid or handle differently`;

  const prompt = `Workspace: ${args.workspaceName}
Workspace description:
${args.workspaceDescription}

${buildUseCaseContext(args.useCaseKey)}

Operator note:
${args.noteText}

Additional context snippets:
${args.contextSnippets?.map((line) => `- ${line}`).join("\n") || "- None"}

Distill up to 2 reusable workspace lessons from this note. Prefer one strong lesson over two weak ones.`;

  return await runDistillation({
    operation: "distillOperatorLearning",
    system,
    prompt,
  });
}

export async function distillOperatorLearning(
  args: DistillBaseArgs & {
    noteText: string;
    contextSnippets?: string[];
  }
): Promise<DistilledMemoryDraft[]> {
  const result = await distillOperatorLearningDetailed(args);
  return result.drafts;
}
