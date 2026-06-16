"use node";

import { createTool } from "@convex-dev/agent";
import { compactLogContext } from "../../../shared/lib/logging/config";
import {
  createManualWideEventLogger,
  type ConvexWideEventLogger,
} from "../../lib/wideEventLogger";

type ToolContext = Parameters<Parameters<typeof createTool>[0]["handler"]>[0];

type ToolLogOptions<TArgs> = {
  args?: TArgs;
  includeArgKeys?: string[];
  moduleName: string;
  operation?: string;
};

function summarizeToolArgs(
  args: unknown,
  includeArgKeys?: string[]
): Record<string, unknown> | undefined {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return undefined;
  }

  const record = args as Record<string, unknown>;
  const summary: Record<string, unknown> = {
    arg_keys: Object.keys(record).sort(),
  };

  if (includeArgKeys?.length) {
    for (const key of includeArgKeys) {
      const value = record[key];
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        summary[key] = value;
      }
    }
  }

  return compactLogContext(summary) as Record<string, unknown>;
}

export async function runLoggedAgentTool<TResult, TArgs>(
  ctx: ToolContext,
  options: ToolLogOptions<TArgs>,
  runner: (logEvent: ConvexWideEventLogger) => Promise<TResult>
): Promise<TResult> {
  const logEvent = createManualWideEventLogger({
    kind: "agentTool",
    operation: options.operation ?? options.moduleName,
    context: compactLogContext({
      module: options.moduleName,
      threadId: ctx.threadId ?? undefined,
      userId: typeof ctx.userId === "string" ? ctx.userId : undefined,
      args: summarizeToolArgs(options.args, options.includeArgKeys),
    }) as Record<string, unknown>,
  });

  try {
    const result = await runner(logEvent);
    logEvent.emitSuccess(result);
    return result;
  } catch (error) {
    logEvent.emitError(error);
    throw error;
  }
}
