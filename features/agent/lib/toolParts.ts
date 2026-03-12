/**
 * Shared helpers for parsing AI SDK tool parts ("tool-{toolName}").
 */

const TOOL_PART_PREFIX = "tool-";
const COMPLETED_TOOL_STATES = new Set(["result", "output-available"]);

export type ToolPartLike = {
  type: `tool-${string}`;
  state?: string;
  input?: unknown;
  output?: unknown;
  toolCallId?: string;
  errorText?: string;
};

export type ReasoningPartLike = {
  type: "reasoning" | "redacted-reasoning";
  text?: string;
  data?: string;
  signature?: string;
  providerMetadata?: Record<string, Record<string, unknown>>;
};

export type SourcePartLike = {
  type: "source" | "source-url" | "source-document";
  id?: string;
  sourceType?: "url" | "document";
  url?: string;
  title?: string;
  filename?: string;
  mediaType?: string;
};

export function isToolPart<T extends { type: string }>(
  part: T
): part is T & ToolPartLike;
export function isToolPart(part: unknown): part is ToolPartLike;
export function isToolPart(part: unknown): part is ToolPartLike {
  if (typeof part !== "object" || part === null) {
    return false;
  }

  const type = (part as { type?: unknown }).type;
  return typeof type === "string" && type.startsWith(TOOL_PART_PREFIX);
}

export function getToolNameFromPart(part: ToolPartLike): string {
  const toolName = part.type.slice(TOOL_PART_PREFIX.length);
  return toolName || "unknown";
}

export function isReasoningPart(part: unknown): part is ReasoningPartLike {
  if (typeof part !== "object" || part === null) {
    return false;
  }

  const type = (part as { type?: unknown }).type;
  return type === "reasoning" || type === "redacted-reasoning";
}

export function isSourcePart(part: unknown): part is SourcePartLike {
  if (typeof part !== "object" || part === null) {
    return false;
  }

  const type = (part as { type?: unknown }).type;
  return (
    type === "source" || type === "source-url" || type === "source-document"
  );
}

export function isCompletedToolPart(part: ToolPartLike): boolean {
  return COMPLETED_TOOL_STATES.has(part.state ?? "");
}

export function isSuccessfulToolCall(
  part: unknown,
  expectedToolName?: string
): part is ToolPartLike & {
  state: "result" | "output-available";
  output: { success: true };
} {
  if (!isToolPart(part) || !isCompletedToolPart(part)) {
    return false;
  }

  const toolName = getToolNameFromPart(part);
  if (expectedToolName && toolName !== expectedToolName) {
    return false;
  }

  if (typeof part.output !== "object" || part.output === null) {
    return false;
  }

  return (part.output as { success?: unknown }).success === true;
}
