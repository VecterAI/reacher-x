import type { ModelMessage } from "ai";
import type { Doc } from "../_generated/dataModel";

export const LEGACY_SHARED_PROSPECT_BATCH_PROMPT_PREFIX =
  "Operator instruction (sent to multiple prospects at once):";

export type PlanBatchRequestedOperation =
  | "create"
  | "update"
  | "create_or_update";

export type PlanBatchItemOperation = "create" | "update";

export type PlanBatchAttachment = {
  url: string;
  fileName: string;
  mediaKind: "image" | "gif" | "video" | "file";
};

export type PlanBatchTaggedTarget = {
  prospectId: string;
  label: string;
  handle?: string;
};

export type PlanBatchPerProspectInstruction = {
  prospectName: string;
  instruction: string;
};

export const PLAN_BATCH_REFERENCE_PREFIX = "plans_";
export const PLAN_BATCH_REFERENCE_PATTERN = /^plans_[a-f0-9]{16}$/;

export type PlanBatchReferenceCatalogItem = {
  reference: string;
  operation: PlanBatchRequestedOperation;
  status:
    | "selecting"
    | "awaiting_confirmation"
    | "queued"
    | "running"
    | "completed"
    | "partial"
    | "failed"
    | "cancelled";
  targetCount: number;
  prospectNames: string[];
  createdAt: number;
};

export function selectLatestPlanBatchReferences<
  T extends PlanBatchReferenceCatalogItem & { targetIds: string[] },
>(items: T[]): T[] {
  const seenTargetSets = new Set<string>();

  return [...items]
    .sort((left, right) => right.createdAt - left.createdAt)
    .filter((item) => {
      if (item.targetIds.length === 0) {
        return true;
      }

      const targetSetKey = [...item.targetIds].sort().join("\u0000");
      if (seenTargetSets.has(targetSetKey)) {
        return false;
      }

      seenTargetSets.add(targetSetKey);
      return true;
    });
}

function getModelMessageText(message: ModelMessage): string {
  if (typeof message.content === "string") {
    return message.content.trim();
  }

  const textParts: string[] = [];
  for (const part of message.content) {
    if (part.type !== "text") {
      continue;
    }

    const text = part.text.trim();
    if (text) {
      textParts.push(text);
    }
  }
  return textParts.join("\n");
}

export function getLatestPlanBatchUserPrompt(
  messages: ModelMessage[]
): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") {
      continue;
    }

    const text = getModelMessageText(message);
    if (text) {
      return text;
    }
  }

  return undefined;
}

export function getRecentPlanBatchUserPrompts(
  messages: ModelMessage[],
  limit = 3
): string[] {
  if (limit <= 0) {
    return [];
  }
  const prompts: string[] = [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") {
      continue;
    }
    const text = getModelMessageText(message);
    if (text) {
      prompts.push(text);
    }
    if (prompts.length >= limit) {
      break;
    }
  }
  return prompts.reverse();
}

export function createPlanBatchReferenceKey(): string {
  const randomPart = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  return `${PLAN_BATCH_REFERENCE_PREFIX}${randomPart}`;
}

export function buildPlanBatchReferenceCatalogContext(
  items: PlanBatchReferenceCatalogItem[]
): string | null {
  if (items.length === 0) {
    return null;
  }

  const lines = items.map((item) => {
    const targetDescription =
      item.prospectNames.length > 0
        ? item.prospectNames.join(" and ")
        : `${item.targetCount} outreach plans`;
    return `- ${item.reference}: ${targetDescription}; ${item.operation}; ${item.status}`;
  });

  return [
    "Application-owned outreach plan references available in this conversation:",
    ...lines,
    "",
    "Use one of these exact references only when the user's conversational meaning clearly identifies that plan group.",
    "The references are safe aliases, not database IDs. Never invent a reference.",
    "If more than one group could reasonably match the user's wording, ask one short clarification question.",
  ].join("\n");
}

export function normalizePlanBatchTargetName(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function targetMatchesExactName(
  target: PlanBatchTaggedTarget,
  requestedName: string
): boolean {
  const normalizedName = normalizePlanBatchTargetName(requestedName);
  if (!normalizedName) {
    return false;
  }

  return [target.label, target.handle]
    .filter((value): value is string => Boolean(value))
    .map(normalizePlanBatchTargetName)
    .some((candidate) => candidate === normalizedName);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function instructionReferencesPlanBatchTarget(
  instruction: string,
  target: PlanBatchTaggedTarget
): boolean {
  const references = [
    target.label.trim().includes(" ") ? target.label.trim() : null,
    target.handle ? `@${target.handle.replace(/^@/, "").trim()}` : null,
  ].filter((value): value is string => Boolean(value));

  return references.some((reference) =>
    new RegExp(
      `(^|[^\\p{L}\\p{N}_])${escapeRegExp(reference)}($|[^\\p{L}\\p{N}_])`,
      "iu"
    ).test(instruction)
  );
}

export function resolvePlanBatchTargetInstructions(args: {
  targets: PlanBatchTaggedTarget[];
  instructions: PlanBatchPerProspectInstruction[];
}): Map<string, string> {
  const resolved = new Map<string, string>();

  for (const instruction of args.instructions) {
    const matchingTargets = args.targets.filter((target) =>
      targetMatchesExactName(target, instruction.prospectName)
    );
    if (matchingTargets.length === 0) {
      throw new Error(
        `The target-specific instruction for "${instruction.prospectName}" did not exactly match a tagged prospect name or handle.`
      );
    }
    if (matchingTargets.length > 1) {
      throw new Error(
        `The target-specific instruction for "${instruction.prospectName}" is ambiguous. Use the exact unique handle.`
      );
    }

    const target = matchingTargets[0];
    if (resolved.has(target.prospectId)) {
      throw new Error(
        `More than one target-specific instruction was provided for ${target.label}.`
      );
    }

    const targetInstruction = instruction.instruction.trim();
    const otherTarget = args.targets.find(
      (candidate) =>
        candidate.prospectId !== target.prospectId &&
        instructionReferencesPlanBatchTarget(targetInstruction, candidate)
    );
    if (otherTarget) {
      throw new Error(
        `The instruction for ${target.label} contains ${otherTarget.label}'s details. Split the instructions cleanly and retry.`
      );
    }

    resolved.set(target.prospectId, targetInstruction);
  }

  return resolved;
}

export function getDefaultPlanBatchInstruction(
  operation: PlanBatchRequestedOperation
): string {
  switch (operation) {
    case "create":
      return "Create the most effective research-grounded outreach plan using the workspace offer, ICP, qualification evidence, the prospect's profile and recent content, and the channels actually available. Choose the strongest appropriate sequence and messaging without assuming an unverified platform, post, or fact.";
    case "update":
      return "Improve the existing outreach plan using the latest workspace offer, ICP, qualification evidence, the prospect's profile and recent content, and the channels actually available. Preserve completed work and make the strongest evidence-based improvements to future editable steps.";
    case "create_or_update":
      return "Create or improve the most effective research-grounded outreach plan using the workspace offer, ICP, qualification evidence, the prospect's profile and recent content, and the channels actually available. Choose the strongest appropriate sequence and messaging without assuming an unverified platform, post, or fact.";
  }
}

export function getPlanBatchWorkflowEventName(runId: string): string {
  return `plan-batch:${runId}:state-changed`;
}

export type PlanBatchEligibilityResult =
  | {
      eligible: true;
      operation: PlanBatchItemOperation;
      baselinePlanId?: Doc<"outreachPlans">["_id"];
      baselinePlanVersion?: number;
    }
  | {
      eligible: false;
      reason:
        | "setup_preview"
        | "archived"
        | "disqualified"
        | "not_qualified"
        | "existing_plan"
        | "missing_plan"
        | "plan_not_editable";
    };

export type PlanBatchApplicationResolution =
  | { outcome: "continue" }
  | { outcome: "succeeded"; planId: string }
  | { outcome: "skipped"; reason: "missing_plan" | "plan_changed" };

export function resolvePlanBatchApplication(args: {
  operation: PlanBatchItemOperation;
  activePlan: { id: string; version: number } | null;
  baselinePlanId?: string;
  baselinePlanVersion?: number;
  appliedPlanId?: string;
  appliedPlanVersion?: number;
}): PlanBatchApplicationResolution {
  if (args.appliedPlanId) {
    if (
      args.activePlan?.id === args.appliedPlanId &&
      (args.appliedPlanVersion === undefined ||
        args.activePlan.version >= args.appliedPlanVersion)
    ) {
      return { outcome: "succeeded", planId: args.activePlan.id };
    }
    return { outcome: "skipped", reason: "plan_changed" };
  }

  if (args.operation === "create") {
    return args.activePlan
      ? { outcome: "skipped", reason: "plan_changed" }
      : { outcome: "continue" };
  }

  if (!args.activePlan) {
    return { outcome: "skipped", reason: "missing_plan" };
  }
  if (args.baselinePlanId && args.activePlan.id !== args.baselinePlanId) {
    return { outcome: "skipped", reason: "plan_changed" };
  }
  if (
    args.baselinePlanVersion !== undefined &&
    args.activePlan.version > args.baselinePlanVersion
  ) {
    return { outcome: "skipped", reason: "plan_changed" };
  }
  return { outcome: "continue" };
}

const EDITABLE_PLAN_STATUSES = new Set<Doc<"outreachPlans">["status"]>([
  "draft",
  "executing",
  "paused",
  "blocked_auth",
]);

export function normalizePlanBatchFitRange(args: {
  min: number;
  max: number;
}): { min: number; max: number } {
  const min = Math.max(0, Math.min(100, Math.round(args.min)));
  const max = Math.max(0, Math.min(100, Math.round(args.max)));
  if (min > max) {
    throw new Error("Fit score minimum cannot be greater than maximum.");
  }
  return { min, max };
}

export function resolvePlanBatchEligibility(args: {
  prospect: Pick<Doc<"prospects">, "origin" | "qualificationStatus" | "status">;
  activePlan: Pick<Doc<"outreachPlans">, "_id" | "status" | "version"> | null;
  requestedOperation: PlanBatchRequestedOperation;
}): PlanBatchEligibilityResult {
  if (args.prospect.origin === "setup_preview") {
    return { eligible: false, reason: "setup_preview" };
  }
  if (args.prospect.status === "archived") {
    return { eligible: false, reason: "archived" };
  }
  if (args.prospect.qualificationStatus === "disqualified") {
    return { eligible: false, reason: "disqualified" };
  }
  if (args.prospect.qualificationStatus !== "qualified") {
    return { eligible: false, reason: "not_qualified" };
  }

  const effectiveOperation: PlanBatchItemOperation =
    args.requestedOperation === "create_or_update"
      ? args.activePlan
        ? "update"
        : "create"
      : args.requestedOperation;

  if (effectiveOperation === "create") {
    return args.activePlan
      ? { eligible: false, reason: "existing_plan" }
      : { eligible: true, operation: "create" };
  }

  if (!args.activePlan) {
    return { eligible: false, reason: "missing_plan" };
  }
  if (!EDITABLE_PLAN_STATUSES.has(args.activePlan.status)) {
    return { eligible: false, reason: "plan_not_editable" };
  }

  return {
    eligible: true,
    operation: "update",
    baselinePlanId: args.activePlan._id,
    baselinePlanVersion: args.activePlan.version,
  };
}

function getOperationInstruction(operation: PlanBatchItemOperation) {
  return operation === "create"
    ? [
        "Create a new draft outreach plan now.",
        "Check the current plan state first. If an active plan appeared after this batch was prepared, do not overwrite it.",
        "Use the plan-generation tool and persist the resulting draft.",
      ]
    : [
        "Update the existing outreach plan now.",
        "Inspect the active plan first, then use the plan-refinement tool to apply the requested change.",
        "Only future or still-editable tasks may be changed.",
      ];
}

export function buildScopedPlanBatchPrompt(args: {
  prospectName: string;
  operation: PlanBatchItemOperation;
  sharedInstruction: string;
  sourcePrompt?: string;
  targetInstruction?: string;
  attachments: PlanBatchAttachment[];
}): string {
  const sourcePrompt = args.sourcePrompt?.trim();
  const targetInstruction = args.targetInstruction?.trim();
  const attachmentLines = args.attachments.map(
    (attachment) =>
      `- ${attachment.fileName} [${attachment.mediaKind}]: ${attachment.url}`
  );

  return [
    "Operator plan batch instruction:",
    "",
    `This request applies only to ${args.prospectName}.`,
    "Never reference, infer, or use instructions or profile data belonging to another prospect.",
    ...(sourcePrompt
      ? ["", "Original user message that initiated this work:", sourcePrompt]
      : []),
    "",
    "Shared instruction:",
    args.sharedInstruction.trim(),
    ...(targetInstruction
      ? [
          "",
          `Instruction specifically for ${args.prospectName}:`,
          targetInstruction,
        ]
      : []),
    ...(attachmentLines.length > 0
      ? [
          "",
          "Selected workspace attachments:",
          ...attachmentLines,
          "Use these exact URLs only where the instruction requires them.",
        ]
      : []),
    "",
    ...getOperationInstruction(args.operation),
    "Complete the requested plan work with tools in this turn.",
    "Keep the final response short and report only what happened for this prospect.",
  ].join("\n");
}

/**
 * Old fan-out turns copied one shared prompt containing every prospect into
 * each prospect thread. Remove that complete turn from future LLM context.
 */
export function filterLegacySharedBatchTurns(
  messages: ModelMessage[]
): ModelMessage[] {
  const filtered: ModelMessage[] = [];
  let suppressUntilNextUserMessage = false;

  for (const message of messages) {
    if (message.role === "user") {
      const messageText = getModelMessageText(message);
      const isLegacySharedBatch = messageText.includes(
        LEGACY_SHARED_PROSPECT_BATCH_PROMPT_PREFIX
      );
      suppressUntilNextUserMessage = Boolean(isLegacySharedBatch);
      if (suppressUntilNextUserMessage) {
        continue;
      }
    } else if (suppressUntilNextUserMessage) {
      continue;
    }

    filtered.push(message);
  }

  return filtered;
}
