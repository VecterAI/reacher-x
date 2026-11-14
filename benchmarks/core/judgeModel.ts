import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { BlindInput, JudgeCaller } from "./judges";

const criteriaOutputSchema = z.object({
  criteria: z.array(
    z.object({
      criterionId: z.string(),
      verdict: z.enum(["met", "partly_met", "not_met"]),
      evidenceIds: z.array(z.string()),
      explanation: z.string(),
    })
  ),
});

const SYSTEM = `You grade one search result against a prompt's requirements.
Judge only from the supplied facts and evidence. For each criterion answer met, partly_met or not_met.
Use not_met when the evidence does not show the requirement; never assume. Dates are relative to the reference date.
Cite only evidence IDs that appear in the input. Grade every criterion exactly once.`;

function describe(input: BlindInput) {
  return JSON.stringify(
    {
      prompt: input.prompt,
      referenceDate: input.referenceDate,
      definitionNotes: input.definitionNotes,
      criteria: input.criteria,
      result: input.entity,
    },
    null,
    2
  );
}

/**
 * Judges through the separate judge key, never the deployment's key. The
 * reported model and the call's cost come from OpenRouter's response, so the
 * run records which model actually served each grade.
 */
export function openRouterJudgeCaller(apiKey: string): JudgeCaller {
  const openrouter = createOpenRouter({ apiKey });
  return async (model, input) => {
    const result = await generateText({
      model: openrouter(model, { usage: { include: true } }),
      system: SYSTEM,
      prompt: describe(input),
      temperature: 0,
      output: Output.object({ schema: criteriaOutputSchema }),
    });
    const cost = z
      .object({
        openrouter: z.object({ usage: z.object({ cost: z.number() }) }),
      })
      .safeParse(result.providerMetadata);
    return {
      output: { caseId: input.caseId, criteria: result.output.criteria },
      modelObserved: result.response.modelId,
      costUsd: cost.success ? cost.data.openrouter.usage.cost : null,
    };
  };
}
