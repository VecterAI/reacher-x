import { z } from "zod";

export const OUTREACH_ROUTER_AGENT_NAME = "Outreach Turn Router";
export const OUTREACH_ROUTER_MIN_CONFIDENCE = 0.78;

export const outreachTextModelLaneSchema = z.enum(["fast", "terra", "sol"]);
export type OutreachTextModelLane = z.infer<typeof outreachTextModelLaneSchema>;
export type OutreachModelLane = OutreachTextModelLane | "vision";

export const OUTREACH_ROUTE_REASONS = [
  "simple_status_or_display",
  "simple_confirmation",
  "simple_tool_operation",
  "plan_or_copy_judgment",
  "capability_or_fact_check",
  "nuanced_or_ambiguous",
  "repeated_correction",
  "unresolved_contradiction",
  "high_stakes_repair",
] as const;

export const outreachRouteReasonSchema = z.enum(OUTREACH_ROUTE_REASONS);

export const outreachRouteDecisionSchema = z.object({
  lane: outreachTextModelLaneSchema,
  confidence: z.number().min(0).max(1),
  reason: outreachRouteReasonSchema,
  rationale: z.string().max(180),
});

export type OutreachRouteDecision = z.infer<typeof outreachRouteDecisionSchema>;

export type OutreachRouteSelection = OutreachRouteDecision & {
  selectedLane: OutreachTextModelLane;
  usedConfidenceFallback: boolean;
};

export type OutreachRouterMessage = {
  id?: string;
  role?: string;
  text?: string;
};

export type OutreachOperationState = {
  prospectStatus: string;
  planStatus: string;
  taskStatusCounts: Record<string, number>;
};

const MAX_ROUTER_MESSAGE_COUNT = 8;
const MAX_ROUTER_MESSAGE_CHARACTERS = 600;
const MAX_ROUTER_HISTORY_CHARACTERS = 4_000;
const MAX_ROUTER_PROMPT_CHARACTERS = 2_000;
const MAX_OUTREACH_SESSION_ID_CHARACTERS = 240;

function clipText(value: string, maxCharacters: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxCharacters) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxCharacters - 1))}…`;
}

export function buildOutreachModelSessionId(
  threadId: string,
  lane: OutreachModelLane
): string {
  return clipText(
    `reacherx:prospect:${lane}:${threadId}`,
    MAX_OUTREACH_SESSION_ID_CHARACTERS
  );
}

export function compactOutreachRouterMessages(
  messages: OutreachRouterMessage[],
  currentMessageId?: string
): Array<{ role: "user" | "assistant"; text: string }> {
  const compactMessages: Array<{
    role: "user" | "assistant";
    text: string;
  }> = [];
  let characterCount = 0;

  for (const message of messages) {
    if (currentMessageId && message.id === currentMessageId) {
      continue;
    }
    if (message.role !== "user" && message.role !== "assistant") {
      continue;
    }
    if (typeof message.text !== "string") {
      continue;
    }

    const text = clipText(message.text, MAX_ROUTER_MESSAGE_CHARACTERS);
    if (!text) {
      continue;
    }
    if (characterCount + text.length > MAX_ROUTER_HISTORY_CHARACTERS) {
      continue;
    }

    compactMessages.push({ role: message.role, text });
    characterCount += text.length;
  }

  return compactMessages.slice(-MAX_ROUTER_MESSAGE_COUNT);
}

export function summarizeOutreachOperationState(args: {
  prospectStatus?: string | null;
  planStatus?: string | null;
  taskStatuses?: Array<string | null | undefined>;
}): OutreachOperationState {
  const taskStatusCounts: Record<string, number> = {};
  for (const rawStatus of args.taskStatuses ?? []) {
    const status = rawStatus?.trim();
    if (!status) continue;
    taskStatusCounts[status] = (taskStatusCounts[status] ?? 0) + 1;
  }

  return {
    prospectStatus: args.prospectStatus?.trim() || "unknown",
    planStatus: args.planStatus?.trim() || "none",
    taskStatusCounts,
  };
}

export function buildOutreachRouterPrompt(args: {
  currentPrompt: string;
  recentMessages: Array<{ role: "user" | "assistant"; text: string }>;
  operationState: OutreachOperationState;
}): string {
  const history = args.recentMessages.length
    ? args.recentMessages
        .map((message) => `${message.role.toUpperCase()}: ${message.text}`)
        .join("\n")
    : "No earlier visible conversation.";

  return `Classify the model lane for the next prospect-agent response.

Use semantic intent and conversational state, not keyword matching.

LANES
- fast: Only an unambiguous low-judgment request such as showing existing state, a simple confirmation, or a direct basic tool operation. It must not require interpreting product capabilities, resolving ambiguity, judging outreach quality, writing copy, or changing/refining a plan.
- terra: Standard judgment for workspace/product capability checks, factual interpretation, and ordinary questions that are not writing or changing an outreach plan.
- sol: Use for plan generation or refinement, personalized outreach copy, ambiguous targeting or strategy requests, unresolved contradictions, repeated corrections, and difficult repairs.

REASON CODES
${OUTREACH_ROUTE_REASONS.join(", ")}

IMPORTANT
- A request can mention a plan yet still require Terra or Sol. For example, asking whether a critique contradicts current workspace capabilities is not a simple plan operation.
- Do not choose Sol merely because the user sounds annoyed. Choose it when the work itself needs stronger targeting, planning, writing, or recovery judgment.
- If uncertain between fast and terra, choose terra.
- If uncertain whether a request changes a plan, targeting decision, or personalized copy, choose sol.

CURRENT OPERATION STATE
${JSON.stringify(args.operationState)}

RECENT VISIBLE CONVERSATION (oldest to newest)
${history}

CURRENT USER MESSAGE
${clipText(args.currentPrompt, MAX_ROUTER_PROMPT_CHARACTERS) || "[empty message]"}`;
}

export function selectOutreachTextLane(
  decision: OutreachRouteDecision
): OutreachRouteSelection {
  const usedConfidenceFallback =
    decision.confidence < OUTREACH_ROUTER_MIN_CONFIDENCE;

  return {
    ...decision,
    selectedLane: usedConfidenceFallback ? "sol" : decision.lane,
    usedConfidenceFallback,
  };
}
