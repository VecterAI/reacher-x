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
