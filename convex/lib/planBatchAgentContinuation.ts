import type { ContextHandler } from "@convex-dev/agent";
import type { JSONValue, ModelMessage } from "ai";
import { getDeferredAgentExecution } from "./deferredAgentTurn";
import { stripCompletedTurnReasoning } from "./agentContextHelpers";

export type PlanBatchAgentResult = {
  status: string;
  operation: string;
  targetCount: number;
  eligibleCount: number;
  succeededCount: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  skippedCount: number;
  errorMessage?: string;
  targetNames: string[];
  issues: Array<{
    prospectName: string;
    reason: string;
  }>;
};

type PlanBatchAgentContextParts = {
  search: ModelMessage[];
  recent: ModelMessage[];
  inputMessages: ModelMessage[];
  inputPrompt: ModelMessage[];
  existingResponses: ModelMessage[];
};

function buildJsonPlanBatchAgentResult(
  result: PlanBatchAgentResult
): JSONValue {
  return {
    status: result.status,
    operation: result.operation,
    targetCount: result.targetCount,
    eligibleCount: result.eligibleCount,
    succeededCount: result.succeededCount,
    createdCount: result.createdCount,
    updatedCount: result.updatedCount,
    failedCount: result.failedCount,
    skippedCount: result.skippedCount,
    ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
    targetNames: result.targetNames,
    issues: result.issues.map((issue) => ({
      prospectName: issue.prospectName,
      reason: issue.reason,
    })),
  };
}

export function buildPlanBatchAgentTerminalToolOutput(args: {
  runId: string;
  result: PlanBatchAgentResult;
}): JSONValue {
  return {
    success: args.result.status === "completed",
    execution: {
      state: "finished",
      continuationId: args.runId,
    },
    result: buildJsonPlanBatchAgentResult(args.result),
  };
}

export function buildPlanBatchAgentContinuationMessages(
  context: PlanBatchAgentContextParts,
  args: {
    runId: string;
    result: PlanBatchAgentResult;
  }
): ModelMessage[] {
  const terminalOutput = buildPlanBatchAgentTerminalToolOutput(args);
  const existingResponses = context.existingResponses.map(
    (message): ModelMessage => {
      if (message.role !== "tool") {
        return message;
      }

      return {
        ...message,
        content: message.content.map((part) => {
          if (
            part.type !== "tool-result" ||
            part.toolName !== "managePlanBatch" ||
            getDeferredAgentExecution(part.output)?.continuationId !==
              args.runId
          ) {
            return part;
          }

          return {
            ...part,
            output: {
              type: "json" as const,
              value: terminalOutput,
            },
          };
        }),
      };
    }
  );

  return [
    ...context.search.map(stripCompletedTurnReasoning),
    ...context.recent.map(stripCompletedTurnReasoning),
    ...context.inputMessages,
    ...context.inputPrompt,
    ...existingResponses,
  ];
}

export function createPlanBatchAgentContinuationContextHandler(args: {
  runId: string;
  result: PlanBatchAgentResult;
}): ContextHandler {
  return async (_ctx, context) =>
    buildPlanBatchAgentContinuationMessages(context, args);
}
