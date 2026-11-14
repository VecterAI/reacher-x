import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";

export type StructuredRequest<T> = Readonly<{
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
}>;

export type StructuredResponse<T> = Readonly<{
  output: T;
  // The model OpenRouter reports serving, and the call's cost when reported.
  modelObserved: string;
  costUsd: number | null;
  latencyMs: number;
}>;

export type StructuredCall = <T>(
  model: string,
  request: StructuredRequest<T>
) => Promise<StructuredResponse<T>>;

const costSchema = z.object({
  openrouter: z.object({ usage: z.object({ cost: z.number() }) }),
});

/** A saved model call, so translations and extractions replay at $0. */
export const modelExchangeSchema = z.strictObject({
  step: z.string().min(1),
  model: z.string().min(1),
  system: z.string(),
  prompt: z.string(),
  output: z.unknown(),
  modelObserved: z.string(),
  costUsd: z.number().nonnegative().nullable(),
  latencyMs: z.number().nonnegative(),
});
export type ModelExchange = z.infer<typeof modelExchangeSchema>;

/** A model call named by its step within a unit of work, like an HTTP exchange. */
export type StepCall = <T>(
  step: string,
  model: string,
  request: StructuredRequest<T>
) => Promise<StructuredResponse<T>>;

export function recordingCall(
  call: StructuredCall,
  sink: (exchange: ModelExchange) => Promise<void> | void
): StepCall {
  return async (step, model, request) => {
    const response = await call(model, request);
    await sink({
      step,
      model,
      system: request.system,
      prompt: request.prompt,
      output: response.output,
      modelObserved: response.modelObserved,
      costUsd: response.costUsd,
      latencyMs: response.latencyMs,
    });
    return response;
  };
}

/** Replays saved model calls in order; a changed prompt stops the dry run. */
export function replayCall(saved: readonly ModelExchange[]): StepCall {
  const queue = saved.map((exchange) => modelExchangeSchema.parse(exchange));
  return async (step, model, request) => {
    const next = queue.shift();
    if (!next || next.step !== step)
      throw new Error(`No saved model response for step "${step}".`);
    if (
      next.model !== model ||
      next.system !== request.system ||
      next.prompt !== request.prompt
    )
      throw new Error(
        `The saved model call for step "${step}" differs from this one.`
      );
    return {
      output: request.schema.parse(next.output),
      modelObserved: next.modelObserved,
      costUsd: next.costUsd,
      latencyMs: next.latencyMs,
    };
  };
}

/** One structured, temperature-0 call through the given OpenRouter key. */
export function openRouterStructured(apiKey: string): StructuredCall {
  const openrouter = createOpenRouter({ apiKey });
  return async (model, { system, prompt, schema }) => {
    const started = performance.now();
    const result = await generateText({
      model: openrouter(model, { usage: { include: true } }),
      system,
      prompt,
      temperature: 0,
      output: Output.object({ schema }),
    });
    const cost = costSchema.safeParse(result.providerMetadata);
    return {
      output: result.output,
      modelObserved: result.response.modelId,
      costUsd: cost.success ? cost.data.openrouter.usage.cost : null,
      latencyMs: performance.now() - started,
    };
  };
}
